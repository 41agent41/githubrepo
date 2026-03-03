# cTrader Integration Plan & Recommendations

**TradingApp Project** | Last updated: March 2025

---

## Executive Summary

The TradingApp codebase is well-structured for multi-broker support. The existing broker abstraction layer (`IBrokerService`, `BrokerFactory`), IB service pattern, and connection management infrastructure provide a clear path for integrating cTrader. This document outlines a phased integration plan with specific recommendations.

---

## 1. Current Architecture Overview

### 1.1 Existing Broker Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| **IBrokerService** | `backend/src/services/brokers/IBrokerService.ts` | Abstract interface all brokers implement |
| **BrokerFactory** | `backend/src/services/brokers/BrokerFactory.ts` | Factory with CTRADER placeholder (throws NOT_IMPLEMENTED) |
| **IBBroker** | `backend/src/services/brokers/IBBroker.ts` | IB implementation; HTTP client to ib_service |
| **Broker types** | `backend/src/types/broker.ts` | `BrokerType = 'IB' \| 'MT5' \| 'CTRADER'` already defined |

### 1.2 IB Service Pattern (Reference for cTrader Service)

The `ib_service` (Python FastAPI) exposes REST endpoints that `IBBroker` calls:

| Endpoint Category | IB Service Paths | Purpose |
|-------------------|-----------------|---------|
| Connection | `POST /connection/connect`, `POST /connection/disconnect`, `GET /health`, `POST /connection/test` | Connect to IB Gateway |
| Account | `GET /account/summary`, `/account/positions`, `/account/orders`, `/account/all` | Account data |
| Orders | `POST /orders/place`, `POST /orders/cancel` | Trading operations |
| Market Data | `GET /market-data/history`, `/market-data/realtime`, `/market-data/tick` | Historical & real-time |
| Contracts | `POST /contract/search`, `POST /contract/advanced-search` | Symbol discovery |

### 1.3 Connection Management

- **IB**: `ib_connection_profiles` table, `ibConnectionService`, `/connections` UI
- **cTrader**: Will need `ctrader_connection_profiles` or a unified `broker_connection_profiles` table

---

## 2. cTrader Open API Overview

### 2.1 Key Characteristics

| Aspect | cTrader Open API | IB (TWS API) |
|--------|------------------|--------------|
| **Protocol** | HTTP + JSON or Protobuf; TCP for streaming | TWS API (socket-based) |
| **Auth** | OAuth 2.0 (Client ID + Secret, authorization code, access token ~30 days) | Host/Port/ClientId (IB Gateway) |
| **SDKs** | Python (`ctrader-open-api`), C# | `ibapi` (Python) |
| **Hosts** | Demo vs Live endpoints (different servers) | Same host, different ports (4001/4002) |
| **Rate limits** | 5 req/s historical, 50 req/s other | No explicit limit |

### 2.2 cTrader API Capabilities (Aligned with IBrokerService)

- **Account**: Balance, positions, orders, deals
- **Trading**: Place, cancel, modify orders; all order types
- **Market Data**: Real-time quotes, historical OHLCV, symbol lists
- **Authentication**: Application auth + account auth (OAuth flow)

### 2.3 Python SDK (OpenApiPy)

- Package: `ctrader-open-api` (pip install)
- Uses **Twisted** (async)
- Protobuf-based; contains pre-compiled message definitions
- Endpoints: `EndPoints.PROTOBUF_LIVE_HOST` / `EndPoints.PROTOBUF_DEMO_HOST`

---

## 3. Integration Architecture

### 3.1 Proposed Component Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                                  │
│  /connections (extend for cTrader)  │  /configure  │  Charts  │  Account      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Backend (Express + Socket.IO)                          │
│  BrokerFactory  →  IBBroker  │  CTraderBroker (new)  │  orderService, etc.   │
└─────────────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│   IB Service         │      │  cTrader Service     │
│   (Python FastAPI)   │      │  (Python FastAPI)   │
│   Port 8000          │      │  Port 8002          │
└──────────────────────┘      └──────────────────────┘
         │                              │
         ▼                              ▼
   IB Gateway/TWS              cTrader Open API
   (User runs locally)         (Cloud - Demo/Live)
