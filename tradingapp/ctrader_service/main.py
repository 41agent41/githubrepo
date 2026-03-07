"""
cTrader Service - REST API for cTrader Open API integration

Exposes endpoints aligned with IBrokerService for use by CTraderBroker.
OAuth code exchange (C1) implemented; token storage is returned to backend for DB persistence.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
ACCOUNT_MODE = os.getenv('CTRADER_ACCOUNT_MODE', 'paper')  # demo/live
CORS_ORIGINS = os.getenv('CTRADER_CORS_ORIGINS', '').split(',') if os.getenv('CTRADER_CORS_ORIGINS') else []
# cTrader OAuth token endpoint (same URL for demo and live per Open API docs)
CTRADER_TOKEN_BASE = os.getenv('CTRADER_OPENAPI_BASE', 'https://openapi.ctrader.com')

# Connection state: in-memory after successful OAuth (tokens also returned to backend for DB storage)
connection_status = {
    'connected': False,
    'account_mode': ACCOUNT_MODE,
    'last_error': None,
}
# In-memory tokens for this process (used by /health and future ProtoOA calls until disconnect/restart)
_stored_tokens: dict = {}

app = FastAPI(
    title="cTrader Service",
    description="REST API for cTrader Open API - aligned with IBrokerService",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models (aligned with IBBroker / broker.ts)
# =============================================================================

class ConnectRequest(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    auth_code: Optional[str] = None
    account_mode: str = "paper"


class PlaceOrderRequest(BaseModel):
    symbol: str
    action: str  # BUY/SELL
    quantity: float
    order_type: str = "MARKET"  # MARKET, LIMIT, STOP, STOP_LIMIT
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    time_in_force: str = "GTC"


class SearchRequest(BaseModel):
    symbol: str
    secType: str = "CASH"
    exchange: Optional[str] = None
    currency: Optional[str] = None
    name: Optional[bool] = False


# =============================================================================
# Health & Connection
# =============================================================================

@app.get("/")
async def root():
    return {
        "service": "ctrader_service",
        "version": "1.0.0",
        "status": "running",
        "connection": {
            "ctrader": {
                "connected": connection_status["connected"],
                "account_mode": connection_status["account_mode"],
                "last_error": connection_status["last_error"]
            }
        }
    }


@app.get("/health")
async def health():
    """Health check - aligned with ib_service /health"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "connection": {
            "ctrader": {
                "connected": connection_status["connected"],
                "account_mode": connection_status["account_mode"],
                "last_error": connection_status["last_error"]
            }
        }
    }


async def _exchange_code_for_tokens(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    code: str,
) -> dict:
    """
    Exchange OAuth authorization code for access and refresh tokens.
    Calls GET https://openapi.ctrader.com/apps/token per cTrader Open API docs.
    """
    url = f"{CTRADER_TOKEN_BASE}/apps/token"
    params = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
    data = response.json()
    if response.status_code != 200:
        error_code = data.get("errorCode") or response.status_code
        description = data.get("description") or response.text or "Token exchange failed"
        raise HTTPException(
            status_code=400,
            detail=f"cTrader token exchange failed: {description} (code: {error_code})",
        )
    if data.get("errorCode"):
        raise HTTPException(
            status_code=400,
            detail=data.get("description") or f"cTrader error: {data.get('errorCode')}",
        )
    return data


