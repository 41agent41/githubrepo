"""
cTrader ProtoOA Client – C4-C10.

Architecture:
- Twisted reactor runs once in a daemon thread (never stopped).
- Each API call creates its own Client (TCP connection) and RequestContext.
- No global mutable result state – concurrent requests are safe.
- ProtoOAErrorRes is handled for immediate error feedback.

Price note: all cTrader Open API prices are in 1/100000 of a unit
(e.g. 123000 = 1.23). This applies universally to spots, trendbars,
and order prices regardless of instrument.
"""

import logging
import threading
import time
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

PRICE_DIVISOR = 100_000  # universal for cTrader Open API

TIMEFRAME_TO_PERIOD = {
    "1min": 1, "tick": 1,
    "5min": 5, "5m": 5,
    "15min": 7, "15m": 7,
    "30min": 8, "30m": 8,
    "1hour": 9, "1h": 9,
    "4hour": 10, "4h": 10,
    "1day": 12, "1d": 12,
}

ORDER_TYPE_MAP = {
    "MARKET": 1, "MKT": 1,
    "LIMIT": 2, "LMT": 2,
    "STOP": 3, "STP": 3,
    "STOP_LIMIT": 6, "STOP LIMIT": 6, "STP_LMT": 6,
    "MARKET_RANGE": 5,
}

# ProtoOAOrderType enum -> human-readable
_ORDER_TYPE_NAMES = {1: "Market", 2: "Limit", 3: "Stop", 5: "MarketRange", 6: "StopLimit"}
# ProtoOAOrderStatus enum -> human-readable
_ORDER_STATUS_NAMES = {1: "Created", 2: "Accepted", 3: "Filled", 4: "Rejected", 5: "Expired", 6: "Cancelled"}

# ---------------------------------------------------------------------------
# Reactor management – start once, never stop
# ---------------------------------------------------------------------------

_reactor_lock = threading.Lock()
_reactor_running = False
_reactor_ready = threading.Event()


def _ensure_reactor():
    """Start the Twisted reactor in a daemon thread (idempotent)."""
    global _reactor_running
    if _reactor_running and _reactor_ready.is_set():
        return
    with _reactor_lock:
        if _reactor_running:
            _reactor_ready.wait(timeout=5)
            return
        from twisted.internet import reactor as _r

        def _run():
            _r.callWhenRunning(_reactor_ready.set)
            _r.run(installSignalHandlers=0)

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        _reactor_running = True
    _reactor_ready.wait(timeout=5)


# ---------------------------------------------------------------------------
# Per-request context (replaces global mutable state)
# ---------------------------------------------------------------------------

class _RequestContext:
    """Holds result/error for a single ProtoOA request. Thread-safe."""

    __slots__ = ("result", "error", "done")

    def __init__(self):
        self.result: Any = None
        self.error: Any = None
        self.done = threading.Event()

    def set_result(self, value):
        self.result = value
        self.done.set()

    def set_error(self, err):
        self.error = err
        self.done.set()


# ---------------------------------------------------------------------------
# Generic ProtoOA runner
# ---------------------------------------------------------------------------

