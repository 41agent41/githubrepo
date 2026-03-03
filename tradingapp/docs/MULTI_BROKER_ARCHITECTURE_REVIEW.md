# Multi-Broker Architecture Review & Recommendations

**TradingApp Project** | March 2025

---

## Executive Summary

The TradingApp codebase has a **solid foundation** for multi-broker support with `IBrokerService`, `BrokerFactory`, and `BaseBrokerService`. However, **significant architectural gaps** exist: routes bypass the broker abstraction, connection management is IB-specific, and common components in `ib_service` are not positioned for reuse. This document provides a detailed review and phased recommendations.

---

## 1. Current Architecture Assessment

### 1.1 What Works Well

| Component | Location | Assessment |
|-----------|----------|------------|
| **IBrokerService** | `backend/src/services/brokers/IBrokerService.ts` | Well-designed interface; comprehensive method coverage |
| **BaseBrokerService** | Same file | Good shared logic (callbacks, getAccountData, handleHttpError) |
| **BrokerFactory** | `backend/src/services/brokers/BrokerFactory.ts` | Factory pattern in place; MT5/CTRADER placeholders |
| **Broker types** | `backend/src/types/broker.ts` | Canonical types defined; `BrokerType` includes all three |
| **orderService** | `backend/src/services/orderService.ts` | Uses `getDefaultBroker()` correctly |
| **marketDataCollector** | `backend/src/services/marketDataCollector.ts` | Uses `getDefaultBroker()` correctly |
| **IBBroker** | `backend/src/services/brokers/IBBroker.ts` | Clean HTTP adapter to ib_service |

### 1.2 Critical Gaps

| Gap | Impact | Location |
|-----|--------|----------|
| **Routes bypass broker abstraction** | Account and market data routes call `ib_service` directly via `getIBServiceUrl()`; no multi-broker support | `account.ts`, `marketData.ts`, `index.ts` |
| **IB-centric runtime config** | Only `getIBServiceUrl()`; no `getBrokerServiceUrl(brokerType)` | `runtimeConfig.ts` |
| **IB-specific connection management** | `ibConnectionService`, `ib_connection_profiles`; no unified broker connection layer | `ibConnectionService.ts` |
| **No broker selection at API level** | Frontend/API cannot specify which broker to use | All routes |
| ~~**orderService uses `ibOrderId`**~~ | ~~Field name is IB-specific~~ → **Resolved:** renamed to `brokerOrderId` | `orderService.ts` |

### 1.3 Code Duplication & Anti-Patterns

| Issue | Occurrences | Recommendation |
|-------|-------------|----------------|
| **Error handling** | Same ECONNREFUSED/ETIMEDOUT/response logic in account.ts, marketData.ts | Extract to `handleBrokerHttpError()` in BaseBrokerService or shared util |
| **Direct axios to ib_service** | 15+ calls in account.ts, marketData.ts, index.ts | Route through BrokerFactory → IBBroker |
| **`isDataQueryEnabled` / `handleDisabledDataQuery`** | Duplicated in account.ts, marketData.ts | Extract to shared middleware or util |
| **IB service URL hardcoded** | Multiple files | Centralize via `getBrokerServiceUrl(brokerType)` |

---

## 2. ib_service Structure Analysis

### 2.1 Current Layout

```
ib_service/
├── main.py          # ~3,800 lines – monolithic IB TWS API wrapper
├── indicators.py   # Technical analysis (broker-agnostic)
└── backtesting.py  # Backtesting engine (broker-agnostic)
```

### 2.2 Components That Should Be Architecturally Higher

| Component | Current Location | Recommendation |
|-----------|------------------|----------------|
| **indicators.py** | `ib_service/` | Move to `shared/` or `common/indicators/` – used by any broker’s market data |
| **backtesting.py** | `ib_service/` | Move to `shared/` or `common/backtesting/` – strategy testing is broker-agnostic |
| **CandlestickBar, HistoricalDataResponse** | Pydantic models in main.py | Define canonical types in shared package; each broker service maps to them |
| **Symbol mapping logic** | IBBroker.toBrokerSymbol/toCanonicalSymbol | Consider `SymbolMappingService` at backend level for cross-broker mapping |

