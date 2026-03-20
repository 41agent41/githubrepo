"""
cTrader ProtoOA Client - C4-C9: Real account, positions, orders, history, symbols via ProtoOA.

Runs the Twisted-based ctrader-open-api in a thread.
Flow: ApplicationAuth -> GetAccountListByAccessToken -> AccountAuth -> [Request]
"""

import logging
import threading
import time
from typing import Optional, List, Any, Callable

logger = logging.getLogger(__name__)

# Timeframe mapping: our format -> cTrader ProtoOATrendbarPeriod
TIMEFRAME_TO_PERIOD = {
    "1min": 1, "tick": 1,
    "5min": 5, "5m": 5,
    "15min": 7, "15m": 7,
    "30min": 8, "30m": 8,
    "1hour": 9, "1h": 9, "1H": 9,
    "4hour": 10, "4h": 10, "4H": 10,
    "8hour": 10, "8h": 10,  # No H8 in cTrader, use H4
    "1day": 12, "1d": 12, "1D": 12,
}

# Thread-safe state for ProtoOA (one request at a time)
_lock = threading.Lock()
_client_result = None
_client_error = None
_result_event = threading.Event()


def _fetch_account_sync(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
) -> dict:
    """
    Synchronous ProtoOA flow. Runs in a thread.
    Returns dict with account balance, etc. or raises on error.
    """
    global _client_result, _client_error, _result_event

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
        )
        from twisted.internet import reactor
    except ImportError as e:
        raise RuntimeError(f"ctrader-open-api not installed: {e}") from e

    with _lock:
        _client_result = None
        _client_error = None
        _result_event.clear()

    host = EndPoints.PROTOBUF_LIVE_HOST if account_mode.lower() == "live" else EndPoints.PROTOBUF_DEMO_HOST
    port = EndPoints.PROTOBUF_PORT
    client = Client(host, port, TcpProtocol)

    state = {"step": "init", "ctid_trader_account_id": ctid_trader_account_id}

    def on_error(failure):
        global _client_error
        _client_error = failure
        _result_event.set()
        try:
            reactor.stop()
        except Exception:
            pass

    def on_message_received(client_ref, message):
        global _client_result, _client_error, _result_event
        try:
            payload_type = message.payloadType
            extracted = Protobuf.extract(message)

            # ProtoOAApplicationAuthRes
            if payload_type == ProtoOAApplicationAuthRes().payloadType:
                state["step"] = "app_auth_done"
                if state["ctid_trader_account_id"] is not None:
                    # Skip account list, go straight to account auth
                    req = ProtoOAAccountAuthReq()
                    req.ctidTraderAccountId = state["ctid_trader_account_id"]
                    req.accessToken = access_token
                    client_ref.send(req)
                else:
                    req = ProtoOAGetAccountListByAccessTokenReq()
                    req.accessToken = access_token
                    client_ref.send(req)

            # ProtoOAGetAccountListByAccessTokenRes
            elif payload_type == ProtoOAGetAccountListByAccessTokenRes().payloadType:
                accounts = list(extracted.ctidTraderAccount)
                if not accounts:
                    _client_error = RuntimeError("No accounts found for access token")
                    _result_event.set()
                    reactor.stop()
                    return
                account_id = int(accounts[0].ctidTraderAccountId)
                state["ctid_trader_account_id"] = account_id
                state["step"] = "account_list_done"
                req = ProtoOAAccountAuthReq()
                req.ctidTraderAccountId = account_id
                req.accessToken = access_token
                client_ref.send(req)

            # ProtoOAAccountAuthRes
            elif payload_type == ProtoOAAccountAuthRes().payloadType:
                state["step"] = "account_auth_done"
                req = ProtoOATraderReq()
                req.ctidTraderAccountId = state["ctid_trader_account_id"]
                client_ref.send(req)

            # ProtoOATraderRes - we have the account data
            elif payload_type == ProtoOATraderRes().payloadType:
                trader = extracted.trader
                money_digits = getattr(trader, "moneyDigits", 8) or 8
                divisor = 10 ** money_digits
                balance = float(trader.balance) / divisor if trader.balance else 0.0
                manager_bonus = float(getattr(trader, "managerBonus", 0) or 0) / divisor
                ib_bonus = float(getattr(trader, "ibBonus", 0) or 0) / divisor
                non_withdrawable = float(getattr(trader, "nonWithdrawableBonus", 0) or 0) / divisor

                _client_result = {
                    "ctid_trader_account_id": int(trader.ctidTraderAccountId),
                    "balance": balance,
                    "manager_bonus": manager_bonus,
                    "ib_bonus": ib_bonus,
                    "non_withdrawable_bonus": non_withdrawable,
                    "money_digits": money_digits,
                }
                _result_event.set()
                reactor.stop()

        except Exception as e:
            logger.exception("ProtoOA message handling error")
            _client_error = e
            _result_event.set()
            try:
                reactor.stop()
            except Exception:
                pass

    def on_connected(client_ref):
        req = ProtoOAApplicationAuthReq()
        req.clientId = client_id
        req.clientSecret = client_secret
        d = client_ref.send(req)
        d.addErrback(on_error)

    def on_disconnected(client_ref, reason):
        if _client_result is None and _client_error is None:
            _client_error = RuntimeError(f"Disconnected: {reason}")
            _result_event.set()
        try:
            reactor.stop()
        except Exception:
            pass

    client.setConnectedCallback(on_connected)
    client.setDisconnectedCallback(on_disconnected)
    client.setMessageReceivedCallback(on_message_received)

    def run_reactor():
        client.startService()
        reactor.run(installSignalHandlers=0)

    thread = threading.Thread(target=run_reactor, daemon=True)
    thread.start()

    # Wait up to 30 seconds for result
    if not _result_event.wait(timeout=30):
        try:
            reactor.callFromThread(reactor.stop)
        except Exception:
            pass
        thread.join(timeout=2)
        raise RuntimeError("ProtoOA request timed out")

    if _client_error is not None:
        err = _client_error
        if hasattr(err, "value"):
            raise err.value
        if hasattr(err, "getErrorMessage"):
            raise RuntimeError(err.getErrorMessage())
        raise RuntimeError(str(err))

    if _client_result is None:
        raise RuntimeError("No account data received")

    return _client_result