def _run_protooa(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    request_type: str,
    extra: Optional[dict] = None,
    timeout: float = 30,
) -> Any:
    """
    Connect → AppAuth → AccountAuth → request → disconnect.
    Returns the parsed result or raises on error.
    """
    _ensure_reactor()

    try:
        from ctrader_open_api import Client, Protobuf, TcpProtocol, EndPoints
        from ctrader_open_api.messages.OpenApiMessages_pb2 import (
            ProtoOAApplicationAuthReq,
            ProtoOAApplicationAuthRes,
            ProtoOAGetAccountListByAccessTokenReq,
            ProtoOAGetAccountListByAccessTokenRes,
            ProtoOAAccountAuthReq,
            ProtoOAAccountAuthRes,
            ProtoOATraderReq,
            ProtoOATraderRes,
            ProtoOAReconcileReq,
            ProtoOAReconcileRes,
            ProtoOASymbolsListReq,
            ProtoOASymbolsListRes,
            ProtoOAGetTrendbarsReq,
            ProtoOAGetTrendbarsRes,
            ProtoOASubscribeSpotsReq,
            ProtoOASubscribeSpotsRes,
            ProtoOASpotEvent,
            ProtoOANewOrderReq,
            ProtoOACancelOrderReq,
            ProtoOAExecutionEvent,
            ProtoOAOrderErrorEvent,
            ProtoOAErrorRes,
        )
        from twisted.internet import reactor
    except ImportError as e:
        raise RuntimeError(f"ctrader-open-api not installed: {e}") from e

    ctx = _RequestContext()
    extra = extra or {}
    state = {"ctid": ctid_trader_account_id, "spot_subscribed": False}

    host = EndPoints.PROTOBUF_LIVE_HOST if account_mode.lower() == "live" else EndPoints.PROTOBUF_DEMO_HOST
    port = EndPoints.PROTOBUF_PORT
    client = Client(host, port, TcpProtocol)

    # --- callbacks (run in reactor thread) ---

    def _stop_client():
        try:
            client.stopService()
        except Exception:
            pass

    def on_error(failure):
        ctx.set_error(failure)
        _stop_client()

    def on_connected(client_ref):
        req = ProtoOAApplicationAuthReq()
        req.clientId = client_id
        req.clientSecret = client_secret
        d = client_ref.send(req)
        d.addErrback(on_error)

    def on_disconnected(client_ref, reason):
        if not ctx.done.is_set():
            ctx.set_error(RuntimeError(f"Disconnected: {reason}"))

    def on_message(client_ref, message):
        try:
            pt = message.payloadType
            ex = Protobuf.extract(message)

            # --- ProtoOAErrorRes (global error handler) ---
            if pt == ProtoOAErrorRes().payloadType:
                desc = getattr(ex, "description", "") or getattr(ex, "errorCode", "UNKNOWN_ERROR")
                ctx.set_error(RuntimeError(f"cTrader error: {desc}"))
                _stop_client()
                return

            # --- auth flow ---
            if pt == ProtoOAApplicationAuthRes().payloadType:
                if state["ctid"] is not None:
                    req = ProtoOAAccountAuthReq()
                    req.ctidTraderAccountId = state["ctid"]
                    req.accessToken = access_token
                    client_ref.send(req)
                else:
                    req = ProtoOAGetAccountListByAccessTokenReq()
                    req.accessToken = access_token
                    client_ref.send(req)
                return

            if pt == ProtoOAGetAccountListByAccessTokenRes().payloadType:
                accounts = list(ex.ctidTraderAccount)
                if not accounts:
                    ctx.set_error(RuntimeError("No accounts found for access token"))
                    _stop_client()
                    return
                state["ctid"] = int(accounts[0].ctidTraderAccountId)
                req = ProtoOAAccountAuthReq()
                req.ctidTraderAccountId = state["ctid"]
                req.accessToken = access_token
                client_ref.send(req)
                return

            if pt == ProtoOAAccountAuthRes().payloadType:
                ctid = state["ctid"]
                _dispatch_request(client_ref, ctid, request_type, extra)
                return

            # --- response handlers ---
            if pt == ProtoOATraderRes().payloadType and request_type == "trader":
                _handle_trader(ex, ctx)
            elif pt == ProtoOAReconcileRes().payloadType and request_type == "reconcile":
                _handle_reconcile(ex, ctx)
            elif pt == ProtoOASymbolsListRes().payloadType and request_type == "symbols":
                _handle_symbols(ex, ctx)
            elif pt == ProtoOAGetTrendbarsRes().payloadType and request_type == "trendbars":
                _handle_trendbars(ex, ctx)
            elif pt == ProtoOASubscribeSpotsRes().payloadType and request_type == "spot":
                state["spot_subscribed"] = True
                return  # wait for SpotEvent
            elif pt == ProtoOASpotEvent().payloadType and request_type == "spot":
                _handle_spot(ex, ctx)
            elif pt == ProtoOAExecutionEvent().payloadType and request_type in ("neworder", "cancelorder"):
                _handle_execution(ex, ctx, extra)
            elif pt == ProtoOAOrderErrorEvent().payloadType and request_type in ("neworder", "cancelorder"):
                desc = getattr(ex, "description", None) or getattr(ex, "errorCode", "ORDER_ERROR")
                ctx.set_error(RuntimeError(str(desc)))
            else:
                return  # ignore unrelated messages

            _stop_client()

        except Exception as e:
            logger.exception("ProtoOA message handling error")
            ctx.set_error(e)
            _stop_client()

    def _dispatch_request(client_ref, ctid, rtype, params):
        if rtype == "trader":
            req = ProtoOATraderReq()
            req.ctidTraderAccountId = ctid
            client_ref.send(req)
        elif rtype == "reconcile":
            req = ProtoOAReconcileReq()
            req.ctidTraderAccountId = ctid
            client_ref.send(req)
        elif rtype == "symbols":
            req = ProtoOASymbolsListReq()
            req.ctidTraderAccountId = ctid
            client_ref.send(req)
        elif rtype == "trendbars":
            req = ProtoOAGetTrendbarsReq()
            req.ctidTraderAccountId = ctid
            req.symbolId = params.get("symbol_id", 0)
            req.period = params.get("period", 5)
            if params.get("from_timestamp") is not None:
                req.fromTimestamp = params["from_timestamp"]
            if params.get("to_timestamp") is not None:
                req.toTimestamp = params["to_timestamp"]
            client_ref.send(req)
        elif rtype == "spot":
            req = ProtoOASubscribeSpotsReq()
            req.ctidTraderAccountId = ctid
            req.symbolId.append(params.get("symbol_id", 0))
            req.subscribeToSpotTimestamp = True
            client_ref.send(req)
        elif rtype == "neworder":
            req = ProtoOANewOrderReq()
            req.ctidTraderAccountId = ctid
            req.symbolId = params.get("symbol_id", 0)
            req.orderType = params.get("order_type", 1)
            req.tradeSide = params.get("trade_side", 1)
            req.volume = int(params.get("volume", 0))
            if params.get("limit_price") is not None:
                req.limitPrice = params["limit_price"]
            if params.get("stop_price") is not None:
                req.stopPrice = params["stop_price"]
            client_ref.send(req)
        elif rtype == "cancelorder":
            req = ProtoOACancelOrderReq()
            req.ctidTraderAccountId = ctid
            req.orderId = params.get("order_id", 0)
            client_ref.send(req)
        else:
            ctx.set_error(RuntimeError(f"Unknown request_type: {rtype}"))
            _stop_client()

    # --- wire up and connect ---
    client.setConnectedCallback(on_connected)
    client.setDisconnectedCallback(on_disconnected)
    client.setMessageReceivedCallback(on_message)
    reactor.callFromThread(client.startService)

    # --- wait for result ---
    if not ctx.done.wait(timeout=timeout):
        reactor.callFromThread(_stop_client)
        raise RuntimeError("ProtoOA request timed out")

    if ctx.error is not None:
        err = ctx.error
        if hasattr(err, "value"):
            raise err.value
        if hasattr(err, "getErrorMessage"):
            raise RuntimeError(err.getErrorMessage())
        raise RuntimeError(str(err))

    if ctx.result is None:
        raise RuntimeError("No response received")
    return ctx.result


