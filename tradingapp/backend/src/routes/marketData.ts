import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { marketDataService, type Contract, type CandlestickBar, type TechnicalIndicator } from '../services/marketDataService.js';

const router = express.Router();
const IB_SERVICE_URL = process.env.IB_SERVICE_URL || 'http://ib_service:8000';

// Interface for market data request parameters
interface MarketDataQuery {
  symbol: string;
  timeframe: string;
  period: string;
}

// Interface for search request parameters
interface SearchQuery {
  symbol: string;
  secType: string;
  exchange?: string;
  currency?: string;
  searchByName?: boolean;
  account_mode?: string;
}

// Interface for advanced search request parameters
interface AdvancedSearchQuery {
  symbol?: string;
  secType: string;
  exchange?: string;
  currency?: string;
  expiry?: string;
  strike?: number;
  right?: string;
  multiplier?: string;
  includeExpired?: boolean;
  searchByName?: boolean;
  account_mode?: string;
}



// Helper function to check if data query is enabled via headers
function isDataQueryEnabled(req: Request): boolean {
  const enabled = req.headers['x-data-query-enabled'];
  if (typeof enabled === 'string') {
    return enabled.toLowerCase() === 'true';
  }
  if (Array.isArray(enabled)) {
    return enabled[0]?.toLowerCase() === 'true';
  }
  return false;
}

// Helper function to handle disabled data query response
function handleDisabledDataQuery(res: Response, message: string) {
  return res.status(200).json({
    disabled: true,
    message: message,
    timestamp: new Date().toISOString()
  });
}

