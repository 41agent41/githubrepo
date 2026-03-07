# TradingApp – Remaining Functionality Plan

**Purpose:** Capture what is left to build so the plan can be used for prioritisation and implementation later.  
**Based on:** Codebase review and `/docs` (MULTI_BROKER_ARCHITECTURE_REVIEW.md, CTRADER_INTEGRATION_PLAN.md) and root docs (0-README, 3-FEATURES).  
**Last updated:** March 2025

---

## 1. Summary of Current State

### 1.1 Implemented

- **Multi-broker backbone:** BrokerFactory, IBBroker, broker selection middleware, `getBrokerServiceUrl(brokerType)`, account and market-data routes via broker abstraction, BrokerConnectionResolver, shared Python (indicators, backtesting, models), `broker_order_id` rename.
- **cTrader scaffolding:** CTraderBroker (TypeScript), ctrader_service (Python FastAPI with stub endpoints), ctrader_connection_profiles table, ctraderConnectionService, `/api/ctrader-connections` routes, Connections page with “IB Connections” and “cTrader Connections” tabs.
- **Core features:** Download (single/bulk/validation/health), DB connectivity test, trading setup & chart spawning, TradingView charts (multiple timeframes), market data filter, account dashboard, strategies, order placement/history, system settings, IB connection management.

### 1.2 Gaps (High Level)

- cTrader is **stub-only**: no real OAuth, no real cTrader Open API (ProtoOA) calls.
- WebSocket and health are **IB-only**; not broker-agnostic.
- **3-FEATURES.md “Advanced Features”** (watchlists, portfolio integration, market scanning, data export) are largely **not implemented**.
- **MT5** is explicitly not implemented (throws NOT_IMPLEMENTED).
- **OAuth callback** for cTrader and optional **broker selector** in UI are pending.

---

## 2. cTrader Integration (Complete Real Implementation)

**Ref:** `docs/CTRADER_INTEGRATION_PLAN.md`, `ctrader_service/main.py` (stubs/TODOs).

| # | Task | Description | Priority |
|---|-----|-------------|----------|
| C1 | OAuth flow in ctrader_service | Implement OAuth code exchange and token storage using ctrader-open-api (replace TODO in `connection_connect`). | High |
| C2 | OAuth callback in frontend | Add route/page for redirect (e.g. `/connections/ctrader/callback`) to receive auth code and pass to backend; persist tokens via ctrader-connections API. | High |
| C3 | Token refresh | Refresh access token before expiry (background job or on-demand); store refreshed tokens in `ctrader_connection_profiles`. | High |
| C4 | Account data (real) | Replace account stubs with ProtoOAGetAccountListReq / cash flow (or REST equivalent) in ctrader_service. | High |
| C5 | Positions (real) | Implement ProtoOAGetPositionListReq in ctrader_service; map to BrokerPosition. | High |
| C6 | Orders (real) | Implement ProtoOAGetOrderListReq, ProtoOANewOrderReq, ProtoOACancelOrderReq in ctrader_service. | High |
| C7 | Historical data (real) | Implement ProtoOAGetTrendbarsReq in ctrader_service; map timeframes to cTrader format. | High |
| C8 | Real-time quotes (real) | Implement ProtoOASubscribeSpotsReq + spot updates (or REST) in ctrader_service. | Medium |
| C9 | Contract/symbol search (real) | Implement ProtoOAGetSymbolsListReq / symbol search in ctrader_service; map to BrokerContract. | Medium |
| C10 | Symbol mapping | Harden `toBrokerSymbol` / `toCanonicalSymbol` (e.g. config or DB table) for forex, CFDs, indices (see CTRADER_INTEGRATION_PLAN §7). | Medium |

---

## 3. Multi-Broker Consistency (Backend)

**Ref:** `docs/MULTI_BROKER_ARCHITECTURE_REVIEW.md`; `backend/src/index.ts` still uses IB-only patterns.

| # | Task | Description | Priority |
|---|-----|-------------|----------|
| M1 | WebSocket broker selection | Replace direct `getIBServiceUrl()` in Socket.IO handlers (`subscribe-market-data`, `unsubscribe-market-data`) with broker-aware logic (e.g. from request/session or default broker); call appropriate broker service for subscribe/unsubscribe. | High |
| M2 | Health endpoint multi-broker | Extend `/api/health` to report status of all configured broker services (IB, cTrader, and optionally MT5), not only IB. | Medium |
| M3 | Optional: MT5 broker | Implement MT5 broker service and wire in BrokerFactory (low priority unless MT5 is required). | Low |