# ---------------------------------------------------------------------------
# Response handlers
# ---------------------------------------------------------------------------

def _handle_trader(ex, ctx: _RequestContext):
    trader = ex.trader
    md = getattr(trader, "moneyDigits", 8) or 8
    div = 10 ** md
    ctx.set_result({
        "ctid_trader_account_id": int(trader.ctidTraderAccountId),
        "balance": float(trader.balance) / div if trader.balance else 0.0,
        "manager_bonus": float(getattr(trader, "managerBonus", 0) or 0) / div,
        "ib_bonus": float(getattr(trader, "ibBonus", 0) or 0) / div,
        "non_withdrawable_bonus": float(getattr(trader, "nonWithdrawableBonus", 0) or 0) / div,
        "money_digits": md,
    })


def _handle_reconcile(ex, ctx: _RequestContext):
    positions = []
    for p in list(ex.position):
        td = p.tradeData
        vol = getattr(td, "volume", 0) or 0
        sign = 1 if (getattr(td, "tradeSide", 1) == 1) else -1
        md = getattr(p, "moneyDigits", 8) or 8
        div = 10 ** md
        positions.append({
            "position_id": int(p.positionId),
            "symbol_id": int(td.symbolId) if hasattr(td, "symbolId") else 0,
            "position": sign * (vol / 100.0),
            "volume": vol / 100.0,
            "price": float(p.price) if p.price else 0,
            "swap": float(p.swap) / div if p.swap else 0,
            "commission": float(getattr(p, "commission", 0) or 0) / div,
        })
    orders = []
    for o in list(ex.order):
        td = o.tradeData if hasattr(o, "tradeData") else None
        otype = getattr(o, "orderType", 1)
        ostatus = getattr(o, "orderStatus", 1)
        orders.append({
            "order_id": int(o.orderId),
            "symbol_id": int(td.symbolId) if td and hasattr(td, "symbolId") else 0,
            "volume": (getattr(td, "volume", 0) or 0) / 100.0 if td else 0,
            "trade_side": getattr(td, "tradeSide", 1) if td else 1,
            "order_type": otype,
            "order_type_name": _ORDER_TYPE_NAMES.get(otype, "Unknown"),
            "status": ostatus,
            "status_name": _ORDER_STATUS_NAMES.get(ostatus, "Unknown"),
        })
    ctx.set_result({"positions": positions, "orders": orders})


