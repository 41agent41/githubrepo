# Download Historical Data Feature (Enhanced)

## Overview

The enhanced Download Historical Data feature provides a comprehensive solution for collecting, validating, and monitoring market data from Interactive Brokers API. It consolidates multiple data collection workflows into a single, intuitive web interface.

## ✨ Enhanced Features

### 🎯 **Multiple Collection Modes**
- **📊 Single Symbol Mode**: Original functionality for individual symbol collection
- **📈 Bulk Collection Mode**: Collect multiple symbols across multiple timeframes
- **🔍 Data Validation Mode**: Validate data quality and integrity
- **🏥 Health Monitoring**: Real-time system health checks

### 🚀 **Advanced Capabilities**
- **Batch Processing**: Simultaneous collection of multiple symbols and timeframes
- **Progress Tracking**: Real-time progress indicators and detailed result reporting
- **Error Handling**: Built-in retry logic and user-friendly error messages
- **Data Quality Checks**: OHLC validation, gap detection, and integrity verification
- **System Monitoring**: Database and service connectivity monitoring

## How to Use

### 1. Access the Download Page

Navigate to the main page and click on the "Download Data" card, or go directly to `/download`.

### 2. Select Collection Mode

Use the mode toggle buttons to choose your collection approach:

#### 📊 **Single Symbol Mode** (Default)
**Best for**: Quick data collection for specific analysis

1. **Configure Data Source**:
   - **Market & Symbol**: Choose region, exchange, security type, and symbol
   - **Time Period**: Select predefined periods or custom date ranges
   - **Timeframe**: Choose data granularity (tick to daily)

2. **Download & Upload**:
   - Click "Download from IB API" to fetch data
   - Review data in the interactive viewer
   - Click "Load to PostgreSQL" to store in database

#### 📈 **Bulk Collection Mode**
**Best for**: Building comprehensive datasets, initial database population

1. **Configure Bulk Collection**:
   - **Symbols**: Enter comma-separated symbols (e.g., `MSFT,AAPL,GOOGL,AMZN,TSLA`)
   - **Timeframes**: Select multiple timeframes using checkboxes
   - **Time Period**: Choose the historical period for all symbols

2. **Start Collection**:
   - Click "Start Bulk Collection"
   - Monitor real-time progress for each symbol/timeframe combination
   - Review detailed results showing success/failure for each operation

#### 🔍 **Data Validation Mode**
**Best for**: Data quality assurance, identifying gaps or issues

1. **Configure Validation**:
   - **Symbols**: Enter symbols to validate (comma-separated)
   - **Timeframes**: Select timeframes to check
   - **Validation Period**: Choose date range for validation

2. **Run Validation**:
   - Click "Validate Data Quality"
   - Review validation results showing:
     - OHLC integrity issues
     - Time series gaps
     - Volume anomalies
     - Overall data quality scores

#### 🏥 **Health Check**
**Best for**: Troubleshooting, system monitoring

- Click "Health Check" button anytime to verify:
  - Database connectivity
  - IB Service status
  - Overall system health

## Data Structure

The downloaded data includes the following fields:

- **timestamp**: Unix timestamp of the data point
- **open**: Opening price
- **high**: Highest price during the period
- **low**: Lowest price during the period
- **close**: Closing price
- **volume**: Trading volume
- **wap**: Volume Weighted Average Price (if available)
- **count**: Number of trades (if available)

## Database Schema

Data is stored in the following PostgreSQL tables:

### contracts
- Stores contract information (symbol, security type, exchange, etc.)
- Unique constraint prevents duplicate contracts

### candlestick_data
- Stores OHLCV candlestick data
- Links to contracts via contract_id
- Includes timeframe and timestamp information
- Unique constraint prevents duplicate data points

## API Endpoints

### Single Symbol Download
```
GET /api/market-data/history
```
**Parameters:**
- `symbol`: Trading symbol
- `timeframe`: Data granularity
- `period`: Time period or 'CUSTOM'
- `start_date`: Custom start date (if using custom range)
- `end_date`: Custom end date (if using custom range)
- `account_mode`: Paper or live trading mode
- `secType`: Security type
- `exchange`: Exchange
- `currency`: Currency

### Upload Data
```
POST /api/market-data/upload
```
**Body:**
```json
{
  "symbol": "MSFT",
  "timeframe": "1hour",
  "bars": [...],
  "account_mode": "paper",
  "secType": "STK",
  "exchange": "NASDAQ",
  "currency": "USD"
}
```

### 🆕 Bulk Collection
```
POST /api/market-data/bulk-collect
```
**Body:**
```json
{
  "symbols": ["MSFT", "AAPL", "GOOGL"],
  "timeframes": ["1day", "1hour", "15min"],
  "period": "1Y",
  "account_mode": "paper",
  "secType": "STK",
  "exchange": "SMART",
  "currency": "USD"
}
```

### 🆕 Data Validation
```
POST /api/market-data/validate
```
**Body:**
```json
{
  "symbols": ["MSFT", "AAPL"],
  "timeframes": ["1day", "1hour"],
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

### 🆕 System Health
```
GET /api/market-data/health
```
**Response:**
```json
{
  "healthy": true,
  "services": {
    "database": true,
    "ib_service": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Handling

The feature includes comprehensive error handling for:

- **Connection Issues**: IB Gateway connection problems
- **Data Validation**: Invalid symbols or parameters
- **Database Errors**: PostgreSQL connection and constraint violations
- **Timeout Issues**: Long-running operations
- **Permission Issues**: Data access restrictions

## Data Quality

- **Duplicate Prevention**: Automatic handling of duplicate data points
- **Data Validation**: Validation of OHLCV data integrity
- **Conflict Resolution**: Upsert operations for existing data
- **Error Tracking**: Detailed error reporting for failed operations

## Performance Considerations

- **Batch Processing**: Efficient handling of large datasets
- **Connection Pooling**: Optimized database connections
- **Timeout Management**: Configurable timeouts for long operations
- **Memory Management**: Efficient data processing and storage

## Troubleshooting

### Common Issues

1. **"IB Gateway timeout"**
   - Check IB Gateway connection
   - Verify market data subscriptions
   - Try smaller time periods

2. **"No data received"**
   - Verify symbol exists on selected exchange
   - Check market hours for the instrument
   - Ensure sufficient market data permissions

3. **"Database connection refused"**
   - Verify PostgreSQL service is running
   - Check database connection settings
   - Ensure proper database permissions

4. **"Duplicate key violation"**
   - Normal behavior for existing data
   - Data will be updated rather than inserted
   - Check upload results for actual changes

### Debug Information

The application provides detailed logging for:
- Download progress and timing
- Data validation results
- Database operation statistics
- Error details and stack traces

## Future Enhancements

- **Bulk Download**: Download multiple symbols simultaneously
- **Scheduled Downloads**: Automated data collection
- **Data Compression**: Efficient storage of large datasets
- **Advanced Filtering**: More granular data selection options
- **Export Formats**: Additional export options (Excel, Parquet, etc.)