@app.post("/connection/connect")
async def connection_connect(req: ConnectRequest):
    """
    OAuth code exchange: exchange authorization code for access_token and refresh_token.
    Returns tokens so the backend can store them in ctrader_connection_profiles (C2).
    Also sets in-memory connection state for this process.
    """
    connection_status["connected"] = False
    connection_status["last_error"] = None
    connection_status["account_mode"] = req.account_mode or "paper"

    if not req.auth_code or not req.client_id or not req.client_secret:
        connection_status["last_error"] = "Missing client_id, client_secret, or auth_code"
        raise HTTPException(
            status_code=400,
            detail="OAuth code exchange requires client_id, client_secret, redirect_uri, and auth_code.",
        )
    redirect_uri = (req.redirect_uri or "").strip()
    if not redirect_uri:
        connection_status["last_error"] = "redirect_uri is required"
        raise HTTPException(status_code=400, detail="redirect_uri is required.")

    try:
        data = await _exchange_code_for_tokens(
            client_id=req.client_id.strip(),
            client_secret=req.client_secret,
            redirect_uri=redirect_uri,
            code=req.auth_code.strip(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token exchange failed")
        connection_status["last_error"] = str(e)
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {e}")

    access_token = data.get("accessToken")
    refresh_token = data.get("refreshToken")
    expires_in = data.get("expiresIn", 2628000)  # default ~30 days in seconds
    if not access_token:
        connection_status["last_error"] = "No access token in cTrader response"
        raise HTTPException(status_code=502, detail="Invalid token response: no accessToken.")

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # In-memory state for this process (used by /health and future ProtoOA calls)
    _stored_tokens["access_token"] = access_token
    _stored_tokens["refresh_token"] = refresh_token
    _stored_tokens["token_expires_at"] = token_expires_at
    connection_status["connected"] = True
    connection_status["last_error"] = None

    return {
        "success": True,
        "message": "Connected; store tokens in profile.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        "token_expires_at": token_expires_at.isoformat(),
        "connection": {
            "ctrader": {
                "connected": True,
                "account_mode": connection_status["account_mode"],
                "last_error": None,
            }
        },
    }


@app.post("/connection/disconnect")
async def connection_disconnect():
    """Clear in-memory connection and tokens (backend holds tokens in DB)."""
    connection_status["connected"] = False
    _stored_tokens.clear()
    return {"success": True, "message": "Disconnected"}


@app.get("/connection/status")
async def connection_status_endpoint():
    return {
        "connected": connection_status["connected"],
        "account_mode": connection_status["account_mode"],
        "last_error": connection_status["last_error"]
    }


# =============================================================================
# Account (stub - returns mock data when not connected)
# =============================================================================

@app.get("/account/summary")
async def account_summary():
    """Account summary - aligned with ib_service response format"""
    if not connection_status["connected"]:
        return {
            "account_id": "ctrader-stub",
            "net_liquidation": 0,
            "NetLiquidation": 0,
            "currency": "USD",
            "total_cash_value": 0,
            "TotalCashValue": 0,
            "buying_power": 0,
            "BuyingPower": 0,
            "maintenance_margin": 0,
            "MaintMarginReq": 0,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    # TODO: Call ProtoOAGetAccountListReq / cash flow via ctrader-open-api
    raise HTTPException(status_code=501, detail="Real cTrader account API not yet implemented")


@app.get("/account/positions")
async def account_positions():
    """Positions - aligned with ib_service"""
    if not connection_status["connected"]:
        return []
    # TODO: ProtoOAGetPositionListReq
    raise HTTPException(status_code=501, detail="Real cTrader positions API not yet implemented")


@app.get("/account/orders")
async def account_orders():
    """Open orders - aligned with ib_service"""
    if not connection_status["connected"]:
        return []
    # TODO: ProtoOAGetOrderListReq
    raise HTTPException(status_code=501, detail="Real cTrader orders API not yet implemented")


@app.get("/account/all")
async def account_all():
    """All account data in one call"""
    summary = await account_summary()
    positions = await account_positions()
    orders = await account_orders()
    return {
        "account": summary,
        "positions": positions,
        "orders": orders
    }


# =============================================================================
# Orders (stub)
# =============================================================================

@app.post("/orders/place")
async def orders_place(req: PlaceOrderRequest):
    """Place order - aligned with ib_service /orders/place"""
    if not connection_status["connected"]:
        raise HTTPException(status_code=503, detail="cTrader not connected. Complete OAuth flow first.")
    # TODO: ProtoOANewOrderReq
    raise HTTPException(status_code=501, detail="Real cTrader order API not yet implemented")


class CancelOrderRequest(BaseModel):
    order_id: int


@app.post("/orders/cancel")
async def orders_cancel(req: CancelOrderRequest):
    """Cancel order - expects { order_id: number } in body"""
    order_id = req.order_id
    if not connection_status["connected"]:
        raise HTTPException(status_code=503, detail="cTrader not connected")
    # TODO: ProtoOACancelOrderReq
    raise HTTPException(status_code=501, detail="Real cTrader cancel API not yet implemented")


# =============================================================================
# Market Data (stub)
# =============================================================================

@app.get("/market-data/history")
async def market_data_history(
    symbol: str,
    timeframe: str = "5min",
    period: str = "1M",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    secType: str = "CASH",
    exchange: Optional[str] = None,
    currency: str = "USD",
    account_mode: str = "paper"
):
    """Historical OHLCV - aligned with ib_service"""
    # TODO: ProtoOAGetTrendbarsReq - requires connected session
    # Return empty bars when not connected (allows health check / connectivity test)
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "period": period,
        "bars": [],
        "data": [],
        "count": 0,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }


@app.get("/market-data/realtime")
async def market_data_realtime(symbol: str, account_mode: str = "paper"):
    """Real-time quote - aligned with ib_service"""
    # TODO: ProtoOASubscribeSpotsReq + spot updates
    return {
        "symbol": symbol,
        "bid": None,
        "ask": None,
        "last": None,
        "volume": None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# =============================================================================
# Contract Search (stub)
# =============================================================================

@app.post("/contract/search")
async def contract_search(req: SearchRequest):
    """Symbol search - aligned with ib_service /contract/search"""
    # TODO: ProtoOAGetSymbolsListReq / symbol search
    # Return empty when not connected
    return {"results": []}


@app.post("/contract/advanced-search")
async def contract_advanced_search(req: dict):
    """Advanced symbol search"""
    return {"results": []}


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CTRADER_SERVICE_PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
