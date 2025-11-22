# TradingApp Enhancement Implementation Plan

## Executive Summary

This document outlines the plan to enhance the TradingApp to support:
- **Frontend**: Symbol selection, multiple timeframe selection, indicator/strategy selection, and port-based chart spawning in separate browser tabs
- **Backend**: Automatic market data collection, indicator/strategy calculation and storage, and buy/sell order execution

## Current State Analysis

### Existing Functionality

#### Frontend
1. **Market Data Filter** (`MarketDataFilter.tsx`): 
   - Symbol search with contract selection
   - Single timeframe selection
   - Basic chart display via `EnhancedTradingChart`
   - Real-time data display

2. **Chart Components**:
   - `EnhancedTradingChart.tsx`: Single chart with timeframe switching
   - `TradingChart.tsx`: Real-time chart with Socket.IO
   - `MSFTRealtimeChart.tsx`: MSFT-specific real-time chart
   - All use TradingView lightweight-charts library

3. **Indicator Support**:
   - `IndicatorSelector.tsx`: Component for selecting indicators
   - Currently displays indicators but limited integration with chart data

4. **Pages**:
   - Home page (`page.tsx`): Market data search interface
   - Historical page (`historical/page.tsx`): Historical data viewing
   - Download page (`download/page.tsx`): Data download and bulk collection
   - MSFT page (`msft/page.tsx`): MSFT-specific real-time chart

#### Backend
1. **Market Data Routes** (`routes/marketData.ts`):
   - Contract search (`/search`, `/search/advanced`)
   - Historical data (`/history`) with database integration
   - Real-time data (`/realtime`)
   - Technical indicators (`/indicators`)
   - Bulk collection (`/bulk-collect`)
   - Data validation (`/validate`)

2. **Market Data Service** (`services/marketDataService.ts`):
   - Contract management (getOrCreateContract)
   - Candlestick data storage (storeCandlestickData)
   - Technical indicator storage (storeTechnicalIndicators)
   - Historical data retrieval (getHistoricalData)

3. **IB Service** (`ib_service/main.py`):
   - IB Gateway connection management
   - Market data requests (historical and real-time)
   - Technical indicator calculation (via `indicators.py`)
   - Backtesting support (via `backtesting.py`)
   - Account data retrieval (positions, orders)
   - **Note**: Order placement functionality exists but is not fully exposed via API

4. **Database Schema**:
   - `contracts`: Contract information
   - `candlestick_data`: OHLCV data with timeframe
   - `technical_indicators`: Indicator values linked to candlesticks
   - `data_collection_sessions`: Tracking data collection
   - **Missing**: Strategy execution tracking, order history, strategy signals

### Gaps Identified

#### Frontend Gaps
1. **Multi-timeframe Selection**: Currently only single timeframe selection
2. **Multi-indicator/Strategy Selection**: Limited to basic indicator selection
3. **Port-based Chart Spawning**: No mechanism to spawn charts in separate tabs with port allocation
4. **Strategy Selection UI**: No interface for selecting trading strategies
5. **Order Execution UI**: No interface for placing buy/sell orders

#### Backend Gaps
1. **Automatic Market Data Collection**: No scheduled/automatic collection based on symbol+timeframe selections
2. **Strategy Calculation Engine**: Backtesting exists but no live strategy signal calculation
3. **Strategy Storage**: No database tables for storing strategy signals and execution history
4. **Order Execution API**: IB service has order placement code but no exposed endpoints
5. **Port Management**: No system for allocating and managing chart ports

## Implementation Plan

### Phase 1: Frontend Enhancements

#### 1.1 New Configuration Page (`/configure` or `/trading-setup`)

**Purpose**: Central interface for configuring trading setups

**Components to Create**:
- `TradingSetupPage.tsx`: Main configuration page
- `SymbolSelector.tsx`: Enhanced symbol selection (reuse MarketDataFilter logic)
- `MultiTimeframeSelector.tsx`: Multi-select timeframe component
- `StrategySelector.tsx`: Strategy selection component (new)
- `IndicatorMultiSelector.tsx`: Enhanced multi-indicator selector
- `PortAllocator.tsx`: Port allocation and chart spawning component

**Features**:
1. **Symbol Selection**:
   - Reuse existing `MarketDataFilter` search functionality
   - Display selected symbol with contract details
   - Support for single symbol selection (can be extended later)

