"""
cTrader Service - REST API for cTrader Open API integration

Exposes endpoints aligned with IBrokerService for use by CTraderBroker.
OAuth code exchange (C1) implemented; token storage is returned to backend for DB persistence.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


class RefreshRequest(BaseModel):
    client_id: str
    client_secret: str
    refresh_token: str


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


def _safe_json(response) -> dict:
    """Parse JSON from httpx response, returning empty dict on parse failure."""
    try:
        return response.json()
    except Exception:
        return {}


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
    if response.status_code != 200:
        data = _safe_json(response)
        error_code = data.get("errorCode") or response.status_code
        description = data.get("description") or response.text or "Token exchange failed"
        raise HTTPException(
            status_code=400,
            detail=f"cTrader token exchange failed: {description} (code: {error_code})",
        )
    data = _safe_json(response)
    if data.get("errorCode"):
        raise HTTPException(
            status_code=400,
            detail=data.get("description") or f"cTrader error: {data.get('errorCode')}",
        )
    return data


async def _refresh_tokens(
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> dict:
    """
    Refresh access token using refresh_token.
    Calls GET https://openapi.ctrader.com/apps/token with grant_type=refresh_token.
    """
    url = f"{CTRADER_TOKEN_BASE}/apps/token"
    params = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
    if response.status_code != 200:
        data = _safe_json(response)
        error_code = data.get("errorCode") or response.status_code
        description = data.get("description") or response.text or "Token refresh failed"
        raise HTTPException(
            status_code=400,
            detail=f"cTrader token refresh failed: {description} (code: {error_code})",
        )
    data = _safe_json(response)
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


@app.post("/connection/refresh")
async def connection_refresh(req: RefreshRequest):
    """
    C3: Refresh access token using refresh_token.
    Returns new tokens for backend to store in ctrader_connection_profiles.
    """
    if not req.refresh_token or not req.client_id or not req.client_secret:
        raise HTTPException(
            status_code=400,
            detail="refresh_token, client_id, and client_secret are required.",
        )

    try:
        data = await _refresh_tokens(
            client_id=req.client_id.strip(),
            client_secret=req.client_secret,
            refresh_token=req.refresh_token.strip(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token refresh failed")
        raise HTTPException(status_code=502, detail=f"Token refresh failed: {e}")

    access_token = data.get("accessToken")
    refresh_token = data.get("refreshToken")
    expires_in = data.get("expiresIn", 2628000)
    if not access_token:
        raise HTTPException(status_code=502, detail="Invalid token response: no accessToken.")

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # Backend stores tokens in DB; we do not update in-memory state here
    # (refresh may be for a different profile than the one in memory)

    return {
        "success": True,
        "message": "Tokens refreshed; store in profile.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        "token_expires_at": token_expires_at.isoformat(),
    }


@app.get("/connection/status")
async def connection_status_endpoint():
    return {
        "connected": connection_status["connected"],
        "account_mode": connection_status["account_mode"],
        "last_error": connection_status["last_error"]
    }


# =============================================================================
# Account (C4: real ProtoOA implementation)
# =============================================================================

def _get_credentials_from_request(request: Request) -> dict:
    """Extract ProtoOA credentials from request headers. Returns dict or empty if missing."""
    access_token = request.headers.get("x-access-token") or request.headers.get("X-Access-Token")
    client_id = request.headers.get("x-client-id") or request.headers.get("X-Client-Id")
    client_secret = request.headers.get("x-client-secret") or request.headers.get("X-Client-Secret")
    ctid_raw = request.headers.get("x-ctid-trader-account-id") or request.headers.get("X-Ctid-Trader-Account-Id")
    ctid_trader_account_id = int(ctid_raw) if ctid_raw and str(ctid_raw).isdigit() else None
    account_mode = request.headers.get("x-account-mode") or request.headers.get("X-Account-Mode") or ACCOUNT_MODE
    if not access_token or not client_id or not client_secret:
        return {}
    return {
        "access_token": access_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "ctid_trader_account_id": ctid_trader_account_id,
        "account_mode": account_mode,
    }


def _stub_account_response():
    """Return stub account when no credentials available."""
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


def _normalize_symbol(s: str) -> str:
    return s.replace("/", "").replace(".", "").replace("#", "").upper()


def _resolve_symbol_id(symbols: list, raw_symbol: str) -> Optional[int]:
    """Resolve a symbol string to a cTrader symbolId with strict matching."""
    target = _normalize_symbol(raw_symbol)
    if not target:
        return None
    # 1. Exact name match
    for s in symbols:
        if _normalize_symbol(s.get("name", "")) == target:
            return s["symbol_id"]
    # 2. Exact display_name match
    for s in symbols:
        if _normalize_symbol(s.get("display_name", "")) == target:
            return s["symbol_id"]
    # 3. Starts-with (target is a prefix of the broker name, e.g. "AAPL" matches "AAPL.US")
    for s in symbols:
        name = _normalize_symbol(s.get("name", ""))
        if name.startswith(target):
            return s["symbol_id"]
    return None


async def _fetch_symbols_cached(cred: dict) -> list:
    """Fetch symbols list (future: add TTL cache)."""
    import asyncio
    from protooa_client import fetch_symbols_list
    return await asyncio.to_thread(
        fetch_symbols_list,
        cred["client_id"], cred["client_secret"], cred["access_token"],
        cred["ctid_trader_account_id"], cred["account_mode"],
    )


@app.get("/account/summary")
async def account_summary(request: Request):
    """
    Account summary - C4: real ProtoOA implementation.
    Pass credentials via headers: X-Access-Token, X-Client-Id, X-Client-Secret, etc.
    """
    import asyncio
    from protooa_client import fetch_account_summary

    cred = _get_credentials_from_request(request)
    if not cred:
        return _stub_account_response()
    try:
        result = await asyncio.to_thread(
            fetch_account_summary,
            client_id=cred["client_id"],
            client_secret=cred["client_secret"],
            access_token=cred["access_token"],
            ctid_trader_account_id=cred["ctid_trader_account_id"],
            account_mode=cred["account_mode"],
        )
        result["last_updated"] = datetime.now(timezone.utc).isoformat()
        return result
    except Exception as e:
        logger.exception("ProtoOA account summary failed")
        raise HTTPException(status_code=502, detail=f"Account fetch failed: {e}")



@app.get("/account/positions")
async def account_positions(request: Request):
    """C5: Positions via ProtoOAReconcileReq. Pass credentials via headers."""
    import asyncio
    from protooa_client import fetch_positions

    cred = _get_credentials_from_request(request)
    if not cred:
        return []
    try:
        symbols = await _fetch_symbols_cached(cred)
        sid_to_name = {s["symbol_id"]: s.get("name", "") for s in symbols}
        positions = await asyncio.to_thread(
            fetch_positions,
            cred["client_id"], cred["client_secret"], cred["access_token"],
            cred["ctid_trader_account_id"], cred["account_mode"],
            symbol_id_to_name=sid_to_name,
        )
        return [_position_to_ib_format(p) for p in positions]
    except Exception as e:
        logger.exception("ProtoOA positions failed")
        raise HTTPException(status_code=502, detail=f"Positions fetch failed: {e}")


def _position_to_ib_format(p: dict) -> dict:
    """Map cTrader position to ib_service format."""
    return {
        "symbol": p.get("symbol", ""),
        "position": p.get("position", 0),
        "average_cost": p.get("price", 0),
        "market_price": p.get("price"),
        "unrealized_pnl": None,
        "realized_pnl": None,
        "sec_type": "CASH",
        "currency": "USD",
    }


@app.get("/account/orders")
async def account_orders(request: Request):
    """C6: Orders via ProtoOAReconcileReq. Pass credentials via headers."""
    import asyncio
    from protooa_client import fetch_orders

    cred = _get_credentials_from_request(request)
    if not cred:
        return []
    try:
        symbols = await _fetch_symbols_cached(cred)
        sid_to_name = {s["symbol_id"]: s.get("name", "") for s in symbols}
        orders = await asyncio.to_thread(
            fetch_orders,
            cred["client_id"], cred["client_secret"], cred["access_token"],
            cred["ctid_trader_account_id"], cred["account_mode"],
            symbol_id_to_name=sid_to_name,
        )
        return [_order_to_ib_format(o) for o in orders]
    except Exception as e:
        logger.exception("ProtoOA orders failed")
        raise HTTPException(status_code=502, detail=f"Orders fetch failed: {e}")


def _order_to_ib_format(o: dict) -> dict:
    """Map cTrader order to ib_service format."""
    side = "BUY" if (o.get("trade_side", 1) == 1) else "SELL"
    return {
        "order_id": o.get("order_id", 0),
        "symbol": o.get("symbol", ""),
        "action": side,
        "quantity": o.get("volume", 0),
        "order_type": o.get("order_type_name", "Market"),
        "status": o.get("status_name", "Pending"),
        "filled_quantity": 0,
        "remaining_quantity": o.get("volume", 0),
    }


@app.get("/account/all")
async def account_all(request: Request):
    """All account data – summary + single reconcile for positions & orders."""
    import asyncio
    from protooa_client import fetch_account_summary, fetch_reconcile

    cred = _get_credentials_from_request(request)
    if not cred:
        return {
            "account": _stub_account_response(),
            "positions": [],
            "orders": [],
        }
    try:
        symbols = await _fetch_symbols_cached(cred)
        sid_to_name = {s["symbol_id"]: s.get("name", "") for s in symbols}

        summary_data, recon_data = await asyncio.gather(
            asyncio.to_thread(
                fetch_account_summary,
                cred["client_id"], cred["client_secret"], cred["access_token"],
                cred["ctid_trader_account_id"], cred["account_mode"],
            ),
            asyncio.to_thread(
                fetch_reconcile,
                cred["client_id"], cred["client_secret"], cred["access_token"],
                cred["ctid_trader_account_id"], cred["account_mode"],
                symbol_id_to_name=sid_to_name,
            ),
        )
        summary_data["last_updated"] = datetime.now(timezone.utc).isoformat()
        return {
            "account": summary_data,
            "positions": [_position_to_ib_format(p) for p in recon_data.get("positions", [])],
            "orders": [_order_to_ib_format(o) for o in recon_data.get("orders", [])],
        }
    except Exception as e:
        logger.exception("ProtoOA account/all failed")
        raise HTTPException(status_code=502, detail=f"Account data fetch failed: {e}")


# =============================================================================
# Orders (C6: ProtoOANewOrderReq, ProtoOACancelOrderReq)
# =============================================================================

@app.post("/orders/place")
async def orders_place(request: Request, req: PlaceOrderRequest):
    """C6: Place order via ProtoOANewOrderReq. Pass credentials via headers."""
    import asyncio
    from protooa_client import place_order

    cred = _get_credentials_from_request(request)
    if not cred:
        raise HTTPException(status_code=401, detail="Credentials required (X-Access-Token, X-Client-Id, X-Client-Secret)")
    if not (req.symbol or "").strip():
        raise HTTPException(status_code=400, detail="symbol is required")
    try:
        symbols = await _fetch_symbols_cached(cred)
        symbol_id = _resolve_symbol_id(symbols, req.symbol)
        if symbol_id is None:
            raise HTTPException(status_code=404, detail=f"Symbol not found: {req.symbol}")
        result = await asyncio.to_thread(
            place_order,
            cred["client_id"], cred["client_secret"], cred["access_token"],
            cred["ctid_trader_account_id"], cred["account_mode"],
            symbol_id=symbol_id,
            action=req.action,
            quantity=req.quantity,
            order_type=req.order_type or "MARKET",
            limit_price=req.limit_price,
            stop_price=req.stop_price,
        )
        return {
            "success": result.get("success", True),
            "order_id": result.get("order_id", 0),
            "symbol": req.symbol,
            "action": req.action,
            "quantity": req.quantity,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("ProtoOA place order failed")
        raise HTTPException(status_code=502, detail=f"Place order failed: {e}")


class CancelOrderRequest(BaseModel):
    order_id: int


@app.post("/orders/cancel")
async def orders_cancel(request: Request, req: CancelOrderRequest):
    """C6: Cancel order via ProtoOACancelOrderReq. Pass credentials via headers."""
    import asyncio
    from protooa_client import cancel_order

    cred = _get_credentials_from_request(request)
    if not cred:
        raise HTTPException(status_code=401, detail="Credentials required (X-Access-Token, X-Client-Id, X-Client-Secret)")
    try:
        result = await asyncio.to_thread(
            cancel_order,
            cred["client_id"], cred["client_secret"], cred["access_token"],
            cred["ctid_trader_account_id"], cred["account_mode"],
            order_id=req.order_id,
        )
        return {
            "success": result.get("success", True),
            "order_id": req.order_id,
        }
    except Exception as e:
        logger.exception("ProtoOA cancel order failed")
        raise HTTPException(status_code=502, detail=f"Cancel order failed: {e}")


# =============================================================================
# Market Data (stub)
# =============================================================================

@app.get("/market-data/history")
async def market_data_history(
    request: Request,
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
    """C7: Historical OHLCV via ProtoOAGetTrendbarsReq. Pass credentials via headers."""
    import asyncio
    from protooa_client import fetch_trendbars

    cred = _get_credentials_from_request(request)
    if not cred:
        return {"symbol": symbol, "timeframe": timeframe, "bars": [], "data": [], "count": 0}
    try:
        symbols = await _fetch_symbols_cached(cred)
        symbol_id = _resolve_symbol_id(symbols, symbol)
        if symbol_id is None:
            return {"symbol": symbol, "timeframe": timeframe, "bars": [], "data": [], "count": 0}
        to_ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        from_ts = to_ts - (30 * 24 * 60 * 60 * 1000)  # 30 days back
        if start_date:
            try:
                from_ts = int(datetime.fromisoformat(start_date.replace("Z", "+00:00")).timestamp() * 1000)
            except Exception:
                pass
        if end_date:
            try:
                to_ts = int(datetime.fromisoformat(end_date.replace("Z", "+00:00")).timestamp() * 1000)
            except Exception:
                pass
        bars = await asyncio.to_thread(
            fetch_trendbars,
            cred["client_id"], cred["client_secret"], cred["access_token"],
            cred["ctid_trader_account_id"], cred["account_mode"],
            symbol_id=symbol_id,
            timeframe=timeframe,
            from_timestamp_ms=from_ts,
            to_timestamp_ms=to_ts,
        )
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "period": period,
            "bars": bars,
            "data": bars,
            "count": len(bars),
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.exception("ProtoOA history failed")
        raise HTTPException(status_code=502, detail=f"History fetch failed: {e}")


@app.get("/market-data/realtime")
async def market_data_realtime(request: Request, symbol: str, account_mode: str = "paper"):
    """C8: Real-time quote via ProtoOASubscribeSpotsReq. Pass credentials via headers."""
    import asyncio
    from protooa_client import fetch_spot

    cred = _get_credentials_from_request(request)
    if not cred:
        return {"symbol": symbol, "bid": None, "ask": None, "last": None, "volume": None}
    try:
        symbols = await _fetch_symbols_cached(cred)
        symbol_id = _resolve_symbol_id(symbols, symbol)
        if symbol_id is None:
            return {"symbol": symbol, "bid": None, "ask": None, "last": None, "volume": None}
        spot = await asyncio.to_thread(
            fetch_spot,
            cred["client_id"], cred["client_secret"], cred["access_token"],
            cred["ctid_trader_account_id"], cred["account_mode"],
            symbol_id=symbol_id,
        )
        mid = (spot.get("bid", 0) + spot.get("ask", 0)) / 2 if (spot.get("bid") and spot.get("ask")) else spot.get("bid") or spot.get("ask")
        return {
            "symbol": symbol,
            "bid": spot.get("bid"),
            "ask": spot.get("ask"),
            "last": mid,
            "volume": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.exception("ProtoOA realtime failed")
        raise HTTPException(status_code=502, detail=f"Realtime fetch failed: {e}")



# =============================================================================
# Contract Search (stub)
# =============================================================================

@app.post("/contract/search")
async def contract_search(request: Request, req: SearchRequest):
    """C9: Symbol search via ProtoOASymbolsListReq. Pass credentials via headers."""
    cred = _get_credentials_from_request(request)
    if not cred:
        return {"results": []}
    try:
        symbols = await _fetch_symbols_cached(cred)
        query = _normalize_symbol(req.symbol or "")
        results = []
        for s in symbols:
            name_norm = _normalize_symbol(s.get("name", ""))
            if not query or query in name_norm or name_norm.startswith(query):
                results.append({
                    "symbol": s.get("name", ""),
                    "symbolId": s["symbol_id"],
                    "secType": "CASH",
                    "exchange": "",
                    "currency": "USD",
                    "description": s.get("display_name", ""),
                })
        return {"results": results[:100]}
    except Exception as e:
        logger.exception("ProtoOA contract search failed")
        raise HTTPException(status_code=502, detail=f"Search failed: {e}")


@app.post("/contract/advanced-search")
async def contract_advanced_search(request: Request, req: dict):
    """C9: Advanced symbol search - same as search, filters by symbol from body."""
    return await contract_search(request, SearchRequest(
        symbol=req.get("symbol", ""),
        secType=req.get("secType", "CASH"),
        exchange=req.get("exchange"),
        currency=req.get("currency"),
        name=req.get("name", False),
    ))


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CTRADER_SERVICE_PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
