import { tradingSetupService } from './tradingSetupService.js';
import { marketDataService } from './marketDataService.js';
import axios from 'axios';

const IB_SERVICE_URL = process.env.IB_SERVICE_URL || 'http://ib_service:8000';

interface CollectionResult {
  symbol: string;
  timeframe: string;
  success: boolean;
  recordsCollected: number;
  error?: string;
}

interface CollectionStats {
  totalSetups: number;
  totalTimeframes: number;
  successful: number;
  failed: number;
  results: CollectionResult[];
}

// Timeframe collection intervals (in minutes)
const TIMEFRAME_INTERVALS: Record<string, number> = {
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1hour': 60,
  '4hour': 240,
  '8hour': 480,
  '1day': 1440
};

// Collection frequency (how often to check/collect)
const COLLECTION_FREQUENCY: Record<string, number> = {
  '5min': 5,    // Collect every 5 minutes
  '15min': 5,   // Collect every 5 minutes
  '30min': 5,   // Collect every 5 minutes
  '1hour': 60,  // Collect every hour
  '4hour': 60,  // Collect every hour
  '8hour': 60,  // Collect every hour
  '1day': 1440  // Collect daily
};

export const marketDataCollector = {
  /**
   * Collect market data for a specific setup
   */
  async collectForSetup(setupId: number): Promise<CollectionStats> {
    const setup = await tradingSetupService.getSetup(setupId);
    
    if (!setup || setup.status !== 'active') {
      throw new Error(`Setup ${setupId} not found or not active`);
    }

    const stats: CollectionStats = {
      totalSetups: 1,
      totalTimeframes: setup.timeframes.length,
      successful: 0,
      failed: 0,
      results: []
    };

    // Collect data for each timeframe
    for (const timeframe of setup.timeframes) {
      try {
        const result = await this.collectDataForTimeframe(
          setup.symbol,
          timeframe,
          setup.contractId
        );
        
        stats.results.push(result);
        if (result.success) {
          stats.successful++;
        } else {
          stats.failed++;
        }
      } catch (error) {
        stats.failed++;
        stats.results.push({
          symbol: setup.symbol,
          timeframe,
          success: false,
          recordsCollected: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return stats;
  },

  /**
   * Collect market data for a specific symbol and timeframe
   */
  async collectDataForTimeframe(
    symbol: string,
    timeframe: string,
    contractId: number | null
  ): Promise<CollectionResult> {
    try {
      // Determine period based on timeframe
      const period = this.getPeriodForTimeframe(timeframe);

      // Check last collection time
      const lastData = await marketDataService.getLatestData(symbol, timeframe, 1);
      const shouldCollect = this.shouldCollectData(timeframe, lastData);

      if (!shouldCollect) {
        return {
          symbol,
          timeframe,
          success: true,
          recordsCollected: 0,
          error: 'Data is up to date'
        };
      }

      // Fetch data from IB Gateway
      console.log(`Collecting ${symbol} ${timeframe} data from IB Gateway...`);
      
      const response = await axios.get(`${IB_SERVICE_URL}/market-data/history`, {
        params: {
          symbol: symbol,
          timeframe: timeframe,
          period: period,
          account_mode: 'paper'
        },
        timeout: 60000
      });

      const bars = response.data.bars || response.data.data || [];
      
      if (bars.length === 0) {
        return {
          symbol,
          timeframe,
          success: false,
          recordsCollected: 0,
          error: 'No data received from IB Gateway'
        };
      }

      // Get or create contract
      if (!contractId) {
        const contract = await marketDataService.getOrCreateContract({
          symbol: symbol,
          secType: 'STK',
          exchange: 'SMART',
          currency: 'USD'
        });
        contractId = contract;
      }

      // Convert and store data
      const candlestickBars = bars.map((bar: any) => ({
        timestamp: new Date(bar.time * 1000),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0
      }));

      const storeResult = await marketDataService.storeCandlestickData(
        contractId,
        timeframe,
        candlestickBars
      );

      console.log(`Stored ${storeResult.inserted} new bars for ${symbol} ${timeframe}`);

      return {
        symbol,
        timeframe,
        success: true,
        recordsCollected: storeResult.inserted
      };

    } catch (error) {
      console.error(`Error collecting data for ${symbol} ${timeframe}:`, error);
      return {
        symbol,
        timeframe,
        success: false,
        recordsCollected: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Collect data for all active setups
   */
  async collectForAllActiveSetups(): Promise<CollectionStats> {
    const activeSetups = await tradingSetupService.listSetups('active');
    
    const stats: CollectionStats = {
      totalSetups: activeSetups.length,
      totalTimeframes: 0,
      successful: 0,
      failed: 0,
      results: []
    };

    for (const setup of activeSetups) {
      stats.totalTimeframes += setup.timeframes.length;
      
      for (const timeframe of setup.timeframes) {
        try {
          const result = await this.collectDataForTimeframe(
            setup.symbol,
            timeframe,
            setup.contractId
          );
          
          stats.results.push(result);
          if (result.success) {
            stats.successful++;
          } else {
            stats.failed++;
          }
        } catch (error) {
          stats.failed++;
          stats.results.push({
            symbol: setup.symbol,
            timeframe,
            success: false,
            recordsCollected: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Longer delay between setups
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return stats;
  },

  /**
   * Determine if data should be collected based on timeframe and last collection
   */
  shouldCollectData(timeframe: string, lastData: any[]): boolean {
    if (lastData.length === 0) {
      return true; // No data exists, collect
    }

    const lastTimestamp = lastData[0].timestamp;
    const now = new Date();
    const timeSinceLastCollection = now.getTime() - lastTimestamp.getTime();
    const collectionInterval = COLLECTION_FREQUENCY[timeframe] || 60;

    // Convert to milliseconds
    const intervalMs = collectionInterval * 60 * 1000;

    // Collect if enough time has passed
    return timeSinceLastCollection >= intervalMs;
  },

  /**
   * Get period string for timeframe
   */
  getPeriodForTimeframe(timeframe: string): string {
    // For intraday timeframes, get more data
    if (['5min', '15min', '30min'].includes(timeframe)) {
      return '1M'; // 1 month of data
    } else if (['1hour', '4hour', '8hour'].includes(timeframe)) {
      return '3M'; // 3 months of data
    } else {
      return '1Y'; // 1 year of data
    }
  },

  /**
   * Get collection frequency for a timeframe
   */
  getCollectionFrequency(timeframe: string): number {
    return COLLECTION_FREQUENCY[timeframe] || 60;
  }
};