2. **Multiple Timeframe Selection**:
   - Checkbox-based multi-select for timeframes:
     - 5min, 15min, 30min, 1hour, 4hour, 8hour, 1day
   - Visual display of selected timeframes
   - Validation: At least one timeframe required

3. **Indicator/Strategy Selection**:
   - **Indicators Tab**:
     - Reuse/enhance `IndicatorSelector` component
     - Support multiple indicator selection
     - Categories: Trend, Momentum, Volatility, Volume
   - **Strategies Tab**:
     - Display available strategies from backend
     - Strategy descriptions and parameters
     - Support multiple strategy selection
     - Strategy types: Moving Average Crossover, RSI Strategy, MACD Strategy, etc.

4. **Port Allocation & Chart Spawning**:
   - Display allocated port number (from backend)
   - "Open Chart in New Tab" button
   - Generate URL: `http://[server]:[port]/chart/[symbol]/[timeframe]?indicators=[...]&strategies=[...]`
   - Support multiple chart tabs (one per timeframe or combined view)

**Data Flow**:
```
User Input → Configuration State → POST /api/trading-setup/create
Response: { setup_id, port, chart_urls: [...] }
```

#### 1.2 Chart Spawning System

**New Route**: `/chart/[symbol]/[timeframe]`

**Purpose**: Standalone chart page that can be opened in separate tabs

**Component**: `StandaloneChart.tsx`

**Features**:
- Accept URL parameters: symbol, timeframe, indicators, strategies, port
- Display TradingView lightweight chart
- Real-time data updates via WebSocket
- Indicator overlays on chart
- Strategy signal markers (buy/sell arrows)
- Connection status indicator
- Port number display in header

**Implementation**:
- Create new Next.js dynamic route: `app/chart/[symbol]/[timeframe]/page.tsx`
- Query parameters: `?indicators=...&strategies=...&port=...`
- Reuse chart rendering logic from `EnhancedTradingChart.tsx`
- Add WebSocket connection for real-time updates
- Display strategy signals as chart markers

#### 1.3 Enhanced Indicator Display

**Enhancements to Existing Components**:
- `EnhancedTradingChart.tsx`: Add indicator overlay support
- `IndicatorSelector.tsx`: Support multi-select with categories
- Add indicator series to charts (SMA, EMA lines, RSI panel, etc.)

### Phase 2: Backend Enhancements

#### 2.1 Trading Setup Management

**New Route**: `/api/trading-setup`

**Endpoints**:
- `POST /api/trading-setup/create`: Create new trading setup
  - Request: `{ symbol, timeframes: [], indicators: [], strategies: [] }`
  - Response: `{ setup_id, port, chart_urls: [...] }`
  
- `GET /api/trading-setup/:id`: Get setup details
- `GET /api/trading-setup`: List all active setups
- `PUT /api/trading-setup/:id`: Update setup
- `DELETE /api/trading-setup/:id`: Remove setup

**New Service**: `services/tradingSetupService.ts`

**Features**:
- Port allocation management (port pool: 3001-3100)
- Setup persistence in database
- Automatic market data collection trigger

#### 2.2 Automatic Market Data Collection

**New Service**: `services/marketDataCollector.ts`

**Purpose**: Automatically collect market data based on active trading setups

**Implementation**:
- Background worker/job scheduler
- Poll active setups from database
- For each symbol+timeframe combination:
  - Check last collection time
  - Request data from IB Gateway if needed
  - Store in database
  - Trigger indicator/strategy calculation

**Collection Strategy**:
- **5min, 15min, 30min**: Collect every 5 minutes
- **1hour, 4hour, 8hour**: Collect every hour
- **1day**: Collect daily at market close

**New Route**: `POST /api/market-data/auto-collect`
- Manually trigger collection for a setup
- Returns collection status

#### 2.3 Strategy Calculation Engine

**New Service**: `services/strategyService.ts`

**Purpose**: Calculate strategy signals based on market data and indicators

**Implementation**:
- Load historical data for symbol+timeframe
- Calculate required indicators
- Run selected strategies
- Generate buy/sell signals
- Store signals in database

**Strategy Types** (extend from `ib_service/backtesting.py`):
1. **Moving Average Crossover**:
   - Buy: Fast MA crosses above Slow MA
   - Sell: Fast MA crosses below Slow MA
   
