import express from 'express';
import type { Request, Response } from 'express';

const router = express.Router();
import { brokerFactory } from '../services/brokers/index.js';
import type { BrokerAccountSummary, BrokerPosition, BrokerOrder, BrokerConnectionStatusResponse } from '../types/broker.js';
import { getBrokerFromRequest } from '../middleware/brokerSelection.js'; // fallback when middleware not used
import { isDataQueryEnabled, handleDisabledDataQuery, getBrokerErrorResponse } from '../utils/routeUtils.js';

// Map BrokerAccountSummary to API response format (snake_case for compatibility)
function toAccountSummaryResponse(summary: BrokerAccountSummary) {
  return {
    account_id: summary.accountId,
    accountId: summary.accountId,
    net_liquidation: summary.netLiquidation,
    NetLiquidation: summary.netLiquidation,
    currency: summary.currency,
    total_cash_value: summary.totalCashValue,
    TotalCashValue: summary.totalCashValue,
    buying_power: summary.buyingPower,
    BuyingPower: summary.buyingPower,
    maintenance_margin: summary.maintenanceMargin,
    MaintMarginReq: summary.maintenanceMargin,
    last_updated: summary.lastUpdated.toISOString()
  };
}

// Map BrokerPosition to API response format
function toPositionResponse(pos: BrokerPosition) {
  return {
    symbol: pos.symbol,
    position: pos.position,
    market_price: pos.marketPrice,
    market_value: pos.marketValue,
    average_cost: pos.averageCost,
    unrealized_pnl: pos.unrealizedPnL,
    realized_pnl: pos.realizedPnL,
    currency: pos.currency,
    sec_type: pos.securityType,
    exchange: pos.exchange
  };
}

// Map BrokerOrder to API response format
function toOrderResponse(order: BrokerOrder) {
  return {
    order_id: parseInt(order.brokerOrderId, 10) || order.brokerOrderId,
    orderId: order.brokerOrderId,
    symbol: order.symbol,
    action: order.action,
    quantity: order.quantity,
    order_type: order.orderType,
    status: order.status,
    filled_quantity: order.filledQuantity,
    remaining_quantity: order.remainingQuantity,
    avg_fill_price: order.averageFillPrice
  };
}

// Map BrokerConnectionStatusResponse to API format (backwards compatible with ib_service /connection)
function toConnectionResponse(status: BrokerConnectionStatusResponse) {
  return {
    connected: status.connected,
    connection: {
      ib_gateway: {
        connected: status.connected,
        host: status.details?.host,
        port: status.details?.port,
        client_id: status.details?.clientId,
        account_mode: status.accountMode,
        last_error: status.lastError
      }
    }
  };
}

// Get account summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Account summary data querying is disabled');
    }

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Fetching account summary`);

    const summary = await broker.getAccountSummary();
    const response = toAccountSummaryResponse(summary);

    console.log(`[${brokerType}] Successfully fetched account summary`);
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching account summary:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to fetch account summary');
    res.status(statusCode).json({
      error: 'Failed to fetch account summary',
      detail: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Get account positions
router.get('/positions', async (req: Request, res: Response) => {
  try {
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Account positions data querying is disabled');
    }

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Fetching account positions`);

    const positions = await broker.getPositions();
    const mappedPositions = positions.map(toPositionResponse);

    console.log(`[${brokerType}] Successfully fetched ${positions.length} positions`);
    res.json({
      positions: mappedPositions,
      count: mappedPositions.length,
      last_updated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching account positions:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to fetch account positions');
    res.status(statusCode).json({
      error: 'Failed to fetch account positions',
      detail: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Get account orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'Account orders data querying is disabled');
    }

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Fetching account orders`);

    const orders = await broker.getOrders();
    const mappedOrders = orders.map(toOrderResponse);

    console.log(`[${brokerType}] Successfully fetched ${orders.length} orders`);
    res.json({
      orders: mappedOrders,
      count: mappedOrders.length,
      last_updated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching account orders:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to fetch account orders');
    res.status(statusCode).json({
      error: 'Failed to fetch account orders',
      detail: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all account data in one call
router.get('/all', async (req: Request, res: Response) => {
  try {
    if (!isDataQueryEnabled(req)) {
      return handleDisabledDataQuery(res, 'All account data querying is disabled');
    }

    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Fetching all account data`);

    const { account, positions, orders } = await broker.getAccountData();

    console.log(`[${brokerType}] Successfully fetched all account data`);
    res.json({
      account: toAccountSummaryResponse(account),
      positions: positions.map(toPositionResponse),
      orders: orders.map(toOrderResponse),
      last_updated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching all account data:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to fetch all account data');
    res.status(statusCode).json({
      error: 'Failed to fetch all account data',
      detail: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Get broker connection status
router.get('/connection', async (req: Request, res: Response) => {
  try {
    const brokerType = req.brokerType ?? getBrokerFromRequest(req);
    const broker = brokerFactory.getBroker(brokerType);

    console.log(`[${brokerType}] Checking connection status`);

    const status = await broker.getConnectionStatus();
    const response = toConnectionResponse(status);

    console.log(`[${brokerType}] Successfully retrieved connection status`);
    res.json(response);
  } catch (error: any) {
    console.error('Error checking connection status:', error);
    const { statusCode, errorMessage } = getBrokerErrorResponse(error, 'Failed to check connection status');
    res.status(statusCode).json({
      error: 'Failed to check connection status',
      detail: errorMessage,
      connected: false,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
