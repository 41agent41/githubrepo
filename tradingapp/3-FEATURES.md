# TradingApp Features Guide

**Reading order:** 4 of 4 — Read after [2-REMOTE_ACCESS.md](2-REMOTE_ACCESS.md)

Comprehensive guide to all features available in TradingApp - the professional market data exploration platform.

## Table of Contents

1. [Download & Data Collection](#download--data-collection)
2. [Database Connectivity Test](#database-connectivity-test)
3. [Trading Setup & Charts](#trading-setup--charts)
4. [Market Data Filtering](#market-data-filtering)
5. [TradingView Charts](#tradingview-charts)
6. [Asset Class Coverage](#asset-class-coverage)
7. [Real-time Data](#real-time-data)
8. [API & Integration](#api--integration)

---

## Download & Data Collection

The Download Historical Data page (`/download`) provides a comprehensive solution for collecting, validating, and monitoring market data from the Interactive Brokers API. All data collection features are available through the web interface (no command-line scripts required).

### Prerequisites

- IB Gateway/TWS running and connected
- Backend, IB Service, and Frontend running
- PostgreSQL/TimescaleDB with schema applied

### How to Access

1. Navigate to the frontend (e.g., `http://your-server:3000`)
2. Go to **Download Historical Data** (`/download`)
3. Use the mode toggle buttons to switch between collection modes

### Collection Modes

- **Single Symbol Mode**: Download individual symbols (market/symbol selection, timeframe, period). Download from IB API, review in viewer, load to PostgreSQL.
- **Bulk Collection Mode**: Collect multiple symbols across multiple timeframes (e.g., `MSFT,AAPL,GOOGL`). Comma-separated input, progress tracking, detailed results.
- **Data Validation Mode**: Validate data quality (OHLC integrity, time series gaps, volume anomalies, quality scores).
- **Health Check**: Verify database connectivity, IB Service status, and overall system health.

### API Endpoints

- `GET /api/market-data/history` — Single symbol historical data
- `POST /api/market-data/upload` — Upload bars to database
- `POST /api/market-data/bulk-collect` — Bulk collection (body: `symbols`, `timeframes`, `period`, `account_mode`, `secType`, `exchange`, `currency`)
- `POST /api/market-data/validate` — Data validation (body: `symbols`, `timeframes`, `start_date`, `end_date`)
- `GET /api/market-data/health` — System health

### Data Storage

- **contracts**: Contract info (symbol, secType, exchange)
- **candlestick_data**: OHLCV data linked to contracts, with timeframe and timestamp

### Troubleshooting

- **System health issues**: Use the Health Check button on the Download page; verify IB Gateway and Backend are running.
- **Bulk collection failures**: Check detailed results for symbol/timeframe errors; verify IB market data subscriptions; try smaller batches.
- **Data validation failures**: Review validation details for gaps or quality issues; consider re-collecting problematic datasets.
- **Connection problems**: Verify all services are running and reachable; check service URLs in System Settings.

### Migration from Scripts

If you previously used Python scripts: `collect_market_data.py` → Bulk Collection mode; `data_validator.py` → Data Validation mode; `monitoring.py` → Health Check button. All configuration is now via the web interface.

---

## Database Connectivity Test

Available on the Download page (`/download`) via the **Database Test** mode toggle. Provides comprehensive testing of the PostgreSQL connection before downloading data.

### Capabilities

- Basic connection test, connection pool status, database version
- Schema validation (tables, indexes, constraints)
- Performance testing (query times)
- Data integrity checks, transaction testing
- Visual status: Healthy / Warning / Unhealthy
- Auto-refresh (optional, 30s) and manual "Test Now"

### API Endpoints

- `POST /api/database/connectivity-test` — Full connectivity test
- `GET /api/database/health` — Simple health check
- `GET /api/database/stats` — Database statistics

### Configuration

Uses the same `POSTGRES_*` environment variables as the main application.

---

## Trading Setup & Charts

### Configure Page (`/configure`)

- **Symbol selection**: Search and select market symbols (reuses MarketDataFilter)
- **Multi-timeframe selection**: 5min, 15min, 30min, 1hour, 4hour, 8hour, 1day
- **Indicator/Strategy selection**: Multiple indicators and strategies (MA Crossover, RSI, MACD, Bollinger Bands, etc.)
- **Port allocation**: Automatic port allocation (3001–3100) for chart URLs
- **Chart spawning**: Open charts in separate browser tabs via `/chart/[symbol]/[timeframe]`

### Standalone Chart Page (`/chart/[symbol]/[timeframe]`)

- TradingView lightweight-charts
- Real-time data and WebSocket updates
- Strategy signal display, connection status indicator
- URL parameters: setupId, indicators, strategies, port

### API Endpoints

- `POST /api/trading-setup/create` — Create setup
- `GET /api/trading-setup/:id` — Get setup
- `GET /api/trading-setup` — List setups
- `PUT /api/trading-setup/:id` — Update setup
- `DELETE /api/trading-setup/:id` — Delete setup

---

## Market Data Filtering

### Comprehensive Search Interface

**Symbol Search**
- **Ticker Symbol Search**: Enter stock symbols (e.g., AAPL, MSFT, GOOGL)
- **Company Name Search**: Search by company name with fuzzy matching
- **Smart Search**: Toggle between symbol and name-based search
- **Auto-complete**: Intelligent suggestions as you type

**Security Type Filtering**
- **Stocks (STK)**: Individual company stocks
- **Options (OPT)**: Stock and index options
- **Futures (FUT)**: Commodity and financial futures
- **Forex (CASH)**: Currency pairs
- **Bonds (BOND)**: Government and corporate bonds
- **CFDs (CFD)**: Contracts for difference
- **Commodities (CMDTY)**: Physical commodities
- **Cryptocurrencies (CRYPTO)**: Digital assets
- **Mutual Funds (FUND)**: Open-end funds
- **Indices (IND)**: Market indices
- **Warrants (WAR)**: Stock warrants
- **Bags (BAG)**: Combination orders

**Exchange Selection**
- **US Exchanges**: NYSE, NASDAQ, AMEX, CBOE
- **European Exchanges**: LSE, EUREX, FWB, AEB
- **Asian Exchanges**: TSE, HKSE, SGX
- **Commodities**: CME, NYMEX, COMEX, ICE
- **Forex**: IDEALPRO
- **Smart Routing**: SMART exchange for best execution

**Currency Filtering**
- **Major Currencies**: USD, EUR, GBP, JPY
- **Secondary Currencies**: CAD, AUD, CHF, HKD
- **Emerging Markets**: CNH, KRW, INR, BRL
- **Multi-currency Support**: Filter by base currency

**Timeframe Selection**
- **Intraday**: 1min, 5min, 15min, 30min
- **Short-term**: 1hour, 2hour, 4hour
- **Medium-term**: 8hour, 12hour
- **Long-term**: 1day, 1week, 1month

### Advanced Filtering Options

**Filter Combinations**
- **Multiple Criteria**: Combine any filters for precise results
- **Smart Defaults**: Intelligent default selections
- **Filter Memory**: Remember your last used filters
- **Quick Filters**: Preset filter combinations for common searches

**Search Refinement**
- **Narrow Results**: Progressively refine search results
- **Broad Search**: Expand search when no results found
- **Fallback Options**: Alternative suggestions for failed searches
- **Result Sorting**: Sort by relevance, volume, or alphabetically

## 📊 TradingView Charts

### Professional Charting Engine

**Chart Types**
- **Candlestick Charts**: OHLC data with professional styling
- **Volume Bars**: Trading volume overlay
- **Price Action**: Clean price-focused charts
- **Multi-timeframe**: Switch between timeframes seamlessly

**Timeframe Support**
- **Ultra Short-term**: 1min, 5min (for active trading)
- **Short-term**: 15min, 30min (for swing trading)
- **Medium-term**: 1hour, 4hour (for position trading)
- **Long-term**: 8hour, 1day (for investment analysis)

**Historical Data Periods**
- **1 Day**: Latest trading day
- **1 Week**: 7 days of data
- **1 Month**: 30 days of data
- **3 Months**: Quarterly view
- **6 Months**: Semi-annual view
- **1 Year**: Full year analysis

### Chart Features

**Interactive Elements**
- **Zoom & Pan**: Mouse wheel zoom, click-and-drag panning
- **Crosshair**: Precise OHLCV value inspection
- **Auto-fit**: Automatic chart scaling and fitting
- **Responsive Design**: Adapts to screen size

**Visual Indicators**
- **Price Levels**: Current price highlighting
- **Volume Bars**: Trading volume visualization
- **Time Axis**: Clear time labeling
- **Price Axis**: Precise price scaling

**Real-time Updates**
- **Live Data**: Real-time price updates
- **Smooth Animation**: Animated chart updates
- **Connection Status**: Visual connection indicators
- **Data Quality**: Real-time data quality monitoring

## 🏛️ Asset Class Coverage

### Equities
- **US Stocks**: All major US exchanges
- **International Stocks**: Global equity markets
- **ETFs**: Exchange-traded funds
- **REITs**: Real estate investment trusts
- **ADRs**: American depositary receipts

### Options
- **Equity Options**: Stock options chains
- **Index Options**: SPX, NDX, RUT options
- **Weekly Options**: Short-term option contracts
- **LEAPS**: Long-term option contracts

### Futures
- **Equity Index Futures**: ES, NQ, YM, RTY
- **Commodity Futures**: CL, GC, SI, NG
- **Currency Futures**: EUR, GBP, JPY pairs
- **Interest Rate Futures**: ZB, ZN, ZF, ZT

### Forex
- **Major Pairs**: EUR/USD, GBP/USD, USD/JPY
- **Minor Pairs**: EUR/GBP, AUD/CAD, CHF/JPY
- **Exotic Pairs**: USD/ZAR, EUR/TRY, GBP/MXN
- **Cross Rates**: All major currency combinations

### Fixed Income
- **Government Bonds**: US Treasury, European bonds
- **Corporate Bonds**: Investment grade and high yield
- **Municipal Bonds**: State and local government bonds
- **International Bonds**: Global fixed income

### Commodities
- **Energy**: Crude oil, natural gas, gasoline
- **Metals**: Gold, silver, copper, platinum
- **Agriculture**: Wheat, corn, soybeans, sugar
- **Livestock**: Cattle, hogs, feeder cattle

### Cryptocurrencies
- **Bitcoin Futures**: CME and CBOE bitcoin futures
- **Ethereum Futures**: ETH futures contracts
- **Crypto CFDs**: Various cryptocurrency CFDs
- **Crypto Indices**: Cryptocurrency index products

## 📡 Real-time Data

### Market Data Feed
- **Live Prices**: Real-time bid/ask/last prices
- **Volume Data**: Current trading volume
- **Price Changes**: Instant price movement updates
- **Market Status**: Open/closed market indicators

### Data Quality
- **Low Latency**: Minimal delay from exchange
- **High Frequency**: Up to tick-by-tick data
- **Data Integrity**: Comprehensive data validation
- **Reliable Feed**: Redundant data connections

### WebSocket Technology
- **Live Streaming**: Continuous data stream
- **Efficient Updates**: Only changed data transmitted
- **Connection Management**: Automatic reconnection
- **Multiplexing**: Multiple symbols in one connection

## API & Integration

### REST API
- **Market Data**: `/api/market-data/search`, `/history`, `/realtime`, `/bulk-collect`, `/validate`
- **Database**: `/api/database/health`, `/api/database/connectivity-test`, `/api/database/stats`
- **Trading Setup**: `/api/trading-setup` (CRUD)
- **Account**: `/api/account`, `/api/connections`

### Interactive Brokers
- IB Gateway connection (configurable via `/connections` or `./tradingapp.sh config`)
- Contract search, historical and real-time market data
- Order placement and account data (via IB service)

### Search & Discovery
- **Fuzzy matching**, **autocomplete**, **symbol resolution**
- **Sector browsing**, **market screening**, **trending assets**

## Usage Examples

### Stock Analysis Workflow
1. **Search**: Enter "AAPL" or "Apple Inc."
2. **Filter**: Select "Stock" and "NASDAQ"
3. **Select**: Choose AAPL contract
4. **Analyze**: View real-time data and charts
5. **Chart**: Switch between different timeframes
6. **Monitor**: Track price movements in real-time

### Options Trading Workflow
1. **Search**: Enter underlying symbol "SPY"
2. **Filter**: Select "Option" security type
3. **Browse**: View available option chains
4. **Select**: Choose specific option contract
5. **Analyze**: View option pricing and Greeks
6. **Chart**: Analyze underlying price movement

### Futures Analysis Workflow
1. **Search**: Browse futures contracts
2. **Filter**: Select "Future" and "CME"
3. **Select**: Choose ES (E-mini S&P 500)
4. **Analyze**: View contract specifications
5. **Chart**: Analyze price trends and volume
6. **Monitor**: Track roll dates and expiration

### Forex Trading Workflow
1. **Search**: Enter currency pair "EUR/USD"
2. **Filter**: Select "Forex" and "IDEALPRO"
3. **Select**: Choose EUR.USD contract
4. **Analyze**: View real-time rates and spreads
5. **Chart**: Analyze currency trends
6. **Monitor**: Track economic events impact

## 🎯 Advanced Features

### Custom Watchlists
- **Personal Lists**: Create custom symbol lists
- **Categorization**: Organize by sector or strategy
- **Alerts**: Set price alerts for watchlist items
- **Sharing**: Share watchlists with others

### Portfolio Integration
- **Position Tracking**: Monitor current positions
- **P&L Analysis**: Real-time profit/loss tracking
- **Risk Management**: Position sizing and risk metrics
- **Performance Analytics**: Historical performance analysis

### Market Scanning
- **Custom Scans**: Create custom market scans
- **Pre-built Scans**: Use pre-configured scans
- **Alert System**: Get notified of scan results
- **Backtesting**: Test scan performance historically

### Data Export
- **CSV Export**: Export data to CSV format
- **JSON Export**: Export data as JSON
- **PDF Reports**: Generate PDF reports
- **API Access**: Programmatic data access

---

**🎯 TradingApp provides professional-grade market data exploration with comprehensive filtering, real-time charts, and seamless Interactive Brokers integration for serious traders and investors.** 