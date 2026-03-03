/**
 * Broker-agnostic connection routes
 *
 * Uses BrokerConnectionResolver for unified connection status across brokers.
 * Broker-specific CRUD remains in /api/ib-connections, /api/ctrader-connections, etc.
 */

import express from 'express';
import type { Request, Response } from 'express';
import { brokerFactory } from '../services/brokers/index.js';
import { getBrokerFromRequest } from '../middleware/brokerSelection.js';
import type { BrokerType } from '../types/broker.js';

const router = express.Router();

/**
 * GET /api/broker-connections/active
 * Get active connection for a broker type.
 * Query: ?broker=IB|CTRADER|MT5
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const brokerType = getBrokerFromRequest(req) as BrokerType;

    if (!brokerFactory.hasConnectionService(brokerType)) {
      return res.status(404).json({
        error: `No connection service for broker type: ${brokerType}`,
        broker: brokerType,
        timestamp: new Date().toISOString()
      });
    }

    const connection = await brokerFactory.getActiveConnection(brokerType);

    if (!connection) {
      return res.json({
        broker: brokerType,
        active: false,
        message: 'No active or default profile',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      broker: brokerType,
      active: true,
      profileId: connection.profileId,
      profileName: connection.profileName,
      config: {
        ...connection.config,
        // Omit sensitive fields if needed
        settings: connection.config.settings
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting active connection:', error);
    res.status(500).json({
      error: 'Failed to get active connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/broker-connections/status
 * Get connection status for a broker type.
 * Query: ?broker=IB|CTRADER|MT5
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const brokerType = getBrokerFromRequest(req) as BrokerType;

    if (!brokerFactory.hasConnectionService(brokerType)) {
      return res.status(404).json({
        error: `No connection service for broker type: ${brokerType}`,
        broker: brokerType,
        timestamp: new Date().toISOString()
      });
    }

    const status = await brokerFactory.getConnectionStatus(brokerType);

    if (!status) {
      return res.json({
        broker: brokerType,
        connected: false,
        message: 'Connection status unavailable',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting connection status:', error);
    res.status(500).json({
      error: 'Failed to get connection status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