### 2.3 ib_service Monolith

`main.py` contains:

- FastAPI app setup
- IB TWS API (EClient/EWrapper)
- Connection, account, orders, market data, contract search
- Technical indicators integration
- Backtesting endpoints

**Recommendation:** Keep `ib_service` as the IB-specific adapter. Do **not** split it into a generic “broker service” – cTrader/MT5 should have their own services. Instead:

1. Extract **indicators** and **backtesting** to a shared Python package.
2. Have each broker service (ib_service, ctrader_service) depend on that shared package.
3. Ensure each service exposes REST endpoints aligned with `IBrokerService` (see CTRADER_INTEGRATION_PLAN.md).

---

## 3. BrokerFactory & Higher-Level Architecture

### 3.1 Current BrokerFactory Role

- Creates/caches `IBBrokerService` instances
- Uses `getIBServiceUrl()` for IB
- `getDefaultBroker()` returns IB (or env `DEFAULT_BROKER`)
- MT5/CTRADER throw `NOT_IMPLEMENTED`

### 3.2 Recommended Enhancements

| Enhancement | Description |
|-------------|-------------|
| **`getBrokerServiceUrl(brokerType)`** | Add to runtimeConfig; BrokerFactory uses it instead of broker-specific getters |
| **`getBroker(brokerType, connectionProfileId?)`** | Optional profile for multi-account scenarios |
| **Broker selection from request** | `?broker=CTRADER` or `X-Broker: CTRADER`; fallback to default |
| **Connection profile resolution** | BrokerFactory resolves active profile per broker type |

### 3.3 Proposed Broker Resolution Flow

```
Request (account, market data, orders)
    → Parse broker from query/header (or use default)
    → BrokerFactory.getBroker(brokerType)
    → IBBroker | CTraderBroker | MT5Broker
    → broker.getAccountSummary() / getHistoricalData() / etc.
```

---

## 4. Connection Management Architecture

### 4.1 Current State

- **IB:** `ib_connection_profiles` table, `ibConnectionService`, `/api/ib-connections/*`
- **cTrader (planned):** `ctrader_connection_profiles`, OAuth tokens
- **MT5:** Not defined

### 4.2 Recommendation: Unified Broker Connection Layer

Introduce a **BrokerConnectionService** that:

1. Abstracts over broker-specific connection services
2. Uses a unified `broker_connection_profiles` table (or a view over broker-specific tables)
3. Exposes `getActiveConnection(brokerType)` → profile + credentials
4. Delegates to `ibConnectionService`, `ctraderConnectionService`, etc.

**Schema option (unified):**

```sql
-- Option A: Single table with broker_type discriminator
CREATE TABLE broker_connection_profiles (
  id SERIAL PRIMARY KEY,
  broker_type VARCHAR(20) NOT NULL,  -- 'IB', 'CTRADER', 'MT5'
  name VARCHAR(100) NOT NULL,
  account_mode VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  config JSONB NOT NULL,  -- Broker-specific: host/port for IB, tokens for cTrader
  ...
);
```

**Option B (recommended for minimal migration):** Keep `ib_connection_profiles`, `ctrader_connection_profiles` as-is, and add a **BrokerConnectionResolver** that routes by `brokerType` to the correct service.

---

## 5. Route Refactoring Plan

### 5.1 Routes to Refactor

| Route File | Endpoints | Current Behavior | Target Behavior |
|------------|-----------|------------------|-----------------|
| **account.ts** | /summary, /positions, /orders, /all, /connection | Direct axios to ib_service | Use `brokerFactory.getBroker(broker).getAccountSummary()` etc. |
| **marketData.ts** | /search, /search/advanced, /history, /realtime, /indicators, /bulk-collect, /stream | Direct axios to ib_service | Use broker abstraction; support `?broker=IB\|CTRADER` |
| **index.ts** | WebSocket subscribe/unsubscribe, health | Direct axios to ib_service | Route via broker or add broker-aware health |

### 5.2 Broker Selection Mechanism

**Option 1 – Query parameter (recommended):**

```
GET /api/account/summary?broker=IB
GET /api/market-data/history?symbol=AAPL&timeframe=5min&broker=CTRADER
```