// Contract search endpoint
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { symbol, secType, exchange, currency, searchByName, account_mode } = req.body as SearchQuery;

    // Validate required parameters
    if (!symbol || !secType) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'secType'],
        received: { symbol, secType, exchange, currency, searchByName }
      });
    }

    // Validate symbol - basic validation
    if (typeof symbol !== 'string' || symbol.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid symbol format. Symbol must be a non-empty string.',
        symbol: symbol
      });
    }

    // Validate security type
    const validSecTypes = ['STK', 'OPT', 'FUT', 'CASH', 'BOND', 'CFD', 'CMDTY', 'CRYPTO', 'WAR', 'FUND', 'IND', 'BAG'];
    if (!validSecTypes.includes(secType)) {
      return res.status(400).json({
        error: 'Invalid security type',
        valid_secTypes: validSecTypes,
        received: secType
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Market data search is disabled');
    }

    console.log(`Searching for contract: ${symbol} (${secType}) on ${exchange || 'any exchange'}`);

    const response = await axios.post(`${IB_SERVICE_URL}/contract/search`, {
      symbol: symbol,
      secType: secType,
      exchange: exchange,
      currency: currency,
      name: searchByName,  // IB service expects 'name' parameter, not 'searchByName'
      account_mode: account_mode
    }, {
      timeout: 30000, // 30 second timeout for search
      headers: {
        'Connection': 'close'
      }
    });

    console.log(`Found ${response.data?.results?.length || 0} contracts for ${symbol}`);

    // Store contracts in database for future reference
    if (response.data?.results && Array.isArray(response.data.results)) {
      for (const contract of response.data.results) {
        try {
          const contractData: Contract = {
            symbol: contract.symbol,
            secType: contract.secType,
            exchange: contract.exchange,
            currency: contract.currency,
            multiplier: contract.multiplier,
            expiry: contract.expiry,
            strike: contract.strike,
            right: contract.right,
            localSymbol: contract.localSymbol,
            contractId: contract.contractId
          };
          
          await marketDataService.getOrCreateContract(contractData);
        } catch (error) {
          console.error('Error storing contract in database:', error);
          // Continue processing other contracts
        }
      }
    }

    res.json(response.data);

  } catch (error: any) {
    console.error('Error in contract search:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'IB Service connection refused - service may be starting up';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out - IB Service may be busy';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to search for contracts';
    }
    
    res.status(statusCode).json({
      error: 'Failed to search for contracts',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Advanced search endpoint
router.post('/search/advanced', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      secType,
      exchange,
      currency,
      expiry,
      strike,
      right,
      multiplier,
      includeExpired,
      searchByName,
      account_mode
    } = req.body as AdvancedSearchQuery;

    // Validate required parameters
    if (!secType) {
      return res.status(400).json({
        error: 'Missing required parameter: secType',
        received: { secType, symbol, exchange, currency, expiry, strike, right, multiplier }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Advanced market data search is disabled');
    }

    console.log(`Advanced search for: ${secType} ${symbol || ''} on ${exchange || 'any exchange'}`);

    const response = await axios.post(`${IB_SERVICE_URL}/contract/advanced-search`, {
      symbol: symbol,
      secType: secType,
      exchange: exchange,
      currency: currency,
      expiry: expiry,
      strike: strike,
      right: right,
      multiplier: multiplier,
      includeExpired: includeExpired,
      name: searchByName,  // IB service expects 'name' parameter, not 'searchByName'
      account_mode: account_mode
    }, {
      timeout: 30000,
      headers: {
        'Connection': 'close'
      }
    });

    console.log(`Advanced search found ${response.data?.results?.length || 0} contracts`);

    // Store contracts in database
    if (response.data?.results && Array.isArray(response.data.results)) {
      for (const contract of response.data.results) {
        try {
          const contractData: Contract = {
            symbol: contract.symbol,
            secType: contract.secType,
            exchange: contract.exchange,
            currency: contract.currency,
            multiplier: contract.multiplier,
            expiry: contract.expiry,
            strike: contract.strike,
            right: contract.right,
            localSymbol: contract.localSymbol,
            contractId: contract.contractId
          };
          
          await marketDataService.getOrCreateContract(contractData);
        } catch (error) {
          console.error('Error storing contract in database:', error);
        }
      }
    }

    res.json(response.data);

  } catch (error: any) {
    console.error('Error in advanced contract search:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'IB Service connection refused - service may be starting up';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out - IB Service may be busy';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to perform advanced search';
    }
    
    res.status(statusCode).json({
      error: 'Failed to perform advanced search',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Historical data endpoint - now with database integration
router.get('/history', async (req: Request, res: Response) => {
  try {
    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Historical market data querying is disabled');
    }

    const { 
      symbol, 
      timeframe, 
      period, 
      account_mode, 
      start_date, 
      end_date, 
      secType, 
      exchange, 
      currency,
      include_indicators = 'false',
      use_database = 'true'
    } = req.query as Partial<MarketDataQuery & {
      start_date?: string;
      end_date?: string;
      account_mode?: string;
      secType?: string;
      exchange?: string;
      currency?: string;
      include_indicators?: string;
      use_database?: string;
    }>;

    // Validate required parameters
    if (!symbol || !timeframe) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'timeframe'],
        received: { symbol, timeframe, period, start_date, end_date }
      });
    }

    // Validate timeframe (tick data handled by streaming functions)
    const validTimeframes = ['1min', '5min', '15min', '30min', '1hour', '4hour', '8hour', '1day'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        error: 'Invalid timeframe',
        valid_timeframes: validTimeframes,
        received: timeframe
      });
    }

    // Check if we should use database first
    const useDatabase = use_database === 'true';
    const includeIndicators = include_indicators === 'true';

    // Helper function to calculate start date from period
    const getStartDateFromPeriod = (periodStr: string | undefined): Date => {
      const now = new Date();
      switch (periodStr) {
        case '1D': return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        case '5D': return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        case '1W': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '1M': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case '3M': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        case '6M': return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        case '1Y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        case '2Y': return new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        default: return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Default to 1 year for database queries
      }
    };

    if (useDatabase) {
      try {
        // Strategy: Get ALL data from database, then fill gap to current time from API
        const now = new Date();
        const veryOldDate = new Date('2020-01-01'); // Get all historical data
        
        console.log(`Database query for ${symbol} ${timeframe}: fetching all available data`);
        
        // Get ALL available data from database for this symbol/timeframe
        const dbData = await marketDataService.getHistoricalData(
          symbol,
          timeframe,
          veryOldDate,
          now,
          includeIndicators
        );

        if (dbData.length > 0) {
          console.log(`Retrieved ${dbData.length} bars from database for ${symbol} ${timeframe}`);
          
          // Find the latest timestamp in database data
          const latestDbTimestamp = dbData.reduce((max, bar) => {
            const barTime = new Date(bar.timestamp).getTime();
            return barTime > max ? barTime : max;
          }, 0);
          
          const latestDbDate = new Date(latestDbTimestamp);
          const timeSinceLastBar = now.getTime() - latestDbTimestamp;
          const hourInMs = 60 * 60 * 1000;
          
          console.log(`Latest DB data: ${latestDbDate.toISOString()}, Current: ${now.toISOString()}`);
          console.log(`Gap since last bar: ${(timeSinceLastBar / hourInMs).toFixed(1)} hours`);
          
          // If gap is more than 2 hours, fetch recent data from API to fill the gap
          let combinedBars = [...dbData];
          let dataSource = 'database';
          
          if (timeSinceLastBar > 2 * hourInMs) {
            // Calculate appropriate period based on gap size
            const gapDays = timeSinceLastBar / (24 * hourInMs);
            let gapPeriod = '1M';
            if (gapDays > 180) gapPeriod = '1Y';
            else if (gapDays > 90) gapPeriod = '6M';
            else if (gapDays > 30) gapPeriod = '3M';
            
            console.log(`Fetching gap data from API: gap=${gapDays.toFixed(0)} days, using period=${gapPeriod}`);
            
            try {
              // Fetch from API using period (more reliable than date ranges)
              const gapResponse = await axios.get(`${IB_SERVICE_URL}/market-data/history`, {
                params: {
                  symbol: symbol,
                  timeframe: timeframe,
                  period: gapPeriod,
                  account_mode: account_mode || 'paper',
                  secType: secType || 'STK',
                  exchange: exchange || 'SMART',
                  currency: currency || 'USD'
                },
                timeout: 60000
              });
              
              console.log(`API response: ${gapResponse.data?.bars?.length || 0} bars received`);
              
              if (gapResponse.data?.bars && gapResponse.data.bars.length > 0) {
                // Filter API bars to only include those after latest DB timestamp
                const newBars = gapResponse.data.bars
                  .filter((bar: any) => {
                    const barTime = (bar.timestamp || bar.time) * 1000; // Convert to ms if in seconds
                    return barTime > latestDbTimestamp;
                  })
                  .map((bar: any) => ({
                    timestamp: new Date((bar.timestamp || bar.time) * 1000).toISOString(),
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume
                  }));
                
                if (newBars.length > 0) {
                  console.log(`Added ${newBars.length} new bars from API to fill gap`);
                  combinedBars = [...dbData, ...newBars];
                  dataSource = 'database+api';
                  
                  // Store the new bars in database for future use
                  try {
                    const contractData: Contract = {
                      symbol: symbol,
                      secType: secType || 'STK',
                      exchange: exchange,
                      currency: currency || 'USD'
                    };
                    const contractId = await marketDataService.getOrCreateContract(contractData);
                    const barsToStore = newBars.map((bar: any) => ({
                      timestamp: new Date(bar.timestamp),
                      open: bar.open,
                      high: bar.high,
                      low: bar.low,
                      close: bar.close,
                      volume: bar.volume
                    }));
                    await marketDataService.storeCandlestickData(contractId, timeframe, barsToStore);
                    console.log(`Stored ${newBars.length} new bars in database`);
                  } catch (storeErr) {
                    console.warn('Failed to store gap data in database:', storeErr);
                  }
                }
              }
            } catch (gapErr: any) {
              console.error('Failed to fetch gap data from API:', gapErr.message || gapErr);
              console.error('Full error:', JSON.stringify(gapErr.response?.data || gapErr.message || 'Unknown error'));
              // Continue with database data only, but log the error
              dataSource = 'database (api-gap-failed)';
            }
          }
          
          // Sort combined data by timestamp
          combinedBars.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          return res.json({
            symbol: symbol,
            timeframe: timeframe,
            bars: combinedBars,
            source: dataSource,
            count: combinedBars.length,
            db_bars: dbData.length,
            api_bars: combinedBars.length - dbData.length,
            last_updated: new Date().toISOString(),
            latest_db_date: latestDbDate.toISOString(),
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`No data found in database for ${symbol} ${timeframe}`);
        }
      } catch (dbError) {
        console.warn('Database query failed, falling back to IB service:', dbError);
      }
    }

    // Fallback to IB service
    console.log(`Fetching historical data from IB service: ${symbol} ${timeframe} ${period}`);

    const response = await axios.get(`${IB_SERVICE_URL}/market-data/history`, {
      params: {
        symbol: symbol,
        timeframe: timeframe,
        period: period,
        account_mode: account_mode,
        start_date: start_date,
        end_date: end_date,
        secType: secType,
        exchange: exchange,
        currency: currency,
        include_indicators: include_indicators
      },
      timeout: 60000, // 60 second timeout for historical data
      headers: {
        'Connection': 'close'
      }
    });

    console.log(`Retrieved ${response.data?.data?.length || 0} bars from IB service for ${symbol}`);

    // Store data in database if we have valid data
    if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
      try {
        // Get or create contract
        const contractData: Contract = {
          symbol: symbol,
          secType: secType || 'STK',
          exchange: exchange,
          currency: currency
        };
        
        const contractId = await marketDataService.getOrCreateContract(contractData);
        
        // Convert data format and store
        const bars: CandlestickBar[] = response.data.data.map((bar: any) => ({
          timestamp: new Date(bar.time * 1000), // Convert Unix timestamp to Date
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume
          // WAP and count fields removed
        }));

        const storeResult = await marketDataService.storeCandlestickData(contractId, timeframe, bars);
        console.log(`Stored ${storeResult.inserted} new bars, updated ${storeResult.updated} bars for ${symbol} ${timeframe}`);

        // Store technical indicators if included
        if (includeIndicators && response.data?.indicators) {
          for (const bar of response.data.data) {
            const timestamp = new Date(bar.time * 1000);
            const indicators: TechnicalIndicator[] = [];
            
            if (bar.sma_20) indicators.push({ name: 'SMA', period: 20, value: bar.sma_20 });
            if (bar.sma_50) indicators.push({ name: 'SMA', period: 50, value: bar.sma_50 });
            if (bar.ema_12) indicators.push({ name: 'EMA', period: 12, value: bar.ema_12 });
            if (bar.ema_26) indicators.push({ name: 'EMA', period: 26, value: bar.ema_26 });
            if (bar.rsi) indicators.push({ name: 'RSI', period: 14, value: bar.rsi });
            if (bar.macd) indicators.push({ name: 'MACD', period: 12, value: bar.macd });
            if (bar.macd_signal) indicators.push({ name: 'MACD_SIGNAL', period: 26, value: bar.macd_signal });
            if (bar.bb_upper) indicators.push({ name: 'BB_UPPER', period: 20, value: bar.bb_upper });
            if (bar.bb_middle) indicators.push({ name: 'BB_MIDDLE', period: 20, value: bar.bb_middle });
            if (bar.bb_lower) indicators.push({ name: 'BB_LOWER', period: 20, value: bar.bb_lower });

            if (indicators.length > 0) {
              await marketDataService.storeTechnicalIndicators(contractId, timeframe, timestamp, indicators);
            }
          }
        }

      } catch (storeError) {
        console.error('Error storing data in database:', storeError);
        // Continue with response even if storage fails
      }
    }

    // Ensure consistent response format regardless of source
    const responseData = response.data;
    
    res.json({
      symbol: symbol,
      timeframe: timeframe,
      bars: responseData.data || responseData.bars || [], // Handle different IB service response formats
      count: responseData.data?.length || responseData.bars?.length || 0,
      source: 'ib_service',
      last_updated: responseData.last_updated || new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching historical data:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'IB Service connection refused - service may be starting up';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out - IB Service may be busy';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to fetch historical data';
    }
    
    res.status(statusCode).json({
      error: 'Failed to fetch historical data',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Real-time data endpoint
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const { symbol, account_mode } = req.query;

    // Validate required parameters
    if (!symbol) {
      return res.status(400).json({
        error: 'Missing required parameter: symbol',
        received: { symbol, account_mode }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Real-time market data querying is disabled');
    }

    console.log(`Fetching real-time data for ${symbol}`);

    const response = await axios.get(`${IB_SERVICE_URL}/market-data/realtime`, {
      params: {
        symbol: symbol,
        account_mode: account_mode
      },
      timeout: 10000, // 10 second timeout for real-time data
      headers: {
        'Connection': 'close'
      }
    });

    console.log(`Retrieved real-time data for ${symbol}`);

    res.json(response.data);

  } catch (error: any) {
    console.error('Error fetching real-time data:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'IB Service connection refused - service may be starting up';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out - IB Service may be busy';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to fetch real-time data';
    }
    
    res.status(statusCode).json({
      error: 'Failed to fetch real-time data',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Technical indicators endpoint
router.get('/indicators', async (req: Request, res: Response) => {
  try {
    const { 
      symbol, 
      timeframe, 
      period, 
      indicators, 
      account_mode,
      use_database = 'true'
    } = req.query as {
      symbol: string;
      timeframe: string;
      period: string;
      indicators: string;
      account_mode?: string;
      use_database?: string;
    };

    // Validate required parameters
    if (!symbol || !timeframe || !indicators) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'timeframe', 'indicators'],
        received: { symbol, timeframe, indicators, period, account_mode }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Technical indicators querying is disabled');
    }

    const useDatabase = use_database === 'true';

    if (useDatabase) {
      try {
        // Try to get indicators from database
        const endDate = new Date();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        
        const dbData = await marketDataService.getHistoricalData(
          symbol,
          timeframe,
          startDate,
          endDate,
          true // Include indicators
        );

        if (dbData.length > 0) {
          console.log(`Retrieved ${dbData.length} bars with indicators from database for ${symbol} ${timeframe}`);
          
          return res.json({
            symbol: symbol,
            timeframe: timeframe,
            indicators: indicators.split(','),
            data: dbData,
            source: 'database',
            count: dbData.length,
            timestamp: new Date().toISOString()
          });
        }
      } catch (dbError) {
        console.warn('Database query failed, falling back to IB service:', dbError);
      }
    }

    // Fallback to IB service
    console.log(`Calculating technical indicators for ${symbol} ${timeframe}`);

    const response = await axios.get(`${IB_SERVICE_URL}/market-data/indicators`, {
      params: {
        symbol: symbol,
        timeframe: timeframe,
        period: period,
        indicators: indicators,
        account_mode: account_mode
      },
      timeout: 30000, // 30 second timeout for indicators
      headers: {
        'Connection': 'close'
      }
    });

    console.log(`Calculated indicators for ${symbol} ${timeframe}`);

    res.json({
      ...response.data,
      source: 'ib_service',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error calculating technical indicators:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'IB Service connection refused - service may be starting up';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out - IB Service may be busy';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to calculate technical indicators';
    }
    
    res.status(statusCode).json({
      error: 'Failed to calculate technical indicators',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Database statistics endpoint
router.get('/database/stats', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query as { symbol?: string };
    
    const stats = await marketDataService.getDataCollectionStats(symbol);
    
    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting database stats:', error);
    
    res.status(500).json({
      error: 'Failed to get database statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all symbols available in database
router.get('/database/symbols', async (req: Request, res: Response) => {
  try {
    console.log('Fetching available symbols from database');
    
    const symbols = await marketDataService.getAvailableSymbols();
    
    console.log(`Found ${symbols.length} symbols in database`);
    
    res.json({
      symbols: symbols.map(s => ({
        symbol: s.symbol,
        timeframes: s.timeframes.map(tf => ({
          timeframe: tf.timeframe,
          bar_count: tf.bar_count,
          earliest_date: tf.earliest_date?.toISOString() || null,
          latest_date: tf.latest_date?.toISOString() || null
        }))
      })),
      total_symbols: symbols.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching available symbols:', error);
    
    res.status(500).json({
      error: 'Failed to fetch available symbols',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Upload historical data to database endpoint
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, bars, account_mode, secType, exchange, currency } = req.body;

    // Validate required parameters
    if (!symbol || !timeframe || !bars || !Array.isArray(bars)) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'timeframe', 'bars'],
        received: { symbol, timeframe, bars: bars ? 'array' : 'missing' }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Data upload is disabled');
    }

    console.log(`Uploading ${bars.length} bars for ${symbol} ${timeframe} to database`);

    // Upload data to database using market data service
    const result = await marketDataService.uploadHistoricalData({
      symbol,
      timeframe,
      bars,
      account_mode: account_mode || 'paper',
      secType: secType || 'STK',
      exchange: exchange || 'SMART',
      currency: currency || 'USD'
    });

    console.log(`Successfully uploaded ${result.uploaded_count} records for ${symbol} ${timeframe}`);

    res.json({
      message: 'Data uploaded successfully',
      uploaded_count: result.uploaded_count,
      skipped_count: result.skipped_count,
      symbol,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error uploading data to database:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection refused';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Database operation timed out';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to upload data to database';
    }
    
    res.status(statusCode).json({
      error: 'Failed to upload data to database',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Bulk data collection endpoint
router.post('/bulk-collect', async (req: Request, res: Response) => {
  try {
    const { symbols, timeframes, period, account_mode, secType, exchange, currency } = req.body;

    // Validate required parameters
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbols (array)'],
        received: { symbols: symbols ? 'not array or empty' : 'missing' }
      });
    }

    if (!timeframes || !Array.isArray(timeframes) || timeframes.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['timeframes (array)'],
        received: { timeframes: timeframes ? 'not array or empty' : 'missing' }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Bulk data collection is disabled');
    }

    console.log(`Starting bulk collection for ${symbols.length} symbols across ${timeframes.length} timeframes`);

    const results: Record<string, Record<string, any>> = {};
    const summary = {
      total_operations: symbols.length * timeframes.length,
      successful_operations: 0,
      failed_operations: 0,
      total_records_collected: 0,
      errors: [] as string[]
    };

    // Process each symbol
    for (const symbol of symbols) {
      results[symbol] = {};
      
      // Process each timeframe for this symbol
      for (const timeframe of timeframes) {
        try {
          console.log(`Collecting ${symbol} ${timeframe}...`);
          
          const requestParams = {
            symbol: symbol.toUpperCase(),
            timeframe: timeframe,
            period: period || '1Y',
            account_mode: account_mode || 'paper',
            secType: secType || 'STK',
            exchange: exchange || 'SMART',
            currency: currency || 'USD'
          };
          
          console.log(`Request params for ${symbol} ${timeframe}:`, requestParams);
          
          // Fetch data from IB service
          const response = await axios.get(`${IB_SERVICE_URL}/market-data/history`, {
            params: requestParams,
            timeout: 60000 // Increased to 60 second timeout for bulk operations
          });
          
          console.log(`Response status for ${symbol} ${timeframe}: ${response.status}`);

          const data = response.data;
          
          // Handle both possible response formats: data.bars (from IB service) or data.data (legacy)
          const bars = data.bars || data.data || [];
          
          console.log(`Bulk collection for ${symbol} ${timeframe}: received response with ${bars.length} bars`);
          console.log(`Response structure:`, {
            hasBars: !!data.bars,
            hasData: !!data.data,
            barsLength: data.bars?.length || 0,
            dataLength: data.data?.length || 0,
            responseKeys: Object.keys(data)
          });
          
          if (data && Array.isArray(bars) && bars.length > 0) {
            // Store fetched data without uploading to database
            results[symbol][timeframe] = {
              success: true,
              records_fetched: bars.length,
              records_uploaded: 0, // No automatic upload
              records_skipped: 0,
              source: data.source || 'IB Gateway',
              data: bars // Store the actual data for potential future use
            };

            summary.successful_operations++;
            summary.total_records_collected += bars.length; // Count fetched records, not uploaded
            
            console.log(`Successfully fetched ${symbol} ${timeframe}: ${bars.length} records collected`);
          } else {
            const errorMsg = `No data received from IB service - bars: ${bars.length}, response keys: ${Object.keys(data).join(', ')}`;
            console.error(`Bulk collection failed for ${symbol} ${timeframe}: ${errorMsg}`);
            
            results[symbol][timeframe] = {
              success: false,
              error: errorMsg,
              records_fetched: 0,
              response_debug: {
                hasBars: !!data.bars,
                hasData: !!data.data,
                responseKeys: Object.keys(data),
                barsLength: data.bars?.length || 0,
                dataLength: data.data?.length || 0
              }
            };
            summary.failed_operations++;
            summary.errors.push(`${symbol} ${timeframe}: ${errorMsg}`);
          }

        } catch (error: any) {
          console.error(`Error collecting ${symbol} ${timeframe}:`, error.message);
          
          results[symbol][timeframe] = {
            success: false,
            error: error.message,
            records_fetched: 0
          };
          
          summary.failed_operations++;
          summary.errors.push(`${symbol} ${timeframe}: ${error.message}`);
        }

        // Small delay between requests to avoid overwhelming services
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Longer delay between symbols
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Bulk collection completed: ${summary.successful_operations}/${summary.total_operations} successful`);

    res.json({
      message: 'Bulk collection completed',
      summary,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in bulk collection:', error);
    
    res.status(500).json({
      error: 'Failed to perform bulk collection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Data validation endpoint
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { symbols, timeframes, start_date, end_date } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        error: 'symbols must be an array',
        received: typeof symbols
      });
    }

    if (!timeframes || !Array.isArray(timeframes)) {
      return res.status(400).json({
        error: 'timeframes must be an array',
        received: typeof timeframes
      });
    }

    const results: Record<string, Record<string, any>> = {};
    const summary = {
      total_validations: symbols.length * timeframes.length,
      valid_count: 0,
      invalid_count: 0,
      error_count: 0
    };

    for (const symbol of symbols) {
      results[symbol] = {};

      for (const timeframe of timeframes) {
        try {
          // Get data from database
          const data = await marketDataService.getHistoricalData(
            symbol,
            timeframe,
            start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            end_date ? new Date(end_date) : new Date(),
            false
          );

          if (data.length === 0) {
            results[symbol][timeframe] = {
              valid: false,
              error: 'No data found in database',
              record_count: 0
            };
            summary.invalid_count++;
            continue;
          }

          // Basic validation checks
          const validation = {
            record_count: data.length,
            has_gaps: false,
            invalid_ohlc_count: 0,
            zero_volume_count: 0,
            negative_price_count: 0,
            issues: [] as string[]
          };

          // Check for data quality issues
          for (let i = 0; i < data.length; i++) {
            const bar = data[i];
            
            // OHLC validation
            if (bar.high < Math.max(bar.open, bar.close) || 
                bar.low > Math.min(bar.open, bar.close) ||
                bar.high < bar.low) {
              validation.invalid_ohlc_count++;
            }

            // Price validation
            if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) {
              validation.negative_price_count++;
            }

            // Volume validation
            if (bar.volume === 0) {
              validation.zero_volume_count++;
            }

            // Gap detection (simplified)
            if (i > 0) {
              const timeDiff = bar.timestamp.getTime() - data[i-1].timestamp.getTime();
              const expectedInterval = getExpectedInterval(timeframe);
              if (timeDiff > expectedInterval * 1.5) { // Allow 50% tolerance
                validation.has_gaps = true;
              }
            }
          }

          // Generate issues summary
          if (validation.invalid_ohlc_count > 0) {
            validation.issues.push(`${validation.invalid_ohlc_count} invalid OHLC bars`);
          }
          if (validation.negative_price_count > 0) {
            validation.issues.push(`${validation.negative_price_count} bars with invalid prices`);
          }
          if (validation.zero_volume_count > data.length * 0.1) {
            validation.issues.push(`High zero volume count: ${validation.zero_volume_count}`);
          }
          if (validation.has_gaps) {
            validation.issues.push('Time gaps detected in data');
          }

          const isValid = validation.issues.length === 0;
          
          results[symbol][timeframe] = {
            valid: isValid,
            ...validation
          };

          if (isValid) {
            summary.valid_count++;
          } else {
            summary.invalid_count++;
          }

        } catch (error: any) {
          results[symbol][timeframe] = {
            valid: false,
            error: error.message
          };
          summary.error_count++;
        }
      }
    }

    res.json({
      message: 'Data validation completed',
      summary,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in data validation:', error);
    
    res.status(500).json({
      error: 'Failed to validate data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to get expected interval in milliseconds
function getExpectedInterval(timeframe: string): number {
  const intervals: Record<string, number> = {
    '1min': 60 * 1000,
    '5min': 5 * 60 * 1000,
    '15min': 15 * 60 * 1000,
    '30min': 30 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '4hour': 4 * 60 * 60 * 1000,
    '1day': 24 * 60 * 60 * 1000
  };
  return intervals[timeframe] || 60 * 60 * 1000; // Default to 1 hour
}

// System health endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      database: false,
      ib_service: false,
      timestamp: new Date().toISOString()
    };

    // Check database health
    try {
      await marketDataService.getDataCollectionStats();
      health.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check IB service health
    try {
      const response = await axios.get(`${IB_SERVICE_URL}/health`, { timeout: 5000 });
      health.ib_service = response.status === 200;
    } catch (error) {
      console.error('IB service health check failed:', error);
    }

    const overall_healthy = health.database && health.ib_service;

    res.json({
      healthy: overall_healthy,
      services: health,
      timestamp: health.timestamp
    });

  } catch (error: any) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get latest historical data point for a symbol/timeframe
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, account_mode } = req.query as {
      symbol: string;
      timeframe: string;
      account_mode?: string;
    };

    // Validate required parameters
    if (!symbol || !timeframe) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'timeframe'],
        received: { symbol, timeframe, account_mode }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Latest data querying is disabled');
    }

    console.log(`Getting latest data point for ${symbol} ${timeframe}`);

    // Get latest data from database
    const latestData = await marketDataService.getLatestData(symbol, timeframe, 1);
    
    if (latestData.length === 0) {
      return res.json({
        symbol: symbol,
        timeframe: timeframe,
        latest_data: null,
        message: 'No historical data found',
        timestamp: new Date().toISOString()
      });
    }

    const latest = latestData[0];
    
    res.json({
      symbol: symbol,
      timeframe: timeframe,
      latest_data: {
        timestamp: latest.timestamp.toISOString(),
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
        volume: latest.volume
        // WAP and count fields removed
      },
      source: 'database',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting latest data:', error);
    
    res.status(500).json({
      error: 'Failed to get latest data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced real-time streaming endpoint that continues from last historical point
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, account_mode } = req.query as {
      symbol: string;
      timeframe: string;
      account_mode?: string;
    };

    // Validate required parameters
    if (!symbol || !timeframe) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'timeframe'],
        received: { symbol, timeframe, account_mode }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Real-time streaming is disabled');
    }

    console.log(`Starting real-time stream for ${symbol} ${timeframe}`);

    // Get latest historical data point
    const latestData = await marketDataService.getLatestData(symbol, timeframe, 1);
    const lastHistoricalTime = latestData.length > 0 ? latestData[0].timestamp : null;

    // Get current real-time data
    const realtimeResponse = await axios.get(`${IB_SERVICE_URL}/market-data/realtime`, {
      params: {
        symbol: symbol,
        account_mode: account_mode
      },
      timeout: 10000
    });

    const realtimeData = realtimeResponse.data;
    const currentTime = new Date();

    // Calculate if we need to create a new bar or update existing one
    let shouldCreateNewBar = false;
    let shouldUpdateLastBar = false;

    if (lastHistoricalTime) {
      const timeDiff = currentTime.getTime() - lastHistoricalTime.getTime();
      const timeframeMinutes = getTimeframeMinutes(timeframe);
      const timeframeMs = timeframeMinutes * 60 * 1000;

      // If we're in a new timeframe period, create new bar
      if (timeDiff >= timeframeMs) {
        shouldCreateNewBar = true;
      } else {
        // Update the last bar with current price
        shouldUpdateLastBar = true;
      }
    } else {
      // No historical data, create new bar
      shouldCreateNewBar = true;
    }

    // Get or create contract for storing new data
    const contractId = await marketDataService.getOrCreateContract({
      symbol: symbol,
      secType: 'STK',
      exchange: 'NASDAQ',
      currency: 'USD'
    });

    let newBarData = null;

    if (shouldCreateNewBar || shouldUpdateLastBar) {
      // Create new bar data
      const barTimestamp = shouldCreateNewBar ? 
        new Date(Math.floor(currentTime.getTime() / (getTimeframeMinutes(timeframe) * 60 * 1000)) * (getTimeframeMinutes(timeframe) * 60 * 1000)) :
        lastHistoricalTime!;

      const newBar = {
        timestamp: barTimestamp,
        open: shouldCreateNewBar ? realtimeData.last : latestData[0].open,
        high: shouldCreateNewBar ? realtimeData.last : Math.max(latestData[0].high, realtimeData.last),
        low: shouldCreateNewBar ? realtimeData.last : Math.min(latestData[0].low, realtimeData.last),
        close: realtimeData.last,
        volume: shouldCreateNewBar ? realtimeData.volume : latestData[0].volume + realtimeData.volume
        // WAP and count fields removed
      };

      // Store the new/updated bar
      const storeResult = await marketDataService.storeCandlestickData(contractId, timeframe, [newBar]);
      
      newBarData = {
        ...newBar,
        timestamp: newBar.timestamp.toISOString(),
        action: shouldCreateNewBar ? 'new_bar' : 'updated_bar',
        store_result: storeResult
      };
    }

    res.json({
      symbol: symbol,
      timeframe: timeframe,
      realtime_data: realtimeData,
      last_historical_time: lastHistoricalTime?.toISOString() || null,
      current_time: currentTime.toISOString(),
      new_bar_data: newBarData,
      action: shouldCreateNewBar ? 'new_bar_created' : shouldUpdateLastBar ? 'last_bar_updated' : 'no_action_needed',
      source: 'streaming',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in real-time streaming:', error);
    
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'IB Service connection refused - service may be starting up';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Request timed out - IB Service may be busy';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error || error.response.statusText;
    } else {
      errorMessage = error.message || 'Failed to stream real-time data';
    }
    
    res.status(statusCode).json({
      error: 'Failed to stream real-time data',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to get timeframe in minutes
function getTimeframeMinutes(timeframe: string): number {
  const timeframes: Record<string, number> = {
    '1min': 1,
    '5min': 5,
    '15min': 15,
    '30min': 30,
    '1hour': 60,
    '4hour': 240,
    '8hour': 480,
    '1day': 1440
  };
  return timeframes[timeframe] || 60; // Default to 1 hour
}

// Clean old data endpoint
router.post('/database/clean', async (req: Request, res: Response) => {
  try {
    const result = await marketDataService.cleanOldData();
    
    res.json({
      message: 'Data cleanup completed',
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error cleaning old data:', error);
    
    res.status(500).json({
      error: 'Failed to clean old data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 