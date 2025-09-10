# TradingApp Database Architecture

## 🎯 Architecture Overview

The TradingApp database follows a **raw data only** architecture where the database stores pure market data from IB Gateway, and all technical analysis is performed by TradingView Lightweight Charts on the frontend.

## 🏗️ Design Philosophy

### **Separation of Concerns**
- **Database**: Pure data storage and retrieval
- **Backend**: Data streaming and API services  
- **Frontend**: Technical analysis and visualization

### **Benefits**
- **Simplified Database**: Faster queries, easier maintenance
- **Real-time Analysis**: TradingView Charts provide instant calculations
- **Flexible Indicators**: Easy to add/modify without database changes
- **Better Performance**: Database focuses on storage, not processing
- **Scalability**: Components scale independently

## 📊 Database Schema

### **Core Data Tables**

#### **contracts**
Stores contract information from IB Gateway
```sql
- id: Primary key
- symbol: Stock symbol (e.g., 'MSFT')
- sec_type: Security type ('STK', 'OPT', 'FUT', etc.)
- exchange: Exchange ('NASDAQ', 'ARCA', etc.)
- currency: Currency ('USD', 'EUR', etc.)
- contract_id: IB Gateway contract ID
- created_at/updated_at: Timestamps
```

#### **candlestick_data** (TimescaleDB Hypertable)
Raw OHLCV data from IB Gateway
```sql
- id: Primary key
- contract_id: Foreign key to contracts
- timestamp: TIMESTAMPTZ (timezone-aware)
- timeframe: Data interval ('1min', '5min', '1day', etc.)
- open/high/low/close: Price data from IB Gateway
- volume: Trading volume from IB Gateway
- wap: Volume Weighted Average Price from IB Gateway
- count: Number of trades from IB Gateway
- created_at: Record creation timestamp
```

#### **tick_data** (TimescaleDB Hypertable)
Raw tick data from IB Gateway
```sql
- id: Primary key
- contract_id: Foreign key to contracts
- timestamp: TIMESTAMPTZ (timezone-aware)
- tick_type: Tick type ('bid', 'ask', 'last', 'volume', etc.)
- price: Tick price from IB Gateway
- size: Tick size from IB Gateway
- exchange: Exchange where tick occurred
- special_conditions: Special trading conditions
- created_at: Record creation timestamp
```

### **Metadata Tables**

#### **data_collection_sessions**
Tracks data collection from IB Gateway
```sql
- id: Primary key
- contract_id: Foreign key to contracts
- timeframe: Data interval being collected
- start_time/end_time: Collection session timespan
- status: Collection status ('active', 'completed', 'failed')
- records_collected: Number of records collected
- error_message: Error details if failed
```

#### **data_quality_metrics**
Monitors raw data quality
```sql
- id: Primary key
- contract_id: Foreign key to contracts
- timeframe: Data interval
- date: Date of metrics
- total_bars/missing_bars/duplicate_bars/invalid_bars: Quality counts
- data_quality_score: Overall quality score (0.0 to 1.0)
```

#### **data_collection_config**
Configuration for data collection
```sql
- id: Primary key
- contract_id: Foreign key to contracts
- timeframe: Data interval
- enabled: Whether collection is enabled
- auto_collect: Automatic collection flag
- collection_interval_minutes: Collection frequency
- retention_days: How long to keep data
```

## 🚀 TimescaleDB Features

### **Hypertables**
- **Automatic Partitioning**: Data partitioned by time for optimal performance
- **Chunk Management**: 1-day chunks for candlestick data, 1-hour for tick data
- **Compression**: Automatic compression of older data chunks

### **Continuous Aggregates**
- **daily_candlestick_data**: Pre-computed daily summaries
- **hourly_candlestick_data**: Pre-computed hourly summaries
- **Real-time Refresh**: Automatic refresh policies every hour

### **Retention Policies**
- **Candlestick Data**: 2 years retention
- **Tick Data**: 30 days retention (high volume)
- **Automatic Cleanup**: No manual maintenance required