**Option 2 – Header:**

```
X-Broker: CTRADER
```

**Option 3 – Default only:**

- Use `DEFAULT_BROKER` env; no per-request override initially.

**Recommendation:** Implement Option 1 first; add Option 2 if needed for programmatic clients.

---

## 6. Shared Components Extraction Plan

### 6.1 Python (ib_service / future ctrader_service)

| Component | Action | New Location |
|-----------|--------|--------------|
| **indicators.py** | Extract | `tradingapp/shared/indicators/` or `tradingapp/common/` |
| **backtesting.py** | Extract | `tradingapp/shared/backtesting/` |
| **CandlestickBar, etc.** | Define canonical models | `tradingapp/shared/models.py` |
| **ib_service** | Add dependency | `from tradingapp.shared.indicators import ...` |

### 6.2 TypeScript (backend)

| Component | Action | New Location |
|-----------|--------|--------------|
| **HTTP error handling** | Extract from BaseBrokerService | `handleBrokerHttpError()` in broker utils or BaseBrokerService |
| **Broker selection middleware** | Create | `middleware/brokerSelection.ts` – parses `req.query.broker` or `req.headers['x-broker']` |
| **getBrokerServiceUrl(brokerType)** | Add | `runtimeConfig.ts` |

---

## 7. Phased Implementation Plan

### Phase 1: Unify Routes Through Broker Abstraction (High Priority)

| Task | Description | Effort |
|------|-------------|--------|
| 1.1 | Add `getBrokerServiceUrl(brokerType)` to runtimeConfig | S |
| 1.2 | Add broker selection middleware (query param `broker`) | S |
| 1.3 | Refactor `account.ts` to use `brokerFactory.getBroker(broker).getAccountSummary()` etc. | M |
| 1.4 | Refactor `marketData.ts` to use broker abstraction for all ib_service calls | L |
| 1.5 | Update `index.ts` WebSocket/health to support broker or default | M |
| 1.6 | Rename `ibOrderId` → `brokerOrderId` in orderService and DB | S |

**Outcome:** All account and market data flows go through BrokerFactory. Adding CTraderBroker will automatically enable cTrader for these routes.

---

### Phase 2: Extract Shared Python Components (Medium Priority)

| Task | Description | Effort |
|------|-------------|--------|
| 2.1 | Create `tradingapp/shared/` (or `common/`) package | S |
| 2.2 | Move `indicators.py` to shared package | S |
| 2.3 | Move `backtesting.py` to shared package | S |
| 2.4 | Define canonical CandlestickBar/HistoricalDataResponse in shared | S |
| 2.5 | Update ib_service to import from shared | S |
| 2.6 | Add shared package to ctrader_service when created | S |

**Outcome:** indicators and backtesting are reusable by any broker service.

---

### Phase 3: Unified Connection Management (Medium Priority)

| Task | Description | Effort |
|------|-------------|--------|
| 3.1 | Create `BrokerConnectionResolver` that routes by brokerType | M |
| 3.2 | Add `getActiveConnection(brokerType)` returning profile + config | M |
| 3.3 | Wire BrokerFactory to use resolver for connection config | M |
| 3.4 | (Optional) Migrate to unified `broker_connection_profiles` table | L |

**Outcome:** Connection management is broker-agnostic at the API layer.

---

### Phase 4: cTrader Integration (Per CTRADER_INTEGRATION_PLAN)

| Task | Description |
|------|-------------|
| 4.1 | Create ctrader_service (Python FastAPI) |
| 4.2 | Implement CTraderBroker.ts |
| 4.3 | Add getCTraderServiceUrl(), wire BrokerFactory |
| 4.4 | ctrader_connection_profiles, OAuth flow |
| 4.5 | Extend /connections UI for cTrader |

**Outcome:** Multi-broker support with IB and cTrader.

---

## 8. Recommended File Structure (Target State)