2. **RSI Strategy**:
   - Buy: RSI < 30 (oversold)
   - Sell: RSI > 70 (overbought)
   
3. **MACD Strategy**:
   - Buy: MACD crosses above signal line
   - Sell: MACD crosses below signal line
   
4. **Bollinger Bands**:
   - Buy: Price touches lower band
   - Sell: Price touches upper band

**New Route**: `POST /api/strategies/calculate`
- Request: `{ setup_id }` or `{ symbol, timeframe, strategies: [] }`
- Response: `{ signals: [{ timestamp, strategy, action, price, ... }] }`

#### 2.4 Strategy Storage

**Database Schema Additions**:

```sql
-- Trading setups table
CREATE TABLE trading_setups (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    contract_id INTEGER REFERENCES contracts(id),
    timeframes TEXT[] NOT NULL, -- Array of timeframes
    indicators TEXT[], -- Array of indicator names
    strategies TEXT[], -- Array of strategy names
    port INTEGER UNIQUE,
    status VARCHAR(20) DEFAULT 'active', -- active, paused, stopped
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy signals table
CREATE TABLE strategy_signals (
    id BIGSERIAL PRIMARY KEY,
    setup_id INTEGER REFERENCES trading_setups(id),
    contract_id INTEGER REFERENCES contracts(id),
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    strategy_name VARCHAR(50) NOT NULL,
    signal_type VARCHAR(10) NOT NULL, -- BUY, SELL, HOLD
    price DECIMAL(20,8),
    confidence DECIMAL(5,4), -- 0.0000 to 1.0000
    indicator_values JSONB, -- Store relevant indicator values at signal time
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(setup_id, timeframe, timestamp, strategy_name)
);

-- Order execution table
CREATE TABLE order_executions (
    id BIGSERIAL PRIMARY KEY,
    setup_id INTEGER REFERENCES trading_setups(id),
    signal_id BIGINT REFERENCES strategy_signals(id),
    contract_id INTEGER REFERENCES contracts(id),
    order_type VARCHAR(10) NOT NULL, -- MARKET, LIMIT, STOP
    action VARCHAR(10) NOT NULL, -- BUY, SELL
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    ib_order_id INTEGER, -- IB Gateway order ID
    status VARCHAR(20) DEFAULT 'pending', -- pending, filled, cancelled, rejected
    filled_quantity DECIMAL(20,8),
    avg_fill_price DECIMAL(20,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Service Methods**:
- `storeStrategySignal()`: Save signal to database
- `getStrategySignals()`: Retrieve signals for display
- `storeOrderExecution()`: Log order placement and execution

#### 2.5 Order Execution API

**Enhance IB Service** (`ib_service/main.py`):

Add order placement endpoint:
```python
@app.post("/orders/place")
async def place_order(
    symbol: str,
    action: str,  # BUY or SELL
    quantity: float,
    order_type: str = "MKT",  # MKT, LMT, STP
    limit_price: float = None,
    stop_price: float = None
):
    """Place order through IB Gateway"""