## 🔄 Data Flow

### **1. Data Ingestion Pipeline**
```
IB Gateway → Backend Service → Validation → TimescaleDB Hypertables
```

**Process:**
1. Backend connects to IB Gateway
2. Requests historical/real-time data
3. Validates raw data quality
4. Stores in appropriate hypertables
5. Updates collection metadata

### **2. Data Retrieval Pipeline**
```
TimescaleDB → Backend API → Frontend → TradingView Charts
```

**Process:**
1. Frontend requests data via REST API
2. Backend queries TimescaleDB with optimized queries
3. Returns raw OHLCV data in JSON format
4. Frontend receives pure data (no calculations)
5. TradingView Charts renders with technical analysis

### **3. Technical Analysis Pipeline**
```
Raw Data → Frontend Calculations → Chart Display
```

**Process:**
1. TradingView Charts receives raw OHLCV data
2. JavaScript libraries calculate indicators (SMA, RSI, MACD, etc.)
3. Indicators rendered as overlay series on charts
4. Real-time updates as new data arrives

## 📈 Performance Characteristics

### **Database Performance**
- **Time-range Queries**: 10-100x faster with hypertables
- **Data Ingestion**: Optimized for high-frequency streaming
- **Storage Efficiency**: Automatic compression reduces storage costs
- **Query Patterns**: Optimized indexes for time-series access

### **API Performance**
- **Simple Queries**: No complex joins or calculations
- **Fast Response**: Raw data retrieval only
- **Caching**: Continuous aggregates provide instant summaries
- **Scalability**: Stateless API design

### **Frontend Performance**
- **Real-time Indicators**: Calculated on demand
- **Interactive Charts**: Professional-grade visualization
- **Responsive UI**: No waiting for server calculations
- **Flexible Analysis**: Easy to add/modify indicators

## 🔧 API Design

### **Raw Data Endpoints**

#### **Historical Data**
```http
GET /api/market-data/history?symbol=MSFT&timeframe=1day&start=2024-01-01&end=2024-01-31
```

**Response:**
```json
{
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "open": 150.25,
      "high": 151.50,
      "low": 149.80,
      "close": 151.20,
      "volume": 1000000,
      "wap": 150.75,
      "count": 5000
    }
  ],
  "metadata": {
    "symbol": "MSFT",
    "timeframe": "1day",
    "total_records": 1,
    "data_quality_score": 1.0
  }
}
```

#### **Real-time Data**
```http
GET /api/market-data/latest?symbol=MSFT&timeframe=1min
```

#### **Tick Data**
```http
GET /api/market-data/ticks?symbol=MSFT&start=2024-01-01T09:30:00Z&end=2024-01-01T16:00:00Z
```

### **Contract Information**
```http
GET /api/contracts?symbol=MSFT
GET /api/contracts/search?query=AAPL
```

## 🎨 Frontend Integration

### **TradingView Charts Setup**
```typescript
import { createChart } from 'lightweight-charts';

// Create chart instance
const chart = createChart(container, {
  width: 800,
  height: 400,
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
  },
});

// Add candlestick series for raw data
const candlestickSeries = chart.addCandlestickSeries({
  upColor: '#26a69a',
  downColor: '#ef5350',
  borderVisible: false,
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
});
```

### **Technical Indicators**
```typescript
import { SMA, RSI, MACD } from 'technicalindicators';

// Fetch raw data from API
const response = await fetch('/api/market-data/history?symbol=MSFT&timeframe=1day');
const rawData = await response.json();

// Set raw data on chart
candlestickSeries.setData(rawData.data);

// Calculate indicators from raw data
const closePrices = rawData.data.map(bar => bar.close);

// Simple Moving Average
const sma20 = SMA.calculate({
  period: 20,
  values: closePrices
});

// Relative Strength Index
const rsi = RSI.calculate({
  period: 14,
  values: closePrices
});

// Moving Average Convergence Divergence
const macd = MACD.calculate({
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  values: closePrices
});

// Add indicator series to chart
const sma20Series = chart.addLineSeries({
  color: '#2196F3',
  lineWidth: 2,
  title: 'SMA 20',
});

const rsiSeries = chart.addLineSeries({
  color: '#FF9800',
  lineWidth: 2,
  title: 'RSI',
  priceScaleId: 'rsi', // Separate scale for RSI
});

// Set indicator data
sma20Series.setData(sma20.map((value, index) => ({
  time: rawData.data[index + 19].timestamp, // Offset for SMA period
  value: value
})));

rsiSeries.setData(rsi.map((value, index) => ({
  time: rawData.data[index + 13].timestamp, // Offset for RSI period
  value: value
})));
```