```
tradingapp/
├── shared/                          # NEW: Broker-agnostic Python
│   ├── __init__.py
│   ├── indicators/
│   │   ├── __init__.py
│   │   └── calculator.py
│   ├── backtesting/
│   │   ├── __init__.py
│   │   └── engine.py
│   └── models.py                    # CandlestickBar, etc.
├── ib_service/
│   ├── main.py                      # IB-specific only
│   └── requirements.txt            # + shared package
├── ctrader_service/                 # Future
│   ├── main.py
│   └── requirements.txt            # + shared package
├── backend/
│   └── src/
│       ├── config/
│       │   └── runtimeConfig.ts     # + getBrokerServiceUrl(brokerType)
│       ├── middleware/
│       │   └── brokerSelection.ts   # NEW
│       ├── routes/
│       │   ├── account.ts           # Uses broker abstraction
│       │   └── marketData.ts        # Uses broker abstraction
│       └── services/
│           ├── brokers/
│           │   ├── BrokerFactory.ts
│           │   ├── IBBroker.ts
│           │   └── CTraderBroker.ts # Future
│           ├── brokerConnectionResolver.ts  # NEW
│           ├── ibConnectionService.ts
│           └── ctraderConnectionService.ts # Future
```

---

## 9. Summary of Recommendations

| # | Recommendation | Priority | Status |
|---|----------------|----------|--------|
| 1 | Refactor account.ts and marketData.ts to use BrokerFactory instead of direct ib_service calls | **High** | **Done** |
| 2 | Add `getBrokerServiceUrl(brokerType)` and broker selection (query param) | **High** | **Done** |
| 3 | Extract indicators.py and backtesting.py to shared Python package | **Medium** | **Done** |
| 4 | Create BrokerConnectionResolver for unified connection resolution | **Medium** | **Done** |
| 5 | Rename ibOrderId → brokerOrderId across codebase | **Medium** | **Done** |
| 6 | Add broker selection middleware | **Medium** | **Done** |
| 7 | Implement CTraderBroker and ctrader_service per CTRADER_INTEGRATION_PLAN | **As planned** | **Done** |

---

## 10. Quick Reference: Current vs. Target

| Aspect | Current | Target |
|--------|---------|--------|
| Account data | Direct axios → ib_service | broker.getAccountSummary() |
| Market data | Direct axios → ib_service | broker.getHistoricalData(), etc. |
| Broker config | getIBServiceUrl() only | getBrokerServiceUrl(brokerType) |
| Connection mgmt | ibConnectionService only | BrokerConnectionResolver → broker-specific service |
| Indicators/backtest | In ib_service | shared/ package |
| Broker selection | None | ?broker=IB\|CTRADER |

---

*This document should be read alongside `docs/CTRADER_INTEGRATION_PLAN.md` for the full multi-broker roadmap.*

---

## Implementation Log: Recommendation 1 (Completed)

**Date:** March 2025

### Changes Made

1. **`backend/src/middleware/brokerSelection.ts`** (new)
   - `getBrokerFromRequest(req)` – parses `?broker=` or `X-Broker:` header, defaults to `'IB'`

2. **`backend/src/utils/routeUtils.ts`** (new)
   - `isDataQueryEnabled()`, `handleDisabledDataQuery()` – shared route helpers
   - `getBrokerErrorResponse()` – unified broker/HTTP error handling

3. **`backend/src/routes/account.ts`** (refactored)
   - All 5 endpoints now use `brokerFactory.getBroker(brokerType)`:
     - `/summary` → `broker.getAccountSummary()`
     - `/positions` → `broker.getPositions()`
     - `/orders` → `broker.getOrders()`
     - `/all` → `broker.getAccountData()`
     - `/connection` → `broker.getConnectionStatus()`
   - Broker selection via `?broker=IB` or `X-Broker: IB`
   - Response mappers added for API compatibility (snake_case)

4. **`backend/src/routes/marketData.ts`** (refactored)
   - All broker-dependent endpoints now use `brokerFactory.getBroker(brokerType)`:
     - `/search` → `broker.searchContracts()`
     - `/search/advanced` → `broker.searchContractsAdvanced()`
     - `/history` (gap fill + fallback) → `broker.getHistoricalData()`
     - `/realtime` → `broker.getQuote()`
     - `/indicators` (fallback) → broker service URL
     - `/bulk-collect` → `broker.getHistoricalData()` per symbol/timeframe
     - `/stream` → `broker.getQuote()`
     - `/health` → `broker.healthCheck()`
   - Removed all direct `getIBServiceUrl()` / axios calls for broker data