---

## 4. Frontend – Broker Selection & cTrader UX

**Ref:** CTRADER_INTEGRATION_PLAN Phase 4.

| # | Task | Description | Priority |
|---|-----|-------------|----------|
| F1 | Broker selector (Account / Trading) | Add UI to choose broker (IB vs cTrader) on Account and Trading/Chart flows; pass `?broker=IB|CTRADER` (or equivalent) to API. | Medium |
| F2 | cTrader connection status | Show cTrader connection status (and errors) clearly on Connections page and, if relevant, in header/context. | Medium |
| F3 | Generalise connection context | Consider BrokerConnectionContext (or extend IBConnectionContext) to support multiple brokers for status and broker selection. | Low |

---

## 5. Advanced Features (from 3-FEATURES.md)

**Ref:** `3-FEATURES.md` § “Advanced Features”. These are **not** implemented in codebase.

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| A1 | Custom watchlists | Create/save/watchlist of symbols; categorise; optional price alerts; optional sharing. | Medium |
| A2 | Portfolio integration | Deeper than current account view: position tracking, P&L over time, risk metrics (e.g. position sizing), performance analytics (returns, drawdown). | Medium |
| A3 | Market scanning | Custom scans (criteria on symbols); pre-built scan templates; alerts when scan conditions hit; optional backtesting of scan rules. | Low |
| A4 | Data export | Export market/account data as CSV and JSON; optional PDF reports (e.g. account summary, P&L). Note: system settings export and some “export” UI exist; full data export as in 3-FEATURES is not. | Medium |

---

## 6. API & Data Gaps

**Ref:** `backend/src/database/docs/ARCHITECTURE.md` documents endpoints that may not be implemented.

| # | Task | Description | Priority |
|---|-----|-------------|----------|
| D1 | Tick data endpoint | Implement `GET /api/market-data/ticks` (or equivalent) for tick_data hypertable if required for downstream features. | Low |
| D2 | Contracts API | Implement `GET /api/contracts`, `GET /api/contracts/search` (or align with existing contract search under market-data) and document in one place. | Low |

---

## 7. Search & Discovery (3-FEATURES)

**Ref:** 3-FEATURES.md § “Search & Discovery”. Partially covered by MarketDataFilter; below are optional enhancements.

| # | Task | Description | Priority |
|---|-----|-------------|----------|
| S1 | Sector browsing | Browse symbols by sector/industry (if provided by broker or internal taxonomy). | Low |
| S2 | Trending assets | Simple “trending” or “most active” list (e.g. by volume or change). | Low |

---

## 8. Suggested Implementation Order

1. **cTrader E2E (high):** C1 → C2 → C3 (OAuth + callback + refresh), then C4–C7 (account, positions, orders, history).
2. **Multi-broker consistency (high):** M1 (WebSocket broker-aware), then M2 (health).
3. **cTrader UX (medium):** C8–C10, F1–F2 (quotes, symbol search, mapping, broker selector, status).
4. **Advanced features (medium/low):** A1, A4, then A2; A3 and S1–S2 as capacity allows.
5. **API/data (low):** D1, D2 if product needs tick or contract APIs.
6. **MT5 (optional):** M3 only if MT5 is a requirement.

---

## 9. Quick Reference – Where to Look

| Area | Key files / locations |
|------|------------------------|
| cTrader service (stubs) | `ctrader_service/main.py` (TODOs) |
| cTrader backend | `backend/src/services/brokers/CTraderBroker.ts`, `backend/src/services/ctraderConnectionService.ts`, `backend/src/routes/ctraderConnections.ts` |
| WebSocket (IB-only) | `backend/src/index.ts` – `subscribe-market-data`, `unsubscribe-market-data`, `getIBServiceUrl()` |
| Health (IB-only) | `backend/src/index.ts` – `/api/health` |
| Connections UI | `frontend/app/connections/page.tsx` (IB + cTrader tabs) |
| Account / trading UI | `frontend/app/account/page.tsx`, chart/configure pages – no broker selector yet |
| Features doc | `3-FEATURES.md` (Advanced Features, Search & Discovery) |
| Multi-broker design | `docs/MULTI_BROKER_ARCHITECTURE_REVIEW.md`, `docs/CTRADER_INTEGRATION_PLAN.md` |

---

*Use this document for sprint planning, backlog grooming, or when resuming work on TradingApp.*
