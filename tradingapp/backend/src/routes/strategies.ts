import express from 'express';
import type { Request, Response } from 'express';
import { strategyService } from '../services/strategyService.js';

const router = express.Router();

// Calculate strategy signals
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { setup_id, symbol, timeframe, strategies } = req.body;

    if (!setup_id && (!symbol || !timeframe || !strategies)) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['setup_id'] + (!setup_id ? ['symbol', 'timeframe', 'strategies'] : []),
        received: req.body
      });
    }

    let result;

    if (setup_id) {
      // Calculate for entire setup
      console.log(`Calculating strategy signals for setup ${setup_id}`);
      result = await strategyService.calculateSignalsForSetup(setup_id);
    } else {
      // Calculate for specific symbol/timeframe/strategies
      // This would require additional service method
      return res.status(400).json({
        error: 'Direct symbol/timeframe calculation not yet implemented',
        message: 'Please use setup_id instead'
      });
    }

    res.json({
      message: 'Strategy signals calculated successfully',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error calculating strategy signals:', error);
    
    res.status(500).json({
      error: 'Failed to calculate strategy signals',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get strategy signals for a setup
router.get('/signals/:setupId', async (req: Request, res: Response) => {
  try {
    const { setupId } = req.params;
    const { timeframe, signal_type, limit } = req.query;

    const setupIdNum = parseInt(setupId, 10);

    if (isNaN(setupIdNum)) {
      return res.status(400).json({
        error: 'Invalid setup ID',
        received: setupId
      });
    }

    const signals = await strategyService.getStrategySignals(
      setupIdNum,
      timeframe as string | undefined,
      signal_type as 'BUY' | 'SELL' | 'HOLD' | undefined,
      limit ? parseInt(limit as string, 10) : undefined
    );

    res.json({
      setup_id: setupIdNum,
      signals,
      count: signals.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting strategy signals:', error);
    
    res.status(500).json({
      error: 'Failed to get strategy signals',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get available strategies
router.get('/available', async (req: Request, res: Response) => {
  try {
    const strategies = {
      ma_crossover: {
        name: 'Moving Average Crossover',
        description: 'Buy when fast MA crosses above slow MA, sell when it crosses below',
        category: 'Trend Following',
        parameters: { fast_period: 12, slow_period: 26 },
        required_indicators: ['sma_20', 'sma_50']
      },
      rsi_strategy: {
        name: 'RSI Strategy',
        description: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)',
        category: 'Momentum',
        parameters: { oversold: 30, overbought: 70 },
        required_indicators: ['rsi']
      },
      macd_strategy: {
        name: 'MACD Strategy',
        description: 'Buy when MACD crosses above signal line, sell when it crosses below',
        category: 'Momentum',
        parameters: {},
        required_indicators: ['macd']
      },
      bollinger_bands: {
        name: 'Bollinger Bands',
        description: 'Buy when price touches lower band, sell when it touches upper band',
        category: 'Mean Reversion',
        parameters: { period: 20, std_dev: 2 },
        required_indicators: ['bollinger']
      },
      stochastic_strategy: {
        name: 'Stochastic Strategy',
        description: 'Buy when stochastic is oversold, sell when overbought',
        category: 'Momentum',
        parameters: { oversold: 20, overbought: 80 },
        required_indicators: ['stochastic']
      }
    };

    res.json({
      strategies,
      count: Object.keys(strategies).length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting available strategies:', error);
    
    res.status(500).json({
      error: 'Failed to get available strategies',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