---

## Implementation Log: Recommendation 2 (Completed)

**Date:** March 2025

### Changes Made

1. **`backend/src/config/runtimeConfig.ts`**
   - Added `getBrokerServiceUrl(brokerType: BrokerType): string` – resolves URL from System Settings → env → defaults
   - Added `BROKER_SERVICE_DEFAULTS`, `BROKER_SERVICE_ENV_KEYS`, `BROKER_SERVICE_SETTINGS_KEYS` for IB, MT5, CTRADER
   - Kept `getIBServiceUrl()` as deprecated wrapper calling `getBrokerServiceUrl('IB')` for backwards compatibility

2. **`backend/src/services/brokers/BrokerFactory.ts`**
   - Switched from `getIBServiceUrl()` and env vars to `getBrokerServiceUrl(brokerType)`
   - `createBroker()` uses `config?.serviceUrl ?? getBrokerServiceUrl(brokerType)` so overrides and fresh config both work

3. **`backend/src/database/migration-broker-service-urls.sql`** (new)
   - Adds `ctrader_service_url` and `mt5_service_url` to system_settings for UI configuration

---

## Implementation Log: Recommendation 3 (Completed)

**Date:** March 2025

### Changes Made

1. **`tradingapp/shared/`** (new package)
   - `__init__.py` – package root
   - `indicators/__init__.py`, `indicators/calculator.py` – TechnicalIndicators, IndicatorCalculator, calculator
   - `backtesting/__init__.py`, `backtesting/engine.py` – BacktestEngine, TradingStrategy, SimpleMAStrategy, RSIStrategy, backtest_engine, AVAILABLE_STRATEGIES
   - `models.py` – CandlestickBar, HistoricalDataResponse (canonical Pydantic models)
   - `requirements.txt` – pandas, numpy, pydantic

2. **`ib_service/main.py`**
   - Added sys.path logic to include parent dir for local runs
   - Imports changed from `indicators`/`backtesting` to `shared.indicators`/`shared.backtesting`

3. **Removed from ib_service**
   - `indicators.py` (moved to shared/indicators/)
   - `backtesting.py` (moved to shared/backtesting/)

4. **`ib_service/Dockerfile`**
   - Build context set to tradingapp root (via docker-compose)
   - COPY shared, ib_service into /app
   - PYTHONPATH=/app so `from shared.indicators` works

5. **`docker-compose.yml`**
   - ib_service build: `context: .`, `dockerfile: ib_service/Dockerfile`

---

## Implementation Log: Recommendation 4 (Completed)

**Date:** March 2025

### Changes Made

1. **`backend/src/services/brokerConnectionResolver.ts`** (new)
   - `BrokerConnectionResolver` – routes by brokerType to ibConnectionService (IB)
   - `getActiveConnection(brokerType)` – returns `ActiveConnectionResult` (profileId, profileName, config)
   - `getConnectionStatus(brokerType)` – returns `ResolvedConnectionStatus`
   - `getConnectionConfigForProfile(brokerType, profileId)` – config for a specific profile
   - `hasConnectionService(brokerType)` – whether a connection service exists
   - Maps `IBConnectionProfile` → `BrokerConnectionConfig` for IB

2. **`backend/src/services/brokers/BrokerFactory.ts`**
   - Added `getActiveConnection()`, `getConnectionStatus()`, `hasConnectionService()` – delegate to resolver

3. **`backend/src/routes/brokerConnections.ts`** (new)
   - `GET /api/broker-connections/active?broker=IB` – active connection for broker type
   - `GET /api/broker-connections/status?broker=IB` – connection status

4. **`backend/src/index.ts`**
   - Mounted `/api/broker-connections` routes
   - Added `broker_connections` to endpoints info

---

## Implementation Log: Recommendation 5 (Completed)

**Date:** March 2025

### Changes Made

