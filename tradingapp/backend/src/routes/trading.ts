import express from 'express';
import type { Request, Response } from 'express';
import { orderService } from '../services/orderService.js';

const router = express.Router();

// Place order
router.post('/place-order', async (req: Request, res: Response) => {
  try {
    const {
      setup_id,
      signal_id,
      contract_id,
      order_type,
      action,
      quantity,
      price
    } = req.body;

    // Validate required parameters
    if (!contract_id || !action || !quantity) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['contract_id', 'action', 'quantity'],
        received: { contract_id, action, quantity, order_type, price }
      });
    }

    if (!['BUY', 'SELL'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        valid_actions: ['BUY', 'SELL'],
        received: action
      });
    }

    if (!['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'].includes(order_type || 'MARKET')) {
      return res.status(400).json({
        error: 'Invalid order type',
        valid_types: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'],
        received: order_type
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        error: 'Quantity must be greater than 0',
        received: quantity
      });
    }

    console.log(`Placing ${action} order: ${quantity} shares, type: ${order_type || 'MARKET'}`);

    const order = await orderService.placeOrder({
      setupId: setup_id,
      signalId: signal_id,
      contractId: contract_id,
      orderType: (order_type || 'MARKET') as 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT',
      action: action as 'BUY' | 'SELL',
      quantity: quantity,
      price: price,
      status: 'pending'
    });

    res.json({
      message: 'Order placed successfully',
      order,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error placing order:', error);
    
    res.status(500).json({
      error: 'Failed to place order',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cancel order
router.post('/cancel-order', async (req: Request, res: Response) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        error: 'Missing required parameter: order_id',
        received: req.body
      });
    }

    console.log(`Cancelling order ${order_id}`);

    const cancelled = await orderService.cancelOrder(order_id);

    res.json({
      message: 'Order cancelled successfully',
      order_id,
      cancelled,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error cancelling order:', error);
    
    res.status(500).json({
      error: 'Failed to cancel order',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { setup_id, status, limit } = req.query;

    const filters: any = {};
    if (setup_id) {
      filters.setupId = parseInt(setup_id as string, 10);
    }
    if (status) {
      filters.status = status as string;
    }
    if (limit) {
      filters.limit = parseInt(limit as string, 10);
    }

    const orders = await orderService.listOrders(filters);

    res.json({
      orders,
      count: orders.length,
      filters,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting orders:', error);
    
    res.status(500).json({
      error: 'Failed to get orders',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get order status
router.get('/order-status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({
        error: 'Invalid order ID',
        received: id
      });
    }

    const order = await orderService.getOrder(orderId);

    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        order_id: orderId
      });
    }

    res.json({
      order,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting order status:', error);
    
    res.status(500).json({
      error: 'Failed to get order status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

