import { dbService } from './database.js';
import { tradingSetupService } from './tradingSetupService.js';
import axios from 'axios';

// Import WebSocket broadcast function (will be set from index.ts)
let broadcastOrderStatusFn: ((order: OrderExecution) => void) | null = null;

export function setBroadcastOrderStatus(fn: (order: OrderExecution) => void) {
  broadcastOrderStatusFn = fn;
}

const IB_SERVICE_URL = process.env.IB_SERVICE_URL || 'http://ib_service:8000';

interface OrderExecution {
  id?: number;
  setupId?: number;
  signalId?: number;
  contractId: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  action: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  ibOrderId?: number;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'rejected' | 'partial';
  filledQuantity?: number;
  avgFillPrice?: number;
  errorMessage?: string;
}

export const orderService = {
  /**
   * Place order through IB Gateway
   */
  async placeOrder(order: OrderExecution): Promise<OrderExecution> {
    try {
      // Validate order
      if (order.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      if (order.orderType === 'LIMIT' && !order.price) {
        throw new Error('Limit price required for LIMIT orders');
      }

      if (order.orderType === 'STOP' && !order.price) {
        throw new Error('Stop price required for STOP orders');
      }

      // Get contract information if setupId is provided
      let symbol: string | undefined;
      if (order.setupId) {
        const setup = await tradingSetupService.getSetup(order.setupId);
        if (setup) {
          symbol = setup.symbol;
        }
      }

      // Place order via IB service
      console.log(`Placing ${order.action} order for ${symbol || 'contract'} ${order.quantity} shares`);

      const ibOrderResponse = await axios.post(`${IB_SERVICE_URL}/orders/place`, {
        symbol: symbol,
        action: order.action,
        quantity: order.quantity,
        order_type: order.orderType === 'MARKET' ? 'MKT' : 
                    order.orderType === 'LIMIT' ? 'LMT' : 
                    order.orderType === 'STOP' ? 'STP' : 'STP LMT',
        limit_price: order.orderType === 'LIMIT' ? order.price : undefined,
        stop_price: order.orderType === 'STOP' ? order.price : undefined
      }, {
        timeout: 30000
      });

      const ibOrder = ibOrderResponse.data;

      // Store order in database
      const storedOrder = await this.storeOrderExecution({
        ...order,
        ibOrderId: ibOrder.order_id,
        status: 'submitted'
      });

      // Broadcast order status via WebSocket
      if (broadcastOrderStatusFn) {
        broadcastOrderStatusFn(storedOrder);
      }

      return storedOrder;

    } catch (error) {
      console.error('Error placing order:', error);
      
      // Store failed order
      const failedOrder = await this.storeOrderExecution({
        ...order,
        status: 'rejected',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  },

  /**
   * Store order execution in database
   */
  async storeOrderExecution(order: OrderExecution): Promise<OrderExecution> {
    const query = `
      INSERT INTO order_executions (
        setup_id, signal_id, contract_id, order_type, action, quantity, price,
        ib_order_id, status, filled_quantity, avg_fill_price, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, setup_id, signal_id, contract_id, order_type, action, quantity, price,
                ib_order_id, status, filled_quantity, avg_fill_price, error_message,
                created_at, updated_at
    `;

    const result = await dbService.query(query, [
      order.setupId || null,
      order.signalId || null,
      order.contractId,
      order.orderType,
      order.action,
      order.quantity,
      order.price || null,
      order.ibOrderId || null,
      order.status,
      order.filledQuantity || null,
      order.avgFillPrice || null,
      order.errorMessage || null
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      setupId: row.setup_id,
      signalId: row.signal_id,
      contractId: row.contract_id,
      orderType: row.order_type,
      action: row.action,
      quantity: parseFloat(row.quantity),
      price: row.price ? parseFloat(row.price) : undefined,
      ibOrderId: row.ib_order_id,
      status: row.status,
      filledQuantity: row.filled_quantity ? parseFloat(row.filled_quantity) : undefined,
      avgFillPrice: row.avg_fill_price ? parseFloat(row.avg_fill_price) : undefined,
      errorMessage: row.error_message
    };
  },

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: number,
    status: OrderExecution['status'],
    filledQuantity?: number,
    avgFillPrice?: number,
    errorMessage?: string
  ): Promise<OrderExecution | null> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    updateFields.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;

    if (filledQuantity !== undefined) {
      updateFields.push(`filled_quantity = $${paramIndex}`);
      params.push(filledQuantity);
      paramIndex++;
    }

    if (avgFillPrice !== undefined) {
      updateFields.push(`avg_fill_price = $${paramIndex}`);
      params.push(avgFillPrice);
      paramIndex++;
    }

    if (errorMessage !== undefined) {
      updateFields.push(`error_message = $${paramIndex}`);
      params.push(errorMessage);
      paramIndex++;
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(orderId);

    const query = `
      UPDATE order_executions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, setup_id, signal_id, contract_id, order_type, action, quantity, price,
                ib_order_id, status, filled_quantity, avg_fill_price, error_message,
                created_at, updated_at
    `;

    const result = await dbService.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      setupId: row.setup_id,
      signalId: row.signal_id,
      contractId: row.contract_id,
      orderType: row.order_type,
      action: row.action,
      quantity: parseFloat(row.quantity),
      price: row.price ? parseFloat(row.price) : undefined,
      ibOrderId: row.ib_order_id,
      status: row.status,
      filledQuantity: row.filled_quantity ? parseFloat(row.filled_quantity) : undefined,
      avgFillPrice: row.avg_fill_price ? parseFloat(row.avg_fill_price) : undefined,
      errorMessage: row.error_message
    };
  },

  /**
   * Get order by ID
   */
  async getOrder(orderId: number): Promise<OrderExecution | null> {
    const query = `
      SELECT id, setup_id, signal_id, contract_id, order_type, action, quantity, price,
             ib_order_id, status, filled_quantity, avg_fill_price, error_message,
             created_at, updated_at
      FROM order_executions
      WHERE id = $1
    `;

    const result = await dbService.query(query, [orderId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      setupId: row.setup_id,
      signalId: row.signal_id,
      contractId: row.contract_id,
      orderType: row.order_type,
      action: row.action,
      quantity: parseFloat(row.quantity),
      price: row.price ? parseFloat(row.price) : undefined,
      ibOrderId: row.ib_order_id,
      status: row.status,
      filledQuantity: row.filled_quantity ? parseFloat(row.filled_quantity) : undefined,
      avgFillPrice: row.avg_fill_price ? parseFloat(row.avg_fill_price) : undefined,
      errorMessage: row.error_message
    };
  },

  /**
   * List orders with filters
   */
  async listOrders(filters: {
    setupId?: number;
    status?: string;
    limit?: number;
  } = {}): Promise<OrderExecution[]> {
    let query = `
      SELECT id, setup_id, signal_id, contract_id, order_type, action, quantity, price,
             ib_order_id, status, filled_quantity, avg_fill_price, error_message,
             created_at, updated_at
      FROM order_executions
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.setupId) {
      query += ` AND setup_id = $${paramIndex}`;
      params.push(filters.setupId);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }

    const result = await dbService.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      setupId: row.setup_id,
      signalId: row.signal_id,
      contractId: row.contract_id,
      orderType: row.order_type,
      action: row.action,
      quantity: parseFloat(row.quantity),
      price: row.price ? parseFloat(row.price) : undefined,
      ibOrderId: row.ib_order_id,
      status: row.status,
      filledQuantity: row.filled_quantity ? parseFloat(row.filled_quantity) : undefined,
      avgFillPrice: row.avg_fill_price ? parseFloat(row.avg_fill_price) : undefined,
      errorMessage: row.error_message
    }));
  },

  /**
   * Cancel order
   */
  async cancelOrder(orderId: number): Promise<boolean> {
    const order = await this.getOrder(orderId);
    
    if (!order || !order.ibOrderId) {
      throw new Error('Order not found or has no IB order ID');
    }

    if (['filled', 'cancelled', 'rejected'].includes(order.status)) {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    try {
      // Cancel order via IB service
      await axios.post(`${IB_SERVICE_URL}/orders/cancel`, {
        order_id: order.ibOrderId
      }, {
        timeout: 10000
      });

      // Update order status
      const updatedOrder = await this.updateOrderStatus(orderId, 'cancelled');
      
      // Broadcast order status via WebSocket
      if (updatedOrder && broadcastOrderStatusFn) {
        broadcastOrderStatusFn(updatedOrder);
      }

      return true;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }
};

