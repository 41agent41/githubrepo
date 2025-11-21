import express from 'express';
import type { Request, Response } from 'express';
import { marketDataCollector } from '../services/marketDataCollector.js';

const router = express.Router();

// Manual trigger for data collection for a specific setup
router.post('/auto-collect', async (req: Request, res: Response) => {
  try {
    const { setup_id } = req.body;

    if (!setup_id) {
      return res.status(400).json({
        error: 'Missing required parameter: setup_id',
        received: req.body
      });
    }

    console.log(`Manual data collection triggered for setup ${setup_id}`);

    const stats = await marketDataCollector.collectForSetup(setup_id);

    res.json({
      message: 'Data collection completed',
      setup_id,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in manual data collection:', error);
    
    res.status(500).json({
      error: 'Failed to collect data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Collect data for all active setups
router.post('/auto-collect-all', async (req: Request, res: Response) => {
  try {
    console.log('Collecting data for all active setups');

    const stats = await marketDataCollector.collectForAllActiveSetups();

    res.json({
      message: 'Data collection completed for all active setups',
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in bulk data collection:', error);
    
    res.status(500).json({
      error: 'Failed to collect data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get collection status for a setup
router.get('/collection-status/:setupId', async (req: Request, res: Response) => {
  try {
    const { setupId } = req.params;
    const setupIdNum = parseInt(setupId, 10);

    if (isNaN(setupIdNum)) {
      return res.status(400).json({
        error: 'Invalid setup ID',
        received: setupId
      });
    }

    // This would check last collection times, etc.
    // For now, return basic status
    res.json({
      setup_id: setupIdNum,
      status: 'active',
      message: 'Collection status check not yet implemented',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting collection status:', error);
    
    res.status(500).json({
      error: 'Failed to get collection status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