def _handle_symbols(ex, ctx: _RequestContext):
    symbols = []
    for s in list(ex.symbol):
        symbols.append({
            "symbol_id": int(s.symbolId),
            "name": getattr(s, "symbolName", "") or "",
            "display_name": getattr(s, "displayName", "") or "",
        })
    for s in list(getattr(ex, "archivedSymbol", [])):
        symbols.append({
            "symbol_id": int(s.symbolId),
            "name": getattr(s, "symbolName", "") or "",
            "display_name": getattr(s, "displayName", "") or "",
            "archived": True,
        })
    ctx.set_result({"symbols": symbols})


def _handle_trendbars(ex, ctx: _RequestContext):
    bars = []
    for tb in list(ex.trendbar):
        ts_min = getattr(tb, "utcTimestampInMinutes", 0) or 0
        low = float(getattr(tb, "low", 0) or 0) / PRICE_DIVISOR
        delta_open = float(getattr(tb, "deltaOpen", 0) or 0) / PRICE_DIVISOR
        delta_high = float(getattr(tb, "deltaHigh", 0) or 0) / PRICE_DIVISOR
        delta_close = float(getattr(tb, "deltaClose", 0) or 0) / PRICE_DIVISOR
        bars.append({
            "timestamp": ts_min * 60 * 1000,
            "open": low + delta_open,
            "high": low + delta_high,
            "low": low,
            "close": low + delta_close,
            "volume": int(getattr(tb, "volume", 0) or 0),
        })
    ctx.set_result({"bars": bars, "symbol_id": getattr(ex, "symbolId", 0)})


def _handle_spot(ex, ctx: _RequestContext):
    ctx.set_result({
        "symbol_id": int(ex.symbolId),
        "bid": float(getattr(ex, "bid", 0) or 0) / PRICE_DIVISOR,
        "ask": float(getattr(ex, "ask", 0) or 0) / PRICE_DIVISOR,
        "timestamp": getattr(ex, "timestamp", 0) or int(time.time() * 1000),
    })


def _handle_execution(ex, ctx: _RequestContext, extra: dict):
    order_id = 0
    if ex.order:
        order_id = int(getattr(ex.order, "orderId", 0) or 0)
    if order_id == 0:
        order_id = extra.get("order_id", 0)
    ctx.set_result({
        "success": True,
        "order_id": order_id,
        "execution_type": getattr(ex, "executionType", 0),
    })


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_account_summary(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
) -> dict:
    data = _run_protooa(client_id, client_secret, access_token,
                        ctid_trader_account_id, account_mode, "trader")
    balance = data["balance"]
    net_liq = balance + data.get("manager_bonus", 0) + data.get("ib_bonus", 0)
    return {
        "account_id": str(data["ctid_trader_account_id"]),
        "net_liquidation": net_liq,
        "NetLiquidation": net_liq,
        "currency": "USD",
        "total_cash_value": balance,
        "TotalCashValue": balance,
        "buying_power": balance,
        "BuyingPower": balance,
        "maintenance_margin": 0,
        "MaintMarginReq": 0,
    }