## 🔍 Data Quality Monitoring

### **Quality Metrics**
- **Total Bars**: Number of data points collected
- **Missing Bars**: Gaps in data collection
- **Duplicate Bars**: Duplicate timestamps detected
- **Invalid Bars**: Data validation failures
- **Quality Score**: Overall data quality (0.0 to 1.0)

### **Monitoring Queries**
```sql
-- Check data quality for recent data
SELECT 
    c.symbol,
    dqm.date,
    dqm.data_quality_score,
    dqm.total_bars,
    dqm.missing_bars,
    dqm.duplicate_bars,
    dqm.invalid_bars
FROM data_quality_metrics dqm
JOIN contracts c ON dqm.contract_id = c.id
WHERE dqm.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dqm.date DESC, c.symbol;

-- Check collection sessions
SELECT 
    c.symbol,
    dcs.timeframe,
    dcs.status,
    dcs.records_collected,
    dcs.start_time,
    dcs.end_time,
    dcs.error_message
FROM data_collection_sessions dcs
JOIN contracts c ON dcs.contract_id = c.id
WHERE dcs.start_time >= NOW() - INTERVAL '1 day'
ORDER BY dcs.start_time DESC;
```

## 🛡️ Security Architecture

### **Database Security**
- **SSL/TLS encryption** for all connections
- **Role-based access control** with dedicated database user
- **Network isolation** restricting access to application servers
- **Regular security updates** for PostgreSQL/TimescaleDB

### **API Security**
- **Input validation** for all API parameters
- **Rate limiting** to prevent abuse
- **Authentication tokens** for API access
- **Data sanitization** before database operations

### **Data Privacy**
- **No sensitive data** stored in database (only market data)
- **Audit logging** for data access patterns
- **Backup encryption** for data at rest
- **GDPR compliance** for any user-related data

## 🎯 Scalability Considerations

### **Horizontal Scaling**
- **Database**: TimescaleDB supports distributed hypertables
- **Backend**: Stateless API servers can be load balanced
- **Frontend**: CDN distribution for static assets

### **Vertical Scaling**
- **Database**: Increase CPU/memory for query performance
- **Backend**: Scale API server resources based on load
- **Storage**: SSD storage for optimal I/O performance

### **Data Growth Management**
- **Automated retention policies** prevent unbounded growth
- **Compression policies** reduce storage requirements
- **Partitioning strategies** maintain query performance

## 📊 Monitoring and Observability

### **Database Metrics**
- Query performance and execution times
- Storage usage and growth rates
- Connection pool utilization
- Data quality scores over time

### **API Metrics**
- Request/response times
- Error rates and types
- Throughput and concurrency
- Cache hit rates

### **Business Metrics**
- Data collection success rates
- Market data freshness
- User engagement with charts
- System availability and uptime

## 🎯 Future Considerations

### **Potential Enhancements**
- **Real-time streaming** with WebSocket connections
- **Machine learning** features for pattern recognition
- **Additional data sources** beyond IB Gateway
- **Advanced analytics** with custom indicators

### **Technology Evolution**
- **Cloud-native deployment** with Kubernetes
- **Microservices architecture** for better isolation
- **Event-driven architecture** with message queues
- **GraphQL API** for more flexible data access

This architecture provides a solid foundation for high-performance market data streaming with professional-grade technical analysis capabilities.

