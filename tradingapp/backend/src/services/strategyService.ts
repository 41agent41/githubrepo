import { dbService } from './database.js';
import { marketDataService, type CandlestickBar } from './marketDataService.js';
import { tradingSetupService } from './tradingSetupService.js';
import axios from 'axios';

// Import WebSocket broadcast function (will be set from index.ts)
let broadcastStrategySignalFn: ((signal: StrategySignal) => void) | null = null;

export function setBroadcastStrategySignal(fn: (signal: StrategySignal) => void) {
  broadcastStrategySignalFn = fn;
}

const IB_SERVICE_URL = process.env.IB_SERVICE_URL || 'http://ib_service:8000';

interface StrategySignal {
  id?: number;
  setupId: number;
  contractId: number;
  timeframe: string;
  timestamp: Date;
  strategyName: string;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence: number;
  indicatorValues?: Record<string, any>;
}

interface StrategyCalculationResult {
  signals: StrategySignal[];
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
}

export const strategyService = {
  /**
   * Calculate strategy signals for a setup
   */
  async calculateSignalsForSetup(setupId: number): Promise<StrategyCalculationResult> {
    const setup = await tradingSetupService.getSetup(setupId);
    
    if (!setup || setup.status !== 'active') {
      throw new Error(`Setup ${setupId} not found or not active`);
    }

    if (!setup.contractId) {
      throw new Error(`Setup ${setupId} has no contract ID`);
    }

    const allSignals: StrategySignal[] = [];

    // Calculate signals for each timeframe
    for (const timeframe of setup.timeframes) {
      const timeframeSignals = await this.calculateSignalsForTimeframe(
        setupId,
        setup.contractId,
        setup.symbol,
        timeframe,
        setup.strategies,
        setup.indicators
      );
      
      allSignals.push(...timeframeSignals);
    }

    // Store signals in database and broadcast
    for (const signal of allSignals) {
      await this.storeStrategySignal(signal);
      
      // Broadcast via WebSocket
      if (broadcastStrategySignalFn) {
        broadcastStrategySignalFn(signal);
      }
    }

    return {
      signals: allSignals,
      totalSignals: allSignals.length,
      buySignals: allSignals.filter(s => s.signalType === 'BUY').length,
      sellSignals: allSignals.filter(s => s.signalType === 'SELL').length
    };
  },

  /**
   * Calculate strategy signals for a specific timeframe
   */
  async calculateSignalsForTimeframe(
    setupId: number,
    contractId: number,
    symbol: string,
    timeframe: string,
    strategies: string[],
    indicators: string[]
  ): Promise<StrategySignal[]> {
    // Get historical data (last 100 bars for signal calculation)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

    const historicalData = await marketDataService.getHistoricalData(
      symbol,
      timeframe,
      startDate,
      endDate,
      indicators.length > 0 // Include indicators if needed
    );

    if (historicalData.length < 50) {
      console.warn(`Insufficient data for ${symbol} ${timeframe}: ${historicalData.length} bars`);
      return [];
    }

    // Calculate indicators if needed
    let dataWithIndicators = historicalData;
    if (indicators.length > 0) {
      // Request indicator calculation from IB service
      try {
        const response = await axios.get(`${IB_SERVICE_URL}/market-data/indicators`, {
          params: {
            symbol: symbol,
            timeframe: timeframe,
            period: '1M',
            indicators: indicators.join(',')
          },
          timeout: 30000
        });

        // Merge indicator data with historical data
        if (response.data.data && Array.isArray(response.data.data)) {
          // Map indicator data to historical data by timestamp
          const indicatorMap = new Map();
          response.data.data.forEach((bar: any) => {
            const timestamp = new Date(bar.time * 1000);
            indicatorMap.set(timestamp.getTime(), bar);
          });

          // This is a simplified merge - in production, you'd want more robust matching
          dataWithIndicators = historicalData.map(bar => {
            const indicatorData = indicatorMap.get(bar.timestamp.getTime());
            return {
              ...bar,
              ...(indicatorData || {})
            };
          });
        }
      } catch (error) {
        console.warn(`Could not fetch indicators for ${symbol} ${timeframe}:`, error);
        // Continue with data without indicators
      }
    }

    // Calculate signals for each strategy
    const signals: StrategySignal[] = [];
    const latestBar = dataWithIndicators[dataWithIndicators.length - 1];

    for (const strategyName of strategies) {
      const signal = await this.calculateStrategySignal(
        setupId,
        contractId,
        symbol,
        timeframe,
        strategyName,
        dataWithIndicators,
        latestBar
      );

      if (signal) {
        signals.push(signal);
      }
    }

    return signals;
  },

  /**
   * Calculate signal for a specific strategy
   */
  async calculateStrategySignal(
    setupId: number,
    contractId: number,
    symbol: string,
    timeframe: string,
    strategyName: string,
    data: any[],
    latestBar: any
  ): Promise<StrategySignal | null> {
    if (data.length < 2) {
      return null;
    }

    const currentBar = latestBar;
    const previousBar = data[data.length - 2];
    const price = currentBar.close;

    let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;
    const indicatorValues: Record<string, any> = {};

    // Extract indicator values
    if (currentBar.sma_20 !== undefined) indicatorValues.sma_20 = currentBar.sma_20;
    if (currentBar.sma_50 !== undefined) indicatorValues.sma_50 = currentBar.sma_50;
    if (currentBar.ema_12 !== undefined) indicatorValues.ema_12 = currentBar.ema_12;
    if (currentBar.ema_26 !== undefined) indicatorValues.ema_26 = currentBar.ema_26;
    if (currentBar.rsi !== undefined) indicatorValues.rsi = currentBar.rsi;
    if (currentBar.macd !== undefined) indicatorValues.macd = currentBar.macd;
    if (currentBar.macd_signal !== undefined) indicatorValues.macd_signal = currentBar.macd_signal;
    if (currentBar.bb_upper !== undefined) indicatorValues.bb_upper = currentBar.bb_upper;
    if (currentBar.bb_middle !== undefined) indicatorValues.bb_middle = currentBar.bb_middle;
    if (currentBar.bb_lower !== undefined) indicatorValues.bb_lower = currentBar.bb_lower;

    // Strategy-specific logic
    switch (strategyName) {
      case 'ma_crossover':
        if (indicatorValues.sma_20 && indicatorValues.sma_50) {
          const fastMA = indicatorValues.sma_20;
          const slowMA = indicatorValues.sma_50;
          const prevFastMA = previousBar.sma_20;
          const prevSlowMA = previousBar.sma_50;

          // Buy: Fast MA crosses above Slow MA
          if (fastMA > slowMA && prevFastMA <= prevSlowMA) {
            signalType = 'BUY';
            confidence = 0.7;
          }
          // Sell: Fast MA crosses below Slow MA
          else if (fastMA < slowMA && prevFastMA >= prevSlowMA) {
            signalType = 'SELL';
            confidence = 0.7;
          }
        }
        break;

      case 'rsi_strategy':
        if (indicatorValues.rsi !== undefined) {
          const rsi = indicatorValues.rsi;
          // Buy: RSI < 30 (oversold)
          if (rsi < 30) {
            signalType = 'BUY';
            confidence = 0.8 - (rsi / 30) * 0.3; // Higher confidence for lower RSI
          }
          // Sell: RSI > 70 (overbought)
          else if (rsi > 70) {
            signalType = 'SELL';
            confidence = 0.8 - ((100 - rsi) / 30) * 0.3; // Higher confidence for higher RSI
          }
        }
        break;

      case 'macd_strategy':
        if (indicatorValues.macd !== undefined && indicatorValues.macd_signal !== undefined) {
          const macd = indicatorValues.macd;
          const signal = indicatorValues.macd_signal;
          const prevMacd = previousBar.macd;
          const prevSignal = previousBar.macd_signal;

          // Buy: MACD crosses above signal
          if (macd > signal && prevMacd <= prevSignal) {
            signalType = 'BUY';
            confidence = 0.75;
          }
          // Sell: MACD crosses below signal
          else if (macd < signal && prevMacd >= prevSignal) {
            signalType = 'SELL';
            confidence = 0.75;
          }
        }
        break;

      case 'bollinger_bands':
        if (indicatorValues.bb_upper && indicatorValues.bb_lower) {
          const upper = indicatorValues.bb_upper;
          const lower = indicatorValues.bb_lower;
          
          // Buy: Price touches lower band
          if (price <= lower * 1.01) { // 1% tolerance
            signalType = 'BUY';
            confidence = 0.7;
          }
          // Sell: Price touches upper band
          else if (price >= upper * 0.99) { // 1% tolerance
            signalType = 'SELL';
            confidence = 0.7;
          }
        }
        break;

      case 'stochastic_strategy':
        // This would require stochastic indicator data
        // For now, return HOLD
        break;

      default:
        console.warn(`Unknown strategy: ${strategyName}`);
        return null;
    }

    // Only return signal if it's not HOLD
    if (signalType === 'HOLD') {
      return null;
    }

    return {
      setupId,
      contractId,
      timeframe,
      timestamp: currentBar.timestamp,
      strategyName,
      signalType,
      price,
      confidence,
      indicatorValues
    };
  },

  /**
   * Store strategy signal in database
   */
  async storeStrategySignal(signal: StrategySignal): Promise<number> {
    const query = `
      INSERT INTO strategy_signals (
        setup_id, contract_id, timeframe, timestamp, strategy_name, 
        signal_type, price, confidence, indicator_values
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (setup_id, timeframe, timestamp, strategy_name)
      DO UPDATE SET
        signal_type = EXCLUDED.signal_type,
        price = EXCLUDED.price,
        confidence = EXCLUDED.confidence,
        indicator_values = EXCLUDED.indicator_values
      RETURNING id
    `;

    const result = await dbService.query(query, [
      signal.setupId,
      signal.contractId,
      signal.timeframe,
      signal.timestamp,
      signal.strategyName,
      signal.signalType,
      signal.price,
      signal.confidence,
      signal.indicatorValues ? JSON.stringify(signal.indicatorValues) : null
    ]);

    return result.rows[0].id;
  },

  /**
   * Get strategy signals for a setup
   */
  async getStrategySignals(
    setupId: number,
    timeframe?: string,
    signalType?: 'BUY' | 'SELL' | 'HOLD',
    limit?: number
  ): Promise<StrategySignal[]> {
    let query = `
      SELECT id, setup_id, contract_id, timeframe, timestamp, strategy_name,
             signal_type, price, confidence, indicator_values, created_at
      FROM strategy_signals
      WHERE setup_id = $1
    `;
    
    const params: any[] = [setupId];
    let paramIndex = 2;

    if (timeframe) {
      query += ` AND timeframe = $${paramIndex}`;
      params.push(timeframe);
      paramIndex++;
    }

    if (signalType) {
      query += ` AND signal_type = $${paramIndex}`;
      params.push(signalType);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await dbService.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      setupId: row.setup_id,
      contractId: row.contract_id,
      timeframe: row.timeframe,
      timestamp: row.timestamp,
      strategyName: row.strategy_name,
      signalType: row.signal_type,
      price: parseFloat(row.price),
      confidence: parseFloat(row.confidence),
      indicatorValues: row.indicator_values ? JSON.parse(row.indicator_values) : undefined
    }));
  }
};