1. **`backend/src/services/orderService.ts`**
   - Renamed `ibOrderId` → `brokerOrderId` in `OrderExecution` interface
   - Updated all SQL (INSERT, UPDATE, SELECT) to use `broker_order_id`
   - Updated `storeOrderExecution`, `updateOrderStatus`, `getOrder`, `listOrders`, `cancelOrder` to use `brokerOrderId`

2. **`backend/src/database/migration-rename-ib-order-id.sql`** (new)
   - `ALTER TABLE order_executions RENAME COLUMN ib_order_id TO broker_order_id`
   - Dropped `idx_orders_ib_order_id`, created `idx_orders_broker_order_id`
   - Added column comment for broker-specific order ID

3. **`frontend/app/components/OrderHistory.tsx`**
   - Updated Order interface: `ib_order_id` → `brokerOrderId`

---

## Implementation Log: Recommendation 6 (Completed)

**Date:** March 2025

### Changes Made

1. **`backend/src/middleware/brokerSelection.ts`**
   - Added `brokerSelectionMiddleware` – Express middleware that sets `req.brokerType` from query param or header
   - Extended Express `Request` interface with `brokerType?: BrokerType`

2. **`backend/src/index.ts`**
   - Applied `brokerSelectionMiddleware` to `/api/account` and `/api/market-data` routes

3. **`backend/src/routes/account.ts`**
   - All handlers use `req.brokerType ?? getBrokerFromRequest(req)` (middleware sets it; fallback for safety)

4. **`backend/src/routes/marketData.ts`**
   - All broker-dependent handlers use `req.brokerType ?? getBrokerFromRequest(req)`

---

## Implementation Log: Recommendation 7 (Completed)

**Date:** March 2025

### Changes Made

1. **`ctrader_service/`** (new Python FastAPI service)
   - `main.py` – REST endpoints aligned with IBrokerService: `/health`, `/connection/connect`, `/connection/status`, `/connection/disconnect`, `/account/summary`, `/account/positions`, `/account/orders`, `/account/all`, `/orders/place`, `/orders/cancel`, `/market-data/history`, `/market-data/realtime`, `/contract/search`, `/contract/advanced-search`
   - Stub implementations when not connected; structure ready for ctrader-open-api OAuth integration
   - `requirements.txt`, `Dockerfile`

2. **`backend/src/services/brokers/CTraderBroker.ts`** (new)
   - Implements IBrokerService for cTrader
   - Symbol mapping: `toBrokerSymbol` / `toCanonicalSymbol` (e.g. EUR/USD ↔ EURUSD, AAPL ↔ #AAPL)
   - Order type mapping (MARKET, LIMIT, STOP, STOP_LIMIT)
   - HTTP client to ctrader_service

3. **`backend/src/services/brokers/BrokerFactory.ts`**
   - Added `CTraderBrokerService` for `CTRADER` broker type
   - `isSupported('CTRADER')` and `getSupportedBrokers()` include CTRADER

4. **`backend/src/database/migration-ctrader-connections.sql`** (new)
   - `ctrader_connection_profiles` table (client_id, client_secret_encrypted, redirect_uri, access_token, refresh_token, token_expires_at, account_mode, etc.)

5. **`backend/src/services/ctraderConnectionService.ts`** (new)
   - CRUD for cTrader profiles; `getActiveProfile`, `getDefaultProfile`, `setActiveProfile`, `setDefaultProfile`

6. **`backend/src/services/brokerConnectionResolver.ts`**
   - Added CTRADER case: `hasConnectionService`, `getActiveConnection`, `getConnectionStatus`, `getConnectionConfigForProfile`
   - Maps `CTraderConnectionProfile` → `BrokerConnectionConfig`

7. **`backend/src/routes/ctraderConnections.ts`** (new)
   - `/api/ctrader-connections/profiles`, `/profiles/:id`, `/profiles/:id/activate`, `/profiles/:id/set-default`, `/status`

8. **`docker-compose.yml`**
   - Added `ctrader_service` container (port 8002, IP 172.20.0.11)
   - Backend `CTRADER_SERVICE_URL=http://172.20.0.11:8002`

9. **`frontend/app/connections/page.tsx`**
   - Tabs: "IB Connections" | "cTrader Connections"
   - cTrader section: add profile (name, client_id, redirect_uri, account_mode), list profiles, activate, set default, delete