```

### 3.2 Data Flow for cTrader

1. **Connection**: User registers app at openapi.ctrader.com → gets Client ID + Secret. User completes OAuth flow → access token stored in `ctrader_connection_profiles`.
2. **Requests**: Frontend → Backend → `CTraderBroker` → HTTP to `ctrader_service` → cTrader Open API (REST or Protobuf).
3. **Market Data**: cTrader supports streaming; can mirror IB’s WebSocket pattern for real-time quotes.

---

## 4. Detailed Implementation Plan

### Phase 1: cTrader Service (Python FastAPI)

**Goal**: Create `ctrader_service/` mirroring `ib_service/` structure.

| Task | Description | Priority |
|------|-------------|----------|
| 1.1 | Create `ctrader_service/` directory with `main.py`, `requirements.txt`, `Dockerfile` | High |
| 1.2 | Add `ctrader-open-api` and FastAPI dependencies | High |
| 1.3 | Implement OAuth token management (store, refresh, expiry) | High |
| 1.4 | Expose REST endpoints aligned with IBrokerService: | High |
| | - `POST /connection/connect` (OAuth code exchange) | |
| | - `GET /connection/status` or `GET /health` | |
| | - `GET /account/summary`, `/account/positions`, `/account/orders` | |
| | - `POST /orders/place`, `POST /orders/cancel` | |
| | - `GET /market-data/history`, `GET /market-data/realtime` | |
| | - `POST /contract/search` (symbol discovery) | |
| 1.5 | Map cTrader symbols/order types to canonical `broker.ts` types | High |
| 1.6 | Handle Demo vs Live via `account_mode` (like IB) | Medium |

**cTrader-specific considerations**:
- Use **REST + JSON** for simplicity (or Protobuf if performance is critical).
- OAuth: Implement token refresh before expiry.
- Symbol format: cTrader uses different naming (e.g. `EURUSD`, `#AAPL`) vs IB (`EUR.USD`, `AAPL`).

---

### Phase 2: Backend Integration

**Goal**: Implement `CTraderBroker` and wire it into the system.

| Task | Description | Priority |
|------|-------------|----------|
| 2.1 | Create `CTraderBroker.ts` extending `BaseBrokerService` | High |
| 2.2 | Implement all `IBrokerService` methods (connect, account, orders, market data, symbol mapping) | High |
| 2.3 | Add `getCTraderServiceUrl()` to `runtimeConfig.ts` (and system settings) | High |
| 2.4 | Update `BrokerFactory.ts`: instantiate `CTraderBroker`, add `getCTraderServiceUrl()` | High |
| 2.5 | Add `ctrader_service_url` to system settings / deployment config | Medium |
| 2.6 | Create `ctraderConnectionService.ts` and `ctrader_connection_profiles` table | High |
| 2.7 | Add routes: `/api/ctrader-connections/profiles`, activate, test, OAuth callback | High |
| 2.8 | Extend `orderService` / `marketDataService` to support broker selection (CTRADER) | Medium |

**Symbol mapping** (`toBrokerSymbol` / `toCanonicalSymbol`):
- Forex: IB `EUR.USD` ↔ cTrader `EURUSD` (no separator).
- CFDs: cTrader `#AAPL`, `#US500` vs IB `AAPL`, `SPY`.
- Build a mapping table or config file for common symbols.

---

### Phase 3: Database & Configuration

**Goal**: Store cTrader connection profiles and OAuth tokens.

