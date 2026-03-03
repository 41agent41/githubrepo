import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { marketDataService, type Contract, type CandlestickBar, type TechnicalIndicator } from '../services/marketDataService.js';
import { brokerFactory } from '../services/brokers/index.js';
import type { SecurityType } from '../types/broker.js';
import { getBrokerFromRequest } from '../middleware/brokerSelection.js';
import { isDataQueryEnabled, handleDisabledDataQuery, getBrokerErrorResponse } from '../utils/routeUtils.js';

const router = express.Router();

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

// Contract search endpoint
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { symbol, secType, exchange, currency, searchByName } = req.body as SearchQuery;

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

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Searching for contract: ${symbol} (${secType}) on ${exchange || 'any exchange'}`);

    const contracts = await broker.searchContracts({
      symbol,
      securityType: secType as SecurityType,
      exchange,
      currency,
      searchByName
    });

    // Map to API response format
    const results = contracts.map(c => ({
      symbol: c.symbol,
      secType: c.securityType,
      exchange: c.exchange,
      currency: c.currency,
      multiplier: c.multiplier,
      expiry: c.expiry,
      strike: c.strike,
      right: c.right,
      localSymbol: c.localSymbol,
      contractId: c.contractId != null ? String(c.contractId) : undefined,
      conId: c.contractId != null ? String(c.contractId) : undefined,
      longName: c.description,
      description: c.description
    }));

    console.log(`[${brokerType}] Found ${results.length} contracts for ${symbol}`);

    // Store contracts in database for future reference
    for (const contract of contracts) {
      try {
        const cid = contract.contractId;
        const contractIdVal =
          cid != null
            ? (typeof cid === 'number' ? cid : parseInt(String(cid), 10))
            : undefined;
        const contractIdStr: string | undefined =
          contractIdVal !== undefined && !Number.isNaN(contractIdVal) ? String(contractIdVal) : undefined;
        const contractData: Contract = {
          symbol: contract.symbol,
          secType: contract.securityType,
          exchange: contract.exchange,
          currency: contract.currency,
          multiplier: contract.multiplier != null ? String(contract.multiplier) : undefined,
          expiry: contract.expiry,
          strike: contract.strike,
          right: contract.right,
          localSymbol: contract.localSymbol,
          contractId: contractIdStr
        };
        await marketDataService.getOrCreateContract(contractData);
      } catch (error) {
        console.error('Error storing contract in database:', error);
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error('Error in contract search:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to search for contracts');
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
      searchByName
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

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    if (!broker.searchContractsAdvanced) {
      return res.status(501).json({
        error: 'Advanced contract search not supported for this broker',
        broker: brokerType,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[${brokerType}] Advanced search for: ${secType} ${symbol || ''} on ${exchange || 'any exchange'}`);

    const contracts = await broker.searchContractsAdvanced({
      symbol: symbol || '',
      securityType: secType as SecurityType,
      exchange,
      currency,
      expiry,
      strike,
      right: right as 'CALL' | 'PUT' | undefined,
      multiplier,
      includeExpired,
      searchByName
    });

    const results = contracts.map(c => ({
      symbol: c.symbol,
      secType: c.securityType,
      exchange: c.exchange,
      currency: c.currency,
      multiplier: c.multiplier,
      expiry: c.expiry,
      strike: c.strike,
      right: c.right,
      localSymbol: c.localSymbol,
      contractId: c.contractId != null ? String(c.contractId) : undefined,
      conId: c.contractId != null ? String(c.contractId) : undefined,
      longName: c.description,
      description: c.description
    }));

    console.log(`[${brokerType}] Advanced search found ${results.length} contracts`);

    for (const contract of contracts) {
      try {
        const cid = contract.contractId;
        const contractIdVal =
          cid != null
            ? (typeof cid === 'number' ? cid : parseInt(String(cid), 10))
            : undefined;
        const contractIdStr: string | undefined =
          contractIdVal !== undefined && !Number.isNaN(contractIdVal) ? String(contractIdVal) : undefined;
        const contractData: Contract = {
          symbol: contract.symbol,
          secType: contract.securityType,
          exchange: contract.exchange,
          currency: contract.currency,
          multiplier: contract.multiplier != null ? String(contract.multiplier) : undefined,
          expiry: contract.expiry,
          strike: contract.strike,
          right: contract.right,
          localSymbol: contract.localSymbol,
          contractId: contractIdStr
        };
        await marketDataService.getOrCreateContract(contractData);
      } catch (error) {
        console.error('Error storing contract in database:', error);
      }
    }

    res.json({ results });
  } catch (error: any) {
    console.error('Error in advanced contract search:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to perform advanced search');
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
              // Fetch from broker using period (more reliable than date ranges)
              const brokerType = req.brokerType ?? getBrokerFromRequest(req);
              const broker = brokerFactory.getBroker(brokerType);
              const gapResponse = await broker.getHistoricalData({
                symbol,
                timeframe: timeframe as import('../types/broker.js').Timeframe,
                period: gapPeriod,
                securityType: (secType || 'STK') as SecurityType,
                exchange: exchange || 'SMART',
                currency: currency || 'USD'
              });

              console.log(`[${brokerType}] API response: ${gapResponse.bars?.length || 0} bars received`);

              if (gapResponse.bars && gapResponse.bars.length > 0) {
                // Filter API bars to only include those after latest DB timestamp
                const newBars: CandlestickBar[] = gapResponse.bars
                  .filter((bar) => {
                    const barTime = bar.timestamp instanceof Date ? bar.timestamp.getTime() : (bar as any).time * 1000;
                    return barTime > latestDbTimestamp;
                  })
                  .map((bar) => ({
                    timestamp: bar.timestamp instanceof Date ? bar.timestamp : new Date((bar as any).time * 1000),
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

    // Fallback to broker
    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Fetching historical data: ${symbol} ${timeframe} ${period}`);

    const response = await broker.getHistoricalData({
      symbol,
      timeframe: timeframe as import('../types/broker.js').Timeframe,
      period: period || '1Y',
      startDate: start_date ? new Date(start_date) : undefined,
      endDate: end_date ? new Date(end_date) : undefined,
      securityType: (secType || 'STK') as SecurityType,
      exchange: exchange || 'SMART',
      currency: currency || 'USD'
    });

    console.log(`[${brokerType}] Retrieved ${response.bars?.length || 0} bars for ${symbol}`);

    // Store data in database if we have valid data
    if (response.bars && response.bars.length > 0) {
      try {
        const contractData: Contract = {
          symbol: symbol,
          secType: secType || 'STK',
          exchange: exchange,
          currency: currency
        };
        const contractId = await marketDataService.getOrCreateContract(contractData);
        const bars: CandlestickBar[] = response.bars.map((bar) => ({
          timestamp: bar.timestamp instanceof Date ? bar.timestamp : new Date(bar.timestamp),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume
        }));

        const storeResult = await marketDataService.storeCandlestickData(contractId, timeframe, bars);
        console.log(`Stored ${storeResult.inserted} new bars, updated ${storeResult.updated} bars for ${symbol} ${timeframe}`);
      } catch (storeError) {
        console.error('Error storing data in database:', storeError);
      }
    }

    // Ensure consistent response format - bars with timestamp/time in unix seconds for API compatibility
    const barsForResponse = response.bars.map((bar) => {
      const ts = bar.timestamp instanceof Date ? bar.timestamp.getTime() / 1000 : (bar as any).time ?? (bar as any).timestamp;
      return {
        timestamp: ts,
        time: ts,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume
      };
    });

    res.json({
      symbol: symbol,
      timeframe: timeframe,
      bars: barsForResponse,
      data: barsForResponse,
      count: barsForResponse.length,
      source: response.source || brokerType,
      last_updated: response.lastUpdated?.toISOString?.() || new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching historical data:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to fetch historical data');
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
    const { symbol } = req.query;

    // Validate required parameters
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameter: symbol',
        received: { symbol }
      });
    }

    // Check if data querying is enabled
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Real-time market data querying is disabled');
    }

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Fetching real-time data for ${symbol}`);

    const quote = await broker.getQuote(symbol);

    // Map to API response format (compatible with ib_service /market-data/realtime)
    const response = {
      symbol: quote.symbol,
      bid: quote.bid,
      ask: quote.ask,
      last: quote.last,
      volume: quote.volume,
      bidSize: quote.bidSize,
      askSize: quote.askSize,
      lastSize: quote.lastSize,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      previousClose: quote.previousClose,
      timestamp: quote.timestamp.toISOString()
    };

    console.log(`[${brokerType}] Retrieved real-time data for ${symbol}`);
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching real-time data:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to fetch real-time data');
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

    // Fallback to broker service (IB has /market-data/indicators; other brokers may add support)
    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Calculating technical indicators for ${symbol} ${timeframe}`);

    const response = await axios.get(`${broker.getServiceUrl()}/market-data/indicators`, {
      params: {
        symbol: symbol,
        timeframe: timeframe,
        period: period,
        indicators: indicators,
        account_mode: req.query.account_mode
      },
      timeout: 30000,
      headers: { 'Connection': 'close' }
    });

    console.log(`[${brokerType}] Calculated indicators for ${symbol} ${timeframe}`);

    res.json({
      ...response.data,
      source: brokerType.toLowerCase(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error calculating technical indicators:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to calculate technical indicators');
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
    const { symbols, timeframes, period, account_mode, secType, exchange, currency, broker: brokerParam } = req.body;

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

    const brokerType = (brokerParam && ['IB', 'MT5', 'CTRADER'].includes(brokerParam.toUpperCase())) ? brokerParam.toUpperCase() : (req.brokerType ?? getBrokerFromRequest(req));
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Starting bulk collection for ${symbols.length} symbols across ${timeframes.length} timeframes`);

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
          console.log(`[${brokerType}] Collecting ${symbol} ${timeframe}...`);

          const response = await broker.getHistoricalData({
            symbol: symbol.toUpperCase(),
            timeframe: timeframe as import('../types/broker.js').Timeframe,
            period: period || '1Y',
            securityType: (secType || 'STK') as SecurityType,
            exchange: exchange || 'SMART',
            currency: currency || 'USD'
          });

          const bars = response.bars || [];

          console.log(`[${brokerType}] Bulk collection for ${symbol} ${timeframe}: received ${bars.length} bars`);

          if (Array.isArray(bars) && bars.length > 0) {
            results[symbol][timeframe] = {
              success: true,
              records_fetched: bars.length,
              records_uploaded: 0,
              records_skipped: 0,
              source: response.source || brokerType,
              data: bars
            };

            summary.successful_operations++;
            summary.total_records_collected += bars.length; // Count fetched records, not uploaded
            
            console.log(`Successfully fetched ${symbol} ${timeframe}: ${bars.length} records collected`);
          } else {
            const errorMsg = `No data received from broker - bars: ${bars.length}`;
            console.error(`[${brokerType}] Bulk collection failed for ${symbol} ${timeframe}: ${errorMsg}`);

            results[symbol][timeframe] = {
              success: false,
              error: errorMsg,
              records_fetched: 0
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
    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const health = {
      database: false,
      broker_service: false,
      broker_type: brokerType,
      timestamp: new Date().toISOString()
    };

    // Check database health
    try {
      await marketDataService.getDataCollectionStats();
      health.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check broker service health (via BrokerFactory)
    try {
      const broker = brokerFactory.getBroker(brokerType);
      const result = await broker.healthCheck();
      health.broker_service = result.healthy;
    } catch (error) {
      console.error('Broker service health check failed:', error);
    }

    const overall_healthy = health.database && health.broker_service;

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

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Starting real-time stream for ${symbol} ${timeframe}`);

    // Get latest historical data point
    const latestData = await marketDataService.getLatestData(symbol, timeframe, 1);
    const lastHistoricalTime = latestData.length > 0 ? latestData[0].timestamp : null;

    // Get current real-time data from broker
    const quote = await broker.getQuote(symbol);
    const realtimeData = {
      symbol: quote.symbol,
      last: quote.last,
      bid: quote.bid,
      ask: quote.ask,
      volume: quote.volume,
      timestamp: quote.timestamp.toISOString()
    };
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

      const lastPrice = realtimeData.last ?? 0;
      const lastVolume = realtimeData.volume ?? 0;
      const newBar: CandlestickBar = {
        timestamp: barTimestamp,
        open: shouldCreateNewBar ? lastPrice : latestData[0].open,
        high: shouldCreateNewBar ? lastPrice : Math.max(latestData[0].high, lastPrice),
        low: shouldCreateNewBar ? lastPrice : Math.min(latestData[0].low, lastPrice),
        close: lastPrice,
        volume: shouldCreateNewBar ? lastVolume : latestData[0].volume + lastVolume
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