def fetch_positions(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    symbol_id_to_name: Optional[dict] = None,
) -> List[dict]:
    data = _run_protooa(client_id, client_secret, access_token,
                        ctid_trader_account_id, account_mode, "reconcile")
    positions = data.get("positions", [])
    sid_map = symbol_id_to_name or {}
    for p in positions:
        p["symbol"] = sid_map.get(p.get("symbol_id"), f"#{p.get('symbol_id', '')}")
    return positions


def fetch_orders(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    symbol_id_to_name: Optional[dict] = None,
) -> List[dict]:
    data = _run_protooa(client_id, client_secret, access_token,
                        ctid_trader_account_id, account_mode, "reconcile")
    orders = data.get("orders", [])
    sid_map = symbol_id_to_name or {}
    for o in orders:
        o["symbol"] = sid_map.get(o.get("symbol_id"), f"#{o.get('symbol_id', '')}")
    return orders


def fetch_reconcile(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    symbol_id_to_name: Optional[dict] = None,
) -> dict:
    """Fetch positions AND orders in a single reconcile call."""
    data = _run_protooa(client_id, client_secret, access_token,
                        ctid_trader_account_id, account_mode, "reconcile")
    sid_map = symbol_id_to_name or {}
    for p in data.get("positions", []):
        p["symbol"] = sid_map.get(p.get("symbol_id"), f"#{p.get('symbol_id', '')}")
    for o in data.get("orders", []):
        o["symbol"] = sid_map.get(o.get("symbol_id"), f"#{o.get('symbol_id', '')}")
    return data


def fetch_symbols_list(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
) -> List[dict]:
    data = _run_protooa(client_id, client_secret, access_token,
                        ctid_trader_account_id, account_mode, "symbols")
    return data.get("symbols", [])


def fetch_trendbars(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    symbol_id: int, timeframe: str,
    from_timestamp_ms: Optional[int] = None,
    to_timestamp_ms: Optional[int] = None,
) -> List[dict]:
    period = TIMEFRAME_TO_PERIOD.get(timeframe.lower(), 5)
    params: dict = {"symbol_id": symbol_id, "period": period}
    if from_timestamp_ms is not None:
        params["from_timestamp"] = from_timestamp_ms
    if to_timestamp_ms is not None:
        params["to_timestamp"] = to_timestamp_ms
    data = _run_protooa(client_id, client_secret, access_token,
                        ctid_trader_account_id, account_mode, "trendbars",
                        extra=params)
    return data.get("bars", [])


def fetch_spot(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    symbol_id: int,
) -> dict:
    return _run_protooa(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode, "spot",
        extra={"symbol_id": symbol_id},
        timeout=15,
    )


def place_order(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    symbol_id: int, action: str, quantity: float,
    order_type: str = "MARKET",
    limit_price: Optional[float] = None,
    stop_price: Optional[float] = None,
) -> dict:
    trade_side = 1 if str(action).upper() in ("BUY", "B") else 2
    otype = ORDER_TYPE_MAP.get(order_type.upper().replace(" ", "_"), 1)
    volume_cents = int(round(quantity * 100))
    if volume_cents <= 0:
        raise ValueError("Quantity must be positive")
    params: dict = {
        "symbol_id": symbol_id,
        "trade_side": trade_side,
        "volume": volume_cents,
        "order_type": otype,
    }
    if limit_price is not None:
        params["limit_price"] = limit_price
    if stop_price is not None:
        params["stop_price"] = stop_price
    return _run_protooa(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode, "neworder",
        extra=params,
    )


def cancel_order(
    client_id: str, client_secret: str, access_token: str,
    ctid_trader_account_id: Optional[int], account_mode: str,
    order_id: int,
) -> dict:
    return _run_protooa(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode, "cancelorder",
        extra={"order_id": order_id},
    )