| Task | Description | Priority |
|------|-------------|----------|
| 3.1 | Create migration `migration-ctrader-connections.sql` | High |
| 3.2 | Table `ctrader_connection_profiles`: | High |
| | - `client_id`, `client_secret` (encrypted), `redirect_uri` | |
| | - `access_token`, `refresh_token`, `token_expires_at` | |
| | - `account_id`, `account_mode` (demo/live) | |
| | - `is_active`, `is_default`, `name`, `description` | |
| 3.3 | Add `ctrader_service_url`, `ctrader_service_port` to system settings | Medium |
| 3.4 | Add `DEFAULT_BROKER` env support (IB \| CTRADER) for `getDefaultBroker()` | Low |

**Schema sketch** (`ctrader_connection_profiles`):

```sql
CREATE TABLE ctrader_connection_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    account_mode VARCHAR(10) NOT NULL CHECK (account_mode IN ('live', 'paper')),
    client_id VARCHAR(255) NOT NULL,
    client_secret_encrypted TEXT,
    redirect_uri VARCHAR(500),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    ctrader_account_id BIGINT,
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### Phase 4: Frontend

**Goal**: Allow users to add and manage cTrader connections.

| Task | Description | Priority |
|------|-------------|----------|
| 4.1 | Extend `/connections` page: tabs or sections for "IB" and "cTrader" | High |
| 4.2 | cTrader connection form: Client ID, Client Secret, Redirect URI, Account Mode | High |
| 4.3 | Implement OAuth flow: "Connect" → redirect to cTrader → callback → store tokens | High |
| 4.4 | Add `CTraderConnectionContext` or extend `IBConnectionContext` to `BrokerConnectionContext` | Medium |
| 4.5 | Broker selector in trading/account UI (IB vs cTrader) | Medium |
| 4.6 | cTrader-specific symbol config in `frontend/app/config/exchanges.ts` | Low |

---

### Phase 5: Docker & Deployment

**Goal**: Run cTrader service alongside existing services.

| Task | Description | Priority |
|------|-------------|----------|
| 5.1 | Add `ctrader_service` to `docker-compose.yml` | High |
| 5.2 | Set `CTRADER_SERVICE_URL=http://172.20.0.11:8002` for backend | High |
| 5.3 | Allocate IP `172.20.0.11` to cTrader service in network | High |
| 5.4 | Document env vars: `CTRADER_SERVICE_URL`, `CTRADER_SERVICE_PORT` | Medium |

---

## 5. Key Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `ctrader_service/main.py` | FastAPI app, OAuth, REST endpoints |
| `ctrader_service/requirements.txt` | `ctrader-open-api`, `fastapi`, `uvicorn`, etc. |
| `ctrader_service/Dockerfile` | Python image for cTrader service |
| `backend/src/services/brokers/CTraderBroker.ts` | IBrokerService implementation |
| `backend/src/services/ctraderConnectionService.ts` | CRUD for cTrader profiles |
| `backend/src/routes/ctraderConnections.ts` | API routes |
| `backend/src/database/migration-ctrader-connections.sql` | DB schema |

### Files to Modify

| File | Changes |
|------|---------|
| `backend/src/services/brokers/BrokerFactory.ts` | Create `CTraderBroker`, add `getCTraderServiceUrl()` |
| `backend/src/config/runtimeConfig.ts` | Add `getCTraderServiceUrl()` |
| `backend/src/index.ts` (or router setup) | Mount `/api/ctrader-connections` routes |
| `docker-compose.yml` | Add `ctrader_service` container |
| `frontend/app/connections/page.tsx` | Add cTrader section/tab |
| System settings schema | Add `ctrader_service_url`, `ctrader_service_port` |

---

## 6. cTrader API Mapping to IBrokerService