```

**Backend Route** (`routes/trading.ts` - new file):

```typescript
POST /api/trading/place-order
POST /api/trading/cancel-order
GET /api/trading/orders
GET /api/trading/order-status/:id
```

**Implementation**:
- Validate order parameters
- Call IB service to place order
- Store order in database
- Return order ID and status
- WebSocket updates for order status changes

#### 2.6 Port Management System

**New Service**: `services/portManager.ts`

**Purpose**: Allocate and manage ports for chart spawning

**Implementation**:
- Port pool: 3001-3100 (configurable)
- Track allocated ports in memory/database
- Port allocation on setup creation
- Port release on setup deletion
- Health check for port availability

**Database Table** (optional, can use in-memory):
```sql
CREATE TABLE port_allocations (
    port INTEGER PRIMARY KEY,
    setup_id INTEGER REFERENCES trading_setups(id),
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 3: Integration & Workflow

#### 3.1 Complete Workflow

**User Journey**:
1. User navigates to `/configure` (new page)
2. Selects symbol (e.g., MSFT)
3. Selects multiple timeframes (e.g., 5min, 15min, 1hour)
4. Selects indicators (e.g., SMA_20, RSI, MACD)
5. Selects strategies (e.g., MA Crossover, RSI Strategy)
6. Clicks "Create Setup"
7. Backend:
   - Allocates port (e.g., 3001)
   - Creates trading setup record
   - Starts automatic data collection
   - Calculates initial strategy signals
8. Frontend displays:
   - Setup ID
   - Allocated port
   - Chart URLs for each timeframe
9. User clicks "Open Charts" → Opens multiple tabs
10. Charts display:
    - Real-time price data
    - Selected indicators
    - Strategy buy/sell signals
11. When strategy generates signal:
    - Backend calculates signal
    - Stores in database
    - WebSocket broadcasts to frontend
    - Chart displays signal marker
12. User can execute order:
    - Click on signal
    - Confirm order
    - Order placed via IB Gateway
    - Order status tracked

#### 3.2 Real-time Updates

**WebSocket Events** (enhance existing Socket.IO):

**New Events**:
- `strategy-signal`: New buy/sell signal generated
- `order-status`: Order status update
- `market-data-update`: New candlestick data
- `indicator-update`: Updated indicator values

**Client Subscriptions**:
- Subscribe to setup: `socket.emit('subscribe-setup', { setup_id })`
- Receive signals: `socket.on('strategy-signal', (data) => {...})`

### Phase 4: Database Enhancements

#### 4.1 New Tables (as outlined in 2.4)

#### 4.2 Indexes

```sql
-- Trading setups indexes
CREATE INDEX idx_setups_symbol ON trading_setups(symbol);
CREATE INDEX idx_setups_status ON trading_setups(status);
CREATE INDEX idx_setups_port ON trading_setups(port);

-- Strategy signals indexes
CREATE INDEX idx_signals_setup_timeframe ON strategy_signals(setup_id, timeframe, timestamp DESC);
CREATE INDEX idx_signals_contract_timeframe ON strategy_signals(contract_id, timeframe, timestamp DESC);
CREATE INDEX idx_signals_type ON strategy_signals(signal_type);

-- Order executions indexes
CREATE INDEX idx_orders_setup ON order_executions(setup_id);
CREATE INDEX idx_orders_signal ON order_executions(signal_id);
CREATE INDEX idx_orders_status ON order_executions(status);
CREATE INDEX idx_orders_created ON order_executions(created_at DESC);
```

#### 4.3 Views

```sql
-- Active setups view
-- NOTE: Explicitly lists columns instead of using ts.* to avoid duplicate column errors
-- since both trading_setups and contracts tables have a 'symbol' column
DROP VIEW IF EXISTS active_trading_setups;
CREATE VIEW active_trading_setups AS
SELECT 
    ts.id,
    ts.symbol,
    ts.contract_id,
    ts.timeframes,
    ts.indicators,
    ts.strategies,
    ts.port,
    ts.status,
    ts.created_at,
    ts.updated_at,
    c.sec_type,
    c.exchange,
    c.currency,
    COUNT(DISTINCT ss.id) as signal_count,
    MAX(ss.timestamp) as last_signal_time,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status IN ('pending', 'submitted', 'partial')) as active_orders_count,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status = 'filled') as filled_orders_count
FROM trading_setups ts
LEFT JOIN contracts c ON ts.contract_id = c.id
LEFT JOIN strategy_signals ss ON ts.id = ss.setup_id
LEFT JOIN order_executions oe ON ts.id = oe.setup_id
WHERE ts.status = 'active'
GROUP BY ts.id, ts.symbol, ts.contract_id, ts.timeframes, ts.indicators, ts.strategies, 
         ts.port, ts.status, ts.created_at, ts.updated_at,
         c.sec_type, c.exchange, c.currency;

-- Recent signals view
CREATE OR REPLACE VIEW recent_strategy_signals AS
SELECT 
    ss.id,
    ss.setup_id,
    ss.contract_id,
    ss.timeframe,
    ss.timestamp,
    ss.strategy_name,
    ss.signal_type,
    ss.price,
    ss.confidence,
    ss.indicator_values,
    ss.created_at,
    ts.symbol,
    ts.timeframes as setup_timeframes,
    c.sec_type,
    c.exchange,
    c.currency
FROM strategy_signals ss
LEFT JOIN trading_setups ts ON ss.setup_id = ts.id
LEFT JOIN contracts c ON ss.contract_id = c.id
WHERE ss.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY ss.timestamp DESC;

-- Setup performance summary view
CREATE OR REPLACE VIEW setup_performance_summary AS
SELECT 
    ts.id as setup_id,
    ts.symbol,
    COUNT(DISTINCT ss.id) FILTER (WHERE ss.signal_type = 'BUY') as total_buy_signals,
    COUNT(DISTINCT ss.id) FILTER (WHERE ss.signal_type = 'SELL') as total_sell_signals,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status = 'filled') as filled_orders,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status = 'cancelled') as cancelled_orders,
    SUM(oe.filled_quantity * oe.avg_fill_price) FILTER (WHERE oe.status = 'filled') as total_trade_value,
    AVG(oe.avg_fill_price) FILTER (WHERE oe.status = 'filled' AND oe.action = 'BUY') as avg_buy_price,
    AVG(oe.avg_fill_price) FILTER (WHERE oe.status = 'filled' AND oe.action = 'SELL') as avg_sell_price,
    MAX(ss.timestamp) as last_signal_time,
    MAX(oe.created_at) as last_order_time
FROM trading_setups ts
LEFT JOIN strategy_signals ss ON ts.id = ss.setup_id
LEFT JOIN order_executions oe ON ts.id = oe.setup_id
GROUP BY ts.id, ts.symbol;

-- Strategy signal performance view
CREATE OR REPLACE VIEW strategy_performance AS
SELECT 
    strategy_name,
    signal_type,
    COUNT(*) as signal_count,
    AVG(confidence) as avg_confidence,
    MIN(confidence) as min_confidence,
    MAX(confidence) as max_confidence,
    COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours') as signals_last_24h,
    COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days') as signals_last_7d,
    COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '30 days') as signals_last_30d,
    AVG(price) as avg_price,
    MIN(timestamp) as first_signal,
    MAX(timestamp) as last_signal
FROM strategy_signals
GROUP BY strategy_name, signal_type
ORDER BY signal_count DESC;

-- Order execution summary view
CREATE OR REPLACE VIEW order_execution_summary AS
SELECT 
    status,
    action,
    order_type,
    COUNT(*) as order_count,
    SUM(quantity) as total_quantity,
    AVG(price) as avg_price,
    SUM(filled_quantity) FILTER (WHERE filled_quantity IS NOT NULL) as total_filled_quantity,
    AVG(avg_fill_price) FILTER (WHERE avg_fill_price IS NOT NULL) as avg_fill_price,
    MIN(created_at) as first_order,
    MAX(created_at) as last_order
FROM order_executions
GROUP BY status, action, order_type
ORDER BY order_count DESC;
```

### Phase 5: UI/UX Enhancements

#### 5.1 Configuration Page Design

**Layout**:
```
┌─────────────────────────────────────────┐
│  Trading Setup Configuration           │
├─────────────────────────────────────────┤
│  Step 1: Select Symbol                  │
│  [Symbol Search Component]              │
│  Selected: MSFT (Microsoft Corporation) │
├─────────────────────────────────────────┤
│  Step 2: Select Timeframes              │
│  ☑ 5min  ☑ 15min  ☑ 30min  ☐ 1hour    │
│  ☑ 4hour  ☐ 8hour  ☑ 1day             │
├─────────────────────────────────────────┤
│  Step 3: Select Indicators/Strategies   │
│  [Tabs: Indicators | Strategies]       │
│  Indicators: ☑ SMA_20 ☑ RSI ☑ MACD     │
│  Strategies: ☑ MA Crossover ☑ RSI      │
├─────────────────────────────────────────┤
│  Step 4: Chart Configuration            │
│  Port: 3001 (auto-allocated)           │
│  [Open Charts in New Tabs]              │
├─────────────────────────────────────────┤
│  [Cancel]  [Create Setup]               │
└─────────────────────────────────────────┘
```

#### 5.2 Chart Enhancements

**Signal Display**:
- Buy signals: Green upward arrow below candle
- Sell signals: Red downward arrow above candle
- Signal tooltip: Strategy name, confidence, indicator values

**Indicator Overlays**:
- SMA/EMA: Line series on main chart
- RSI: Separate panel below chart
- MACD: Separate panel with histogram
- Bollinger Bands: Shaded area on main chart

#### 5.3 Order Execution UI

**Components**:
- `OrderDialog.tsx`: Modal for order confirmation
- `OrderHistory.tsx`: Table of past orders
- `OrderStatusBadge.tsx`: Visual status indicator

**Features**:
- Click signal → Open order dialog
- Pre-fill: Symbol, Action (BUY/SELL), Quantity
- User can adjust: Quantity, Order Type (Market/Limit)
- Confirm → Place order
- Display order status in real-time

### Phase 6: Testing & Validation

#### 6.1 Unit Tests
- Trading setup creation/management
- Port allocation/release
- Strategy signal calculation
- Order placement validation

#### 6.2 Integration Tests
- End-to-end workflow: Setup → Data Collection → Signal Generation → Order Execution
- Multi-timeframe data collection
- WebSocket real-time updates

#### 6.3 Performance Tests
- Concurrent setup handling
- Data collection performance
- Strategy calculation speed

## Implementation Priority

### High Priority (Phase 1)
1. Trading setup configuration page
2. Multi-timeframe selection
3. Port allocation system
4. Chart spawning in separate tabs

### Medium Priority (Phase 2)
1. Automatic market data collection
2. Strategy calculation engine
3. Strategy signal storage
4. Database schema additions

### Lower Priority (Phase 3)
1. Order execution API
2. Real-time WebSocket updates
3. UI/UX polish
4. Advanced strategy types

## Technical Considerations

### Port Management
- **Option 1**: Use Next.js dynamic routes (no separate ports needed)
  - URL: `http://server:3000/chart/[symbol]/[timeframe]?port=3001`
  - Simpler, no port allocation needed
- **Option 2**: Separate Express server for charts (requires port allocation)
  - More complex but allows true separation
- **Recommendation**: Option 1 (simpler, sufficient for requirements)

### Data Collection Strategy
- **Polling**: Background job checks setups every N minutes
- **Event-driven**: Trigger collection on new candle completion
- **Hybrid**: Polling for initial collection, event-driven for updates

### Strategy Calculation Timing
- **On-demand**: Calculate when requested
- **Scheduled**: Calculate periodically (e.g., every 5 minutes)
- **Real-time**: Calculate on each new candle
- **Recommendation**: Real-time for active setups, on-demand for historical

### Order Execution Safety
- **Paper trading mode**: Default for testing
- **Confirmation required**: Always require user confirmation
- **Risk limits**: Maximum position size, stop-loss requirements
- **Order validation**: Check account balance, position limits

## Dependencies

### New Backend Dependencies
- `node-cron` or `bull`: Job scheduling for data collection
- (Optional) `redis`: For job queue if using Bull

### New Frontend Dependencies
- None (existing dependencies sufficient)

### Database
- PostgreSQL with TimescaleDB (already configured)
- No new extensions required

## Migration Path

### Step 1: Database Migration
- Run SQL scripts to create new tables
- Add indexes and views

### Step 2: Backend Services
- Implement trading setup service
- Implement data collector service
- Implement strategy service
- Add new API routes

### Step 3: Frontend Components
- Create configuration page
- Create standalone chart page
- Enhance existing components

### Step 4: Integration
- Connect frontend to backend APIs
- Test end-to-end workflows
- Add error handling and validation

### Step 5: Deployment
- Deploy backend changes
- Deploy frontend changes
- Monitor and adjust

## Success Criteria

1. ✅ User can select symbol and multiple timeframes
2. ✅ User can select multiple indicators and strategies
3. ✅ Charts spawn in separate browser tabs with allocated port
4. ✅ Market data automatically collected for selected symbol+timeframes
5. ✅ Indicators and strategies calculated and stored in database
6. ✅ Strategy signals displayed on charts
7. ✅ Buy/sell orders can be placed through the system
8. ✅ Order execution tracked and displayed

## Notes

- **No reinvention**: Reuse existing components, services, and patterns
- **Incremental development**: Build and test each phase before moving to next
- **Backward compatibility**: Ensure existing functionality continues to work
- **Remote deployment**: All changes must work in remote environment (no local dependencies)

## Estimated Effort

- **Phase 1 (Frontend)**: 2-3 weeks
- **Phase 2 (Backend)**: 3-4 weeks
- **Phase 3 (Integration)**: 1-2 weeks
- **Phase 4 (Database)**: 1 week
- **Phase 5 (UI/UX)**: 1-2 weeks
- **Phase 6 (Testing)**: 1-2 weeks

**Total**: 9-14 weeks (depending on team size and complexity)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Planning Phase

