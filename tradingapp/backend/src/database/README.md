# TradingApp Database Setup

## 🎯 Quick Start

The TradingApp database stores **only raw market data** from IB Gateway. All technical indicators and analysis are handled by **TradingView Lightweight Charts** on the frontend.

### **Choose Your Setup:**

#### **🚀 Option 1: TimescaleDB (Recommended for Production)**
```bash
# For new TimescaleDB deployment
psql -h YOUR_DB_HOST -U tradingapp -d tradingapp -f timescaledb-schema.sql
```

#### **📊 Option 2: Standard PostgreSQL**
```bash
# For standard PostgreSQL
psql -h YOUR_DB_HOST -U tradingapp -d tradingapp -f postgresql-schema.sql
```

#### **🔄 Option 3: Migration from Existing Database**
```bash
# Migrate existing database to raw data TimescaleDB
psql -h YOUR_DB_HOST -U tradingapp -d tradingapp -f migration-script.sql
```

## 📁 File Structure

```
backend/src/database/
├── README.md                    # This file - start here
├── timescaledb-schema.sql       # TimescaleDB schema (recommended)
├── postgresql-schema.sql        # Standard PostgreSQL schema
├── migration-script.sql         # Migration from existing database
└── docs/
    ├── SETUP_GUIDE.md          # Detailed setup instructions
    └── ARCHITECTURE.md         # Architecture documentation
```

## 🏗️ Database Architecture

### **Raw Data Only**
- **contracts**: IB Gateway contract information
- **candlestick_data**: Raw OHLCV data from IB Gateway
- **tick_data**: Raw tick data from IB Gateway
- **data_collection_***: Metadata and monitoring tables

### **No Technical Indicators**
- ❌ No SMA, RSI, MACD in database
- ✅ All indicators calculated by TradingView Charts on frontend

## ⚙️ Environment Configuration

```bash
# Database Configuration
POSTGRES_HOST=your-db-host.com
POSTGRES_PORT=5432
POSTGRES_USER=tradingapp
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=tradingapp
POSTGRES_SSL=true
```

## 🔧 Setup Steps

### **1. Database Setup**
Choose one of the schema files above based on your database type.

### **2. Verify Installation**
```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contracts', 'candlestick_data', 'tick_data');

-- Should return 3 rows
```

### **3. Test Connection**
```bash
# Test database connection
curl http://your-server:4000/api/database/health
```

## 📊 API Usage

### **Get Raw Market Data**
```http
GET /api/market-data/history?symbol=MSFT&timeframe=1day&start=2024-01-01&end=2024-01-31
```

**Response (Raw Data Only):**
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
      // WAP and count fields removed
    }
  ]
}
```

## 🎨 Frontend Integration

### **TradingView Charts**
```typescript
import { createChart } from 'lightweight-charts';
import { SMA, RSI } from 'technicalindicators';

// Get raw data from API
const response = await fetch('/api/market-data/history?symbol=MSFT');
const rawData = await response.json();

// Create chart
const chart = createChart(container);
const candlestickSeries = chart.addCandlestickSeries();
candlestickSeries.setData(rawData.data);

// Calculate indicators on frontend
const closePrices = rawData.data.map(bar => bar.close);
const sma20 = SMA.calculate({ period: 20, values: closePrices });

// Add indicator series
const sma20Series = chart.addLineSeries({ color: '#2196F3' });
sma20Series.setData(sma20.map((value, index) => ({
  time: rawData.data[index].timestamp,
  value: value
})));
```

## 🔍 Performance Benefits

- **10-100x faster** database queries (raw data only)
- **Smaller database** size and maintenance overhead
- **Real-time indicators** calculated on frontend
- **Flexible analysis** - easy to add/modify indicators
- **Better UX** - responsive and interactive charts

## 📚 Documentation

- **`docs/SETUP_GUIDE.md`** - Detailed setup instructions
- **`docs/ARCHITECTURE.md`** - Architecture overview and design decisions

## 🛠️ Troubleshooting

### **Common Issues**

#### **Connection Issues**
```bash
# Test database connection
telnet YOUR_DB_HOST 5432
```

#### **Schema Issues**
```sql
-- Check if TimescaleDB extension is available (if using TimescaleDB)
SELECT * FROM pg_extension WHERE extname = 'timescaledb';
```

#### **Data Quality Issues**
```sql
-- Check data quality metrics
SELECT * FROM data_quality_metrics 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY data_quality_score DESC;
```

## 🎯 Next Steps

1. **Choose your database setup** (TimescaleDB recommended)
2. **Run the appropriate schema file**
3. **Configure environment variables**
4. **Update frontend** to use TradingView Charts
5. **Test data streaming** from IB Gateway

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the detailed documentation in `docs/`
3. Verify your environment configuration

---

**Ready to get started?** Choose your setup option above and run the appropriate schema file!