def fetch_account_summary(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
) -> dict:
    """
    Fetch account summary from cTrader via ProtoOA.
    Returns dict aligned with ib_service /account/summary format.
    """
    data = _fetch_account_sync(
        client_id=client_id,
        client_secret=client_secret,
        access_token=access_token,
        ctid_trader_account_id=ctid_trader_account_id,
        account_mode=account_mode,
    )

    balance = data["balance"]
    # For cTrader: balance is the main value; net liquidation = balance + bonuses
    net_liq = balance + data.get("manager_bonus", 0) + data.get("ib_bonus", 0)

    return {
        "account_id": str(data["ctid_trader_account_id"]),
        "net_liquidation": net_liq,
        "NetLiquidation": net_liq,
        "currency": "USD",  # cTrader uses deposit asset; we default USD
        "total_cash_value": balance,
        "TotalCashValue": balance,
        "buying_power": balance,
        "BuyingPower": balance,
        "maintenance_margin": 0,
        "MaintMarginReq": 0,
    }


def _run_protooa_sync(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    request_type: str,
    extra_params: Optional[dict] = None,
) -> Any:
    """
    Generic ProtoOA runner. After auth, sends request based on request_type and returns result.
    request_type: 'trader'|'reconcile'|'symbols'|'trendbars'|'spot'
    """
    global _client_result, _client_error, _result_event

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
        )
        from twisted.internet import reactor
    except ImportError as e:
        raise RuntimeError(f"ctrader-open-api not installed: {e}") from e

    with _lock:
        _client_result = None
        _client_error = None
        _result_event.clear()

    host = EndPoints.PROTOBUF_LIVE_HOST if account_mode.lower() == "live" else EndPoints.PROTOBUF_DEMO_HOST
    port = EndPoints.PROTOBUF_PORT
    client = Client(host, port, TcpProtocol)
    extra = extra_params or {}
    state = {"step": "init", "ctid_trader_account_id": ctid_trader_account_id}

    def on_error(failure):
        global _client_error
        _client_error = failure
        _result_event.set()
        try:
            reactor.stop()
        except Exception:
            pass

    def on_message_received(client_ref, message):
        global _client_result, _client_error, _result_event
        try:
            payload_type = message.payloadType
            extracted = Protobuf.extract(message)

            if payload_type == ProtoOAApplicationAuthRes().payloadType:
                state["step"] = "app_auth_done"
                if state["ctid_trader_account_id"] is not None:
                    req = ProtoOAAccountAuthReq()
                    req.ctidTraderAccountId = state["ctid_trader_account_id"]
                    req.accessToken = access_token
                    client_ref.send(req)
                else:
                    req = ProtoOAGetAccountListByAccessTokenReq()
                    req.accessToken = access_token
                    client_ref.send(req)

            elif payload_type == ProtoOAGetAccountListByAccessTokenRes().payloadType:
                accounts = list(extracted.ctidTraderAccount)
                if not accounts:
                    _client_error = RuntimeError("No accounts found for access token")
                    _result_event.set()
                    reactor.stop()
                    return
                account_id = int(accounts[0].ctidTraderAccountId)
                state["ctid_trader_account_id"] = account_id
                req = ProtoOAAccountAuthReq()
                req.ctidTraderAccountId = account_id
                req.accessToken = access_token
                client_ref.send(req)

            elif payload_type == ProtoOAAccountAuthRes().payloadType:
                state["step"] = "account_auth_done"
                ctid = state["ctid_trader_account_id"]

                if request_type == "trader":
                    req = ProtoOATraderReq()
                    req.ctidTraderAccountId = ctid
                    client_ref.send(req)
                elif request_type == "reconcile":
                    req = ProtoOAReconcileReq()
                    req.ctidTraderAccountId = ctid
                    client_ref.send(req)
                elif request_type == "symbols":
                    req = ProtoOASymbolsListReq()
                    req.ctidTraderAccountId = ctid
                    client_ref.send(req)
                elif request_type == "trendbars":
                    req = ProtoOAGetTrendbarsReq()
                    req.ctidTraderAccountId = ctid
                    req.symbolId = extra.get("symbol_id", 0)
                    req.period = extra.get("period", 5)
                    if extra.get("from_timestamp") is not None:
                        req.fromTimestamp = extra["from_timestamp"]
                    if extra.get("to_timestamp") is not None:
                        req.toTimestamp = extra["to_timestamp"]
                    if extra.get("count") is not None:
                        req.count = extra["count"]
                    client_ref.send(req)
                elif request_type == "spot":
                    req = ProtoOASubscribeSpotsReq()
                    req.ctidTraderAccountId = ctid
                    req.symbolId.append(extra.get("symbol_id", 0))
                    req.subscribeToSpotTimestamp = True
                    client_ref.send(req)
                elif request_type == "neworder":
                    req = ProtoOANewOrderReq()
                    req.ctidTraderAccountId = ctid
                    req.symbolId = extra.get("symbol_id", 0)
                    req.orderType = extra.get("order_type", 1)  # 1=MARKET
                    req.tradeSide = extra.get("trade_side", 1)  # 1=BUY, 2=SELL
                    req.volume = int(extra.get("volume", 0))  # 0.01 units
                    if extra.get("limit_price") is not None:
                        req.limitPrice = extra["limit_price"]
                    if extra.get("stop_price") is not None:
                        req.stopPrice = extra["stop_price"]
                    client_ref.send(req)
                elif request_type == "cancelorder":
                    req = ProtoOACancelOrderReq()
                    req.ctidTraderAccountId = ctid
                    req.orderId = extra.get("order_id", 0)
                    client_ref.send(req)
                else:
                    _client_error = RuntimeError(f"Unknown request_type: {request_type}")
                    _result_event.set()
                    reactor.stop()

            elif payload_type == ProtoOATraderRes().payloadType and request_type == "trader":
                trader = extracted.trader
                money_digits = getattr(trader, "moneyDigits", 8) or 8
                divisor = 10 ** money_digits
                _client_result = {
                    "ctid_trader_account_id": int(trader.ctidTraderAccountId),
                    "balance": float(trader.balance) / divisor if trader.balance else 0.0,
                    "manager_bonus": float(getattr(trader, "managerBonus", 0) or 0) / divisor,
                    "ib_bonus": float(getattr(trader, "ibBonus", 0) or 0) / divisor,
                    "non_withdrawable_bonus": float(getattr(trader, "nonWithdrawableBonus", 0) or 0) / divisor,
                    "money_digits": money_digits,
                }
                _result_event.set()
                reactor.stop()

            elif payload_type == ProtoOAReconcileRes().payloadType and request_type == "reconcile":
                positions = []
                for p in list(extracted.position):
                    td = p.tradeData
                    vol = getattr(td, "volume", 0) or 0
                    pos = 1 if (getattr(td, "tradeSide", 1) == 1) else -1  # BUY=1, SELL=2
                    money_digits = getattr(p, "moneyDigits", 8) or 8
                    div = 10 ** money_digits
                    positions.append({
                        "position_id": int(p.positionId),
                        "symbol_id": int(td.symbolId) if hasattr(td, "symbolId") else 0,
                        "position": pos * (vol / 100.0),
                        "volume": vol / 100.0,
                        "price": float(p.price) if p.price else 0,
                        "swap": float(p.swap) / div if p.swap else 0,
                        "commission": float(getattr(p, "commission", 0) or 0) / div,
                    })
                orders = []
                for o in list(extracted.order):
                    orders.append({
                        "order_id": int(o.orderId),
                        "symbol_id": int(o.tradeData.symbolId) if hasattr(o, "tradeData") else 0,
                        "volume": (getattr(o.tradeData, "volume", 0) or 0) / 100.0,
                        "trade_side": getattr(o.tradeData, "tradeSide", 1),
                        "order_type": getattr(o, "orderType", 1),
                        "status": getattr(o, "orderStatus", 1),
                    })
                _client_result = {"positions": positions, "orders": orders}
                _result_event.set()
                reactor.stop()

            elif payload_type == ProtoOASymbolsListRes().payloadType and request_type == "symbols":
                symbols = []
                for s in list(extracted.symbol):
                    symbols.append({
                        "symbol_id": int(s.symbolId),
                        "name": getattr(s, "symbolName", "") or "",
                        "display_name": getattr(s, "displayName", "") or "",
                    })
                for s in list(getattr(extracted, "archivedSymbol", [])):
                    symbols.append({
                        "symbol_id": int(s.symbolId),
                        "name": getattr(s, "symbolName", "") or "",
                        "display_name": getattr(s, "displayName", "") or "",
                        "archived": True,
                    })
                _client_result = {"symbols": symbols}
                _result_event.set()
                reactor.stop()

            elif payload_type == ProtoOAGetTrendbarsRes().payloadType and request_type == "trendbars":
                bars = []
                digits = 5  # Price in 1/100000 of unit for forex
                price_div = 10 ** digits
                for tb in list(extracted.trendbar):
                    ts_min = getattr(tb, "utcTimestampInMinutes", 0) or 0
                    low = float(getattr(tb, "low", 0) or 0) / price_div
                    delta_open = float(getattr(tb, "deltaOpen", 0) or 0) / price_div
                    delta_high = float(getattr(tb, "deltaHigh", 0) or 0) / price_div
                    delta_close = float(getattr(tb, "deltaClose", 0) or 0) / price_div
                    open_val = low + delta_open
                    high = low + delta_high
                    close = low + delta_close
                    vol = int(getattr(tb, "volume", 0) or 0)
                    bars.append({
                        "timestamp": ts_min * 60 * 1000,
                        "open": open_val, "high": high, "low": low, "close": close,
                        "volume": vol,
                    })
                _client_result = {"bars": bars, "symbol_id": getattr(extracted, "symbolId", 0)}
                _result_event.set()
                reactor.stop()

            elif payload_type == ProtoOASpotEvent().payloadType and request_type == "spot":
                digits = 5
                bid = float(getattr(extracted, "bid", 0) or 0) / (10 ** digits)
                ask = float(getattr(extracted, "ask", 0) or 0) / (10 ** digits)
                _client_result = {
                    "symbol_id": int(extracted.symbolId),
                    "bid": bid, "ask": ask,
                    "timestamp": getattr(extracted, "timestamp", 0) or int(time.time() * 1000),
                }
                _result_event.set()
                reactor.stop()

            elif payload_type == ProtoOAExecutionEvent().payloadType and request_type in ("neworder", "cancelorder"):
                order_id = 0
                if extracted.order:
                    order_id = int(getattr(extracted.order, "orderId", 0) or 0)
                if order_id == 0 and request_type == "cancelorder":
                    order_id = extra.get("order_id", 0)
                _client_result = {
                    "success": True,
                    "order_id": order_id,
                    "execution_type": getattr(extracted, "executionType", 0),
                }
                _result_event.set()
                reactor.stop()

            elif payload_type == ProtoOAOrderErrorEvent().payloadType and request_type in ("neworder", "cancelorder"):
                _client_error = RuntimeError(
                    getattr(extracted, "description", None) or getattr(extracted, "errorCode", "ORDER_ERROR")
                )
                _result_event.set()
                reactor.stop()

        except Exception as e:
            logger.exception("ProtoOA message handling error")
            _client_error = e
            _result_event.set()
            try:
                reactor.stop()
            except Exception:
                pass

    def on_connected(client_ref):
        req = ProtoOAApplicationAuthReq()
        req.clientId = client_id
        req.clientSecret = client_secret
        d = client_ref.send(req)
        d.addErrback(on_error)

    def on_disconnected(client_ref, reason):
        if _client_result is None and _client_error is None:
            _client_error = RuntimeError(f"Disconnected: {reason}")
            _result_event.set()
        try:
            reactor.stop()
        except Exception:
            pass

    client.setConnectedCallback(on_connected)
    client.setDisconnectedCallback(on_disconnected)
    client.setMessageReceivedCallback(on_message_received)

    def run_reactor():
        client.startService()
        reactor.run(installSignalHandlers=0)

    thread = threading.Thread(target=run_reactor, daemon=True)
    thread.start()

    if not _result_event.wait(timeout=30):
        try:
            reactor.callFromThread(reactor.stop)
        except Exception:
            pass
        thread.join(timeout=2)
        raise RuntimeError("ProtoOA request timed out")

    if _client_error is not None:
        err = _client_error
        if hasattr(err, "value"):
            raise err.value
        if hasattr(err, "getErrorMessage"):
            raise RuntimeError(err.getErrorMessage())
        raise RuntimeError(str(err))

    if _client_result is None:
        raise RuntimeError("No response received")

    return _client_result


