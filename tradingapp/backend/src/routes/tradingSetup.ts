import express from 'express';
import type { Request, Response } from 'express';
import { tradingSetupService } from '../services/tradingSetupService.js';
import { marketDataCollector } from '../services/marketDataCollector.js';
import { strategyService } from '../services/strategyService.js';

const router = express.Router();

// Create new trading setup
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      contract_id,
      timeframes,
      indicators,
      strategies,
      secType,
      exchange,
      currency
    } = req.body;

    // Validate required parameters
    if (!symbol || !timeframes || !Array.isArray(timeframes) || timeframes.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'timeframes (array)'],
        received: { symbol, timeframes, indicators, strategies }
      });
    }

    // Validate timeframes
    const validTimeframes = ['5min', '15min', '30min', '1hour', '4hour', '8hour', '1day'];
    const invalidTimeframes = timeframes.filter((tf: string) => !validTimeframes.includes(tf));
    if (invalidTimeframes.length > 0) {
      return res.status(400).json({
        error: 'Invalid timeframes',
        valid_timeframes: validTimeframes,
        invalid: invalidTimeframes
      });
    }

    console.log(`Creating trading setup for ${symbol} with ${timeframes.length} timeframes`);

    // Create trading setup
    const setup = await tradingSetupService.createSetup({
      symbol,
      contractId: contract_id,
      timeframes,
      indicators: indicators || [],
      strategies: strategies || [],
      secType: secType || 'STK',
      exchange: exchange || 'SMART',
      currency: currency || 'USD'
    });

    // Trigger initial data collection (async, don't wait)
    marketDataCollector.collectForSetup(setup.id).catch((err) => {
      console.error(`Error in initial data collection for setup ${setup.id}:`, err);
    });

    // Trigger initial strategy calculation if strategies are selected (async, don't wait)
    if (setup.strategies && setup.strategies.length > 0) {
      strategyService.calculateSignalsForSetup(setup.id).catch((err) => {
        console.error(`Error in initial strategy calculation for setup ${setup.id}:`, err);
      });
    }

    // Generate chart URLs
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const indicatorsParam = setup.indicators.length > 0 ? `&indicators=${setup.indicators.join(',')}` : '';
    const strategiesParam = setup.strategies.length > 0 ? `&strategies=${setup.strategies.join(',')}` : '';
    const portParam = setup.port ? `&port=${setup.port}` : '';

    const chartUrls = setup.timeframes.map(timeframe => {
      return `${baseUrl}/chart/${symbol}/${timeframe}?setupId=${setup.id}${indicatorsParam}${strategiesParam}${portParam}`;
    });

    res.json({
      setup_id: setup.id,
      port: setup.port,
      chart_urls: chartUrls,
      symbol: setup.symbol,
      timeframes: setup.timeframes,
      indicators: setup.indicators,
      strategies: setup.strategies,
      status: setup.status,
      created_at: setup.createdAt,
      message: 'Trading setup created successfully. Initial data collection and strategy calculation started.'
    });

  } catch (error: any) {
    console.error('Error creating trading setup:', error);
    
    res.status(500).json({
      error: 'Failed to create trading setup',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get trading setup by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const setupId = parseInt(id, 10);

    if (isNaN(setupId)) {
      return res.status(400).json({
        error: 'Invalid setup ID',
        received: id
      });
    }

    const setup = await tradingSetupService.getSetup(setupId);

    if (!setup) {
      return res.status(404).json({
        error: 'Trading setup not found',
        setup_id: setupId
      });
    }

    res.json({
      id: setup.id,
      symbol: setup.symbol,
      contract_id: setup.contractId,
      timeframes: setup.timeframes,
      indicators: setup.indicators,
      strategies: setup.strategies,
      port: setup.port,
      status: setup.status,
      created_at: setup.createdAt,
      updated_at: setup.updatedAt
    });

  } catch (error: any) {
    console.error('Error getting trading setup:', error);
    
    res.status(500).json({
      error: 'Failed to get trading setup',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// List all trading setups
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    const setups = await tradingSetupService.listSetups(status as string | undefined);

    res.json({
      setups,
      count: setups.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error listing trading setups:', error);
    
    res.status(500).json({
      error: 'Failed to list trading setups',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update trading setup
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const setupId = parseInt(id, 10);

    if (isNaN(setupId)) {
      return res.status(400).json({
        error: 'Invalid setup ID',
        received: id
      });
    }

    const {
      timeframes,
      indicators,
      strategies,
      status
    } = req.body;

    const setup = await tradingSetupService.updateSetup(setupId, {
      timeframes,
      indicators,
      strategies,
      status
    });

    if (!setup) {
      return res.status(404).json({
        error: 'Trading setup not found',
        setup_id: setupId
      });
    }

    res.json(setup);

  } catch (error: any) {
    console.error('Error updating trading setup:', error);
    
    res.status(500).json({
      error: 'Failed to update trading setup',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete trading setup
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const setupId = parseInt(id, 10);

    if (isNaN(setupId)) {
      return res.status(400).json({
        error: 'Invalid setup ID',
        received: id
      });
    }

    const deleted = await tradingSetupService.deleteSetup(setupId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Trading setup not found',
        setup_id: setupId
      });
    }

    res.json({
      message: 'Trading setup deleted successfully',
      setup_id: setupId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error deleting trading setup:', error);
    
    res.status(500).json({
      error: 'Failed to delete trading setup',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