| IBrokerService Method | cTrader Open API Equivalent | Notes |
|-----------------------|-----------------------------|------|
| `connect()` | OAuth flow → Application auth + Account auth | Store tokens |
| `getAccountSummary()` | `ProtoOAGetAccountListReq` / `ProtoOACashFlowHistoryReq` | Map to `BrokerAccountSummary` |
| `getPositions()` | `ProtoOAGetPositionListReq` | Map to `BrokerPosition` |
| `getOrders()` | `ProtoOAGetOrderListReq` | Map to `BrokerOrder` |
| `placeOrder()` | `ProtoOANewOrderReq` | Map order types |
| `cancelOrder()` | `ProtoOACancelOrderReq` | |
| `searchContracts()` | `ProtoOAGetSymbolsListReq` / symbol search | cTrader symbol format differs |
| `getHistoricalData()` | `ProtoOAGetTrendbarsReq` | Map timeframes |
| `getQuote()` | `ProtoOASubscribeSpotsReq` + spot updates | Or REST equivalent |
| `toBrokerSymbol()` | Symbol name mapping | e.g. `AAPL` → `#AAPL` for CFDs |
| `toCanonicalSymbol()` | Reverse mapping | |

---

## 7. Symbol Mapping Strategy

cTrader uses different symbol conventions:

| Asset Class | IB Format | cTrader Format | Mapping Approach |
|-------------|-----------|----------------|------------------|
| Forex | `EUR.USD` | `EURUSD` | Replace `.` with `` (or vice versa) |
| Stocks (CFD) | `AAPL` | `#AAPL` | Add/remove `#` prefix |
| Indices | `SPY` or `US500` | `#US500` | Config table |
| Crypto | `BTC.USD` | `BTCUSD` | Similar to forex |

**Recommendation**: Create `backend/src/config/ctraderSymbolMap.ts` (or DB table) with explicit mappings. Fall back to simple string transforms for common cases.

---

## 8. Order Type Mapping

| Canonical (broker.ts) | cTrader | IB |
|-----------------------|---------|-----|
| `MARKET` | Market | MKT |
| `LIMIT` | Limit | LMT |
| `STOP` | Stop | STP |
| `STOP_LIMIT` | Stop limit | STP LMT |

cTrader may support additional types (e.g. trailing stop); map to closest canonical type or extend `OrderType` if needed.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OAuth token expiry | Refresh before expiry; background job or on-demand refresh |
| cTrader rate limits (5/50 req/s) | Throttle historical requests; cache symbol lists |
| Symbol format differences | Centralized mapping layer; allow manual overrides |
| Demo vs Live endpoint mix-up | Strict `account_mode` checks; separate connection profiles |
| Twisted vs FastAPI async | Run OpenApiPy in thread/process or use REST API if available |

---

## 10. Recommended Implementation Order

1. **Phase 1** (cTrader Service): Get minimal REST API working (health, account summary, positions).
2. **Phase 2** (Backend): Implement `CTraderBroker` with connect, account, orders.
3. **Phase 3** (Database): Add `ctrader_connection_profiles` and migrations.
4. **Phase 4** (Frontend): OAuth flow and connection UI.
5. **Phase 5** (Docker): Add service to compose.
6. **Phase 6** (Market Data): Historical and real-time data.
7. **Phase 7** (Polish): Symbol mapping, order types, error handling, tests.

---

## 11. Quick Start Checklist for Developers

- [ ] Register app at [openapi.ctrader.com](https://openapi.ctrader.com/)
- [ ] Get Client ID and Client Secret after approval
- [ ] Add redirect URI (e.g. `http://localhost:3000/connections/ctrader/callback`)
- [ ] Install `ctrader-open-api`: `pip install ctrader-open-api`
- [ ] Review [OpenApiPy samples](https://github.com/spotware/OpenApiPy/tree/main/samples)
- [ ] Use Demo account for development
- [ ] Read [cTrader Open API docs](https://help.ctrader.com/open-api/)

---

## 12. References

- [cTrader Open API Portal](https://openapi.ctrader.com/)
- [cTrader Open API Documentation](https://help.ctrader.com/open-api/)
- [OpenApiPy (Python SDK)](https://github.com/spotware/OpenApiPy)
- [App Registration](https://help.ctrader.com/open-api/api-application/)
- [Account Authentication](https://help.ctrader.com/open-api/account-authentication/)