def fetch_positions(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    symbol_id_to_name: Optional[dict] = None,
) -> List[dict]:
    """C5: Fetch positions via ProtoOAReconcileReq."""
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "reconcile",
    )
    positions = data.get("positions", [])
    sid_map = symbol_id_to_name or {}
    for p in positions:
        p["symbol"] = sid_map.get(p.get("symbol_id"), f"#{p.get('symbol_id', '')}")
    return positions


def fetch_orders(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    symbol_id_to_name: Optional[dict] = None,
) -> List[dict]:
    """C6: Fetch orders via ProtoOAReconcileReq."""
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "reconcile",
    )
    orders = data.get("orders", [])
    sid_map = symbol_id_to_name or {}
    for o in orders:
        o["symbol"] = sid_map.get(o.get("symbol_id"), f"#{o.get('symbol_id', '')}")
    return orders


def fetch_symbols_list(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
) -> List[dict]:
    """C9: Fetch symbols via ProtoOASymbolsListReq."""
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "symbols",
    )
    return data.get("symbols", [])


def fetch_trendbars(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    symbol_id: int,
    timeframe: str,
    from_timestamp_ms: Optional[int] = None,
    to_timestamp_ms: Optional[int] = None,
    count: Optional[int] = None,
) -> List[dict]:
    """C7: Fetch historical bars via ProtoOAGetTrendbarsReq."""
    period = TIMEFRAME_TO_PERIOD.get(timeframe.lower(), 5)
    params = {"symbol_id": symbol_id, "period": period}
    if from_timestamp_ms is not None:
        params["from_timestamp"] = from_timestamp_ms
    if to_timestamp_ms is not None:
        params["to_timestamp"] = to_timestamp_ms
    if count is not None:
        params["count"] = min(count, 1000)
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "trendbars",
        extra_params=params,
    )
    return data.get("bars", [])


def fetch_spot(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    symbol_id: int,
) -> dict:
    """C8: Fetch current quote via ProtoOASubscribeSpotsReq + first ProtoOASpotEvent."""
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "spot",
        extra_params={"symbol_id": symbol_id},
    )
    return data


# Order type mapping: our format -> ProtoOAOrderType (1=MARKET, 2=LIMIT, 3=STOP, 6=STOP_LIMIT)
ORDER_TYPE_MAP = {
    "MARKET": 1, "market": 1, "MKT": 1,
    "LIMIT": 2, "limit": 2, "LMT": 2,
    "STOP": 3, "stop": 3, "STP": 3,
    "STOP_LIMIT": 6, "stop_limit": 6, "STP_LMT": 6,
    "MARKET_RANGE": 5,
}


def place_order(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    symbol_id: int,
    action: str,
    quantity: float,
    order_type: str = "MARKET",
    limit_price: Optional[float] = None,
    stop_price: Optional[float] = None,
) -> dict:
    """
    C6: Place order via ProtoOANewOrderReq.
    action: BUY|SELL, quantity in lots, volume sent as int(quantity * 100).
    Returns dict with order_id, success.
    """
    trade_side = 1 if str(action).upper() in ("BUY", "B") else 2
    otype = ORDER_TYPE_MAP.get(order_type.upper(), 1)
    volume_cents = int(round(quantity * 100))  # 10.0 lots -> 1000
    if volume_cents <= 0:
        raise ValueError("Quantity must be positive")
    params = {
        "symbol_id": symbol_id,
        "trade_side": trade_side,
        "volume": volume_cents,
        "order_type": otype,
    }
    if limit_price is not None:
        params["limit_price"] = limit_price
    if stop_price is not None:
        params["stop_price"] = stop_price
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "neworder",
        extra_params=params,
    )
    return data


def cancel_order(
    client_id: str,
    client_secret: str,
    access_token: str,
    ctid_trader_account_id: Optional[int],
    account_mode: str,
    order_id: int,
) -> dict:
    """C6: Cancel order via ProtoOACancelOrderReq."""
    data = _run_protooa_sync(
        client_id, client_secret, access_token,
        ctid_trader_account_id, account_mode,
        "cancelorder",
        extra_params={"order_id": order_id},
    )
    return data
