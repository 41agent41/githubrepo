/**
 * Interactive Brokers (IB) Broker Service Implementation
 * 
 * Implements the IBrokerService interface for Interactive Brokers.
 * This adapter wraps calls to the IB Gateway service (Python FastAPI).
 */

import axios, { AxiosInstance } from 'axios';
import { BaseBrokerService } from './IBrokerService.js';
import {
  BrokerType,
  BrokerAccountSummary,
  BrokerPosition,
  BrokerOrder,
  BrokerOrderRequest,
  BrokerQuote,
  BrokerContract,
  ContractSearchParams,
  AdvancedContractSearchParams,
  HistoricalDataParams,
  HistoricalDataResponse,
  BrokerConnectionConfig,
  BrokerConnectionStatusResponse,
  CandlestickBar,
  OrderStatus,
  AccountMode,
  BrokerError,
  BrokerConnectionError,
  BrokerOrderError
} from '../../types/broker.js';
import { getIBServiceUrl } from '../../config/runtimeConfig.js';

/**
 * IB-specific configuration extensions
 */
interface IBConnectionConfig extends BrokerConnectionConfig {
  connectionType?: 'gateway' | 'tws';
}

/**
 * Interactive Brokers broker service implementation
 */
export class IBBrokerService extends BaseBrokerService {
  readonly brokerType: BrokerType = 'IB';
  
  private httpClient: AxiosInstance;
  private currentAccountMode: AccountMode = 'paper';

  constructor(serviceUrl?: string) {
    const url = serviceUrl || getIBServiceUrl();
    super(url);
    
    this.httpClient = axios.create({
      baseURL: url,
      headers: {
        'Connection': 'close'
      }
    });
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(config: IBConnectionConfig): Promise<BrokerConnectionStatusResponse> {
    try {
      const response = await this.httpClient.post('/connection/connect', {
        host: config.host || '127.0.0.1',
        port: config.port || 4001,
        client_id: config.clientId || 1,
        timeout: config.timeoutSeconds || 15,
        connection_type: config.connectionType || 'gateway',
        account_mode: config.accountMode || 'paper'
      }, {
        timeout: ((config.timeoutSeconds || 15) + 10) * 1000
      });

      this.currentAccountMode = config.accountMode || 'paper';

      return {
        brokerType: 'IB',
        connected: response.data?.success || false,
        accountMode: this.currentAccountMode,
        details: response.data
      };
    } catch (error: any) {
      throw new BrokerConnectionError(
        error.response?.data?.detail || error.message || 'Failed to connect to IB Gateway',
        'IB',
        error.code,
        error
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.httpClient.post('/connection/disconnect', {}, {
        timeout: 10000
      });
    } catch (error: any) {
      throw new BrokerConnectionError(
        error.message || 'Failed to disconnect from IB Gateway',
        'IB',
        error.code,
        error
      );
    }
  }

  async getConnectionStatus(): Promise<BrokerConnectionStatusResponse> {
    try {
      const response = await this.httpClient.get('/health', {
        timeout: 5000
      });

      const connected = response.data?.connection?.ib_gateway?.connected || false;

      return {
        brokerType: 'IB',
        connected,
        accountMode: response.data?.connection?.ib_gateway?.account_mode || this.currentAccountMode,
        lastError: response.data?.connection?.ib_gateway?.last_error,
        details: {
          host: response.data?.connection?.ib_gateway?.host,
          port: response.data?.connection?.ib_gateway?.port,
          clientId: response.data?.connection?.ib_gateway?.client_id
        }
      };
    } catch (error: any) {
      return {
        brokerType: 'IB',
        connected: false,
        lastError: error.message
      };
    }
  }

  async testConnection(config: IBConnectionConfig): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.httpClient.post('/connection/test', {
        host: config.host || '127.0.0.1',
        port: config.port || 4001,
        client_id: (config.clientId || 1) + 100, // Use different client ID for testing
        timeout: config.timeoutSeconds || 15,
        connection_type: config.connectionType || 'gateway',
        account_mode: config.accountMode || 'paper'
      }, {
        timeout: ((config.timeoutSeconds || 15) + 10) * 1000
      });

      return {
        success: response.data?.success || false,
        message: response.data?.message || 'Connection test completed',
        details: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Connection test failed',
        details: { error: error.message }
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const response = await this.httpClient.get('/health', {
        timeout: 5000
      });

      return {
        healthy: response.status === 200,
        details: response.data
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  async getAccountSummary(): Promise<BrokerAccountSummary> {
    try {
      const response = await this.httpClient.get('/account/summary', {
        timeout: 20000
      });

      const data = response.data;

      return {
        accountId: data.account_id || data.accountId || 'unknown',
        brokerType: 'IB',
        accountMode: this.currentAccountMode,
        currency: data.currency || 'USD',
        netLiquidation: parseFloat(data.net_liquidation || data.NetLiquidation || 0),
        totalCashValue: parseFloat(data.total_cash_value || data.TotalCashValue || 0),
        buyingPower: parseFloat(data.buying_power || data.BuyingPower || 0),
        availableFunds: parseFloat(data.available_funds || data.AvailableFunds || 0),
        excessLiquidity: parseFloat(data.excess_liquidity || data.ExcessLiquidity || 0),
        maintenanceMargin: parseFloat(data.maintenance_margin || data.MaintMarginReq || 0),
        initialMargin: parseFloat(data.initial_margin || data.InitMarginReq || 0),
        unrealizedPnL: parseFloat(data.unrealized_pnl || data.UnrealizedPnL || 0),
        realizedPnL: parseFloat(data.realized_pnl || data.RealizedPnL || 0),
        lastUpdated: new Date()
      };
    } catch (error: any) {
      this.handleHttpError(error, 'get account summary');
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    try {
      const response = await this.httpClient.get('/account/positions', {
        timeout: 20000
      });

      const positions = Array.isArray(response.data) ? response.data : response.data.positions || [];

      return positions.map((pos: any) => ({
        symbol: pos.symbol || pos.contract?.symbol || 'unknown',
        brokerType: 'IB' as BrokerType,
        brokerSymbol: pos.symbol || pos.contract?.symbol || 'unknown',
        position: parseFloat(pos.position || pos.pos || 0),
        averageCost: parseFloat(pos.average_cost || pos.avgCost || 0),
        marketPrice: pos.market_price ? parseFloat(pos.market_price) : undefined,
        marketValue: pos.market_value ? parseFloat(pos.market_value) : undefined,
        unrealizedPnL: pos.unrealized_pnl ? parseFloat(pos.unrealized_pnl) : undefined,
        realizedPnL: pos.realized_pnl ? parseFloat(pos.realized_pnl) : undefined,
        securityType: pos.sec_type || pos.secType || 'STK',
        exchange: pos.exchange,
        currency: pos.currency || 'USD',
        lastUpdated: new Date()
      }));
    } catch (error: any) {
      this.handleHttpError(error, 'get positions');
    }
  }

  async getOrders(): Promise<BrokerOrder[]> {
    try {
      const response = await this.httpClient.get('/account/orders', {
        timeout: 20000
      });

      const orders = Array.isArray(response.data) ? response.data : response.data.orders || [];

      return orders.map((order: any) => this.mapIBOrderToBrokerOrder(order));
    } catch (error: any) {
      this.handleHttpError(error, 'get orders');
    }
  }

  // ============================================================================
  // Order Operations
  // ============================================================================

  async placeOrder(orderRequest: BrokerOrderRequest): Promise<BrokerOrder> {
    try {
      const ibOrderType = this.mapOrderTypeToIB(orderRequest.orderType);

      const response = await this.httpClient.post('/orders/place', {
        symbol: this.toBrokerSymbol(orderRequest.symbol),
        action: orderRequest.action,
        quantity: orderRequest.quantity,
        order_type: ibOrderType,
        limit_price: orderRequest.orderType === 'LIMIT' || orderRequest.orderType === 'STOP_LIMIT' 
          ? orderRequest.limitPrice 
          : undefined,
        stop_price: orderRequest.orderType === 'STOP' || orderRequest.orderType === 'STOP_LIMIT'
          ? orderRequest.stopPrice
          : undefined,
        time_in_force: orderRequest.timeInForce || 'DAY'
      }, {
        timeout: 30000
      });

      const ibOrder = response.data;

      return {
        id: 0, // Will be set when stored in database
        brokerOrderId: String(ibOrder.order_id || ibOrder.orderId),
        brokerType: 'IB',
        symbol: orderRequest.symbol,
        brokerSymbol: this.toBrokerSymbol(orderRequest.symbol),
        action: orderRequest.action,
        orderType: orderRequest.orderType,
        quantity: orderRequest.quantity,
        filledQuantity: 0,
        remainingQuantity: orderRequest.quantity,
        limitPrice: orderRequest.limitPrice,
        stopPrice: orderRequest.stopPrice,
        status: 'submitted',
        timeInForce: orderRequest.timeInForce || 'DAY',
        submittedAt: new Date(),
        clientOrderId: orderRequest.clientOrderId,
        setupId: orderRequest.setupId,
        signalId: orderRequest.signalId,
        lastUpdated: new Date()
      };
    } catch (error: any) {
      throw new BrokerOrderError(
        error.response?.data?.detail || error.message || 'Failed to place order',
        'IB',
        undefined,
        error.code,
        error
      );
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.httpClient.post('/orders/cancel', {
        order_id: parseInt(orderId, 10)
      }, {
        timeout: 10000
      });

      return true;
    } catch (error: any) {
      throw new BrokerOrderError(
        error.response?.data?.detail || error.message || 'Failed to cancel order',
        'IB',
        orderId,
        error.code,
        error
      );
    }
  }

  async getOrderStatus(orderId: string): Promise<BrokerOrder | null> {
    try {
      const orders = await this.getOrders();
      return orders.find(o => o.brokerOrderId === orderId) || null;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // Market Data Operations
  // ============================================================================

  async searchContracts(params: ContractSearchParams): Promise<BrokerContract[]> {
    try {
      const response = await this.httpClient.post('/contract/search', {
        symbol: params.symbol,
        secType: params.securityType,
        exchange: params.exchange,
        currency: params.currency,
        name: params.searchByName
      }, {
        timeout: 30000
      });

      const results = response.data?.results || [];

      return results.map((contract: any) => ({
        symbol: contract.symbol,
        brokerSymbol: contract.symbol,
        securityType: contract.secType,
        exchange: contract.exchange,
        currency: contract.currency || 'USD',
        contractId: contract.contractId || contract.conId,
        multiplier: contract.multiplier ? parseFloat(contract.multiplier) : undefined,
        expiry: contract.expiry || contract.lastTradeDateOrContractMonth,
        strike: contract.strike ? parseFloat(contract.strike) : undefined,
        right: contract.right,
        localSymbol: contract.localSymbol,
        description: contract.longName || contract.description
      }));
    } catch (error: any) {
      this.handleHttpError(error, 'search contracts');
    }
  }

  async searchContractsAdvanced(params: AdvancedContractSearchParams): Promise<BrokerContract[]> {
    try {
      const response = await this.httpClient.post('/contract/advanced-search', {
        symbol: params.symbol,
        secType: params.securityType,
        exchange: params.exchange,
        currency: params.currency,
        expiry: params.expiry,
        strike: params.strike,
        right: params.right,
        multiplier: params.multiplier,
        includeExpired: params.includeExpired,
        name: params.searchByName
      }, {
        timeout: 30000
      });

      const results = response.data?.results || [];

      return results.map((contract: any) => ({
        symbol: contract.symbol,
        brokerSymbol: contract.symbol,
        securityType: contract.secType,
        exchange: contract.exchange,
        currency: contract.currency || 'USD',
        contractId: contract.contractId || contract.conId,
        multiplier: contract.multiplier ? parseFloat(contract.multiplier) : undefined,
        expiry: contract.expiry || contract.lastTradeDateOrContractMonth,
        strike: contract.strike ? parseFloat(contract.strike) : undefined,
        right: contract.right,
        localSymbol: contract.localSymbol,
        description: contract.longName || contract.description
      }));
    } catch (error: any) {
      this.handleHttpError(error, 'search contracts (advanced)');
    }
  }

  async getHistoricalData(params: HistoricalDataParams): Promise<HistoricalDataResponse> {
    try {
      const response = await this.httpClient.get('/market-data/history', {
        params: {
          symbol: this.toBrokerSymbol(params.symbol),
          timeframe: params.timeframe,
          period: params.period,
          start_date: params.startDate?.toISOString(),
          end_date: params.endDate?.toISOString(),
          secType: params.securityType || 'STK',
          exchange: params.exchange || 'SMART',
          currency: params.currency || 'USD',
          account_mode: this.currentAccountMode
        },
        timeout: 60000
      });

      // Handle both response formats from IB service
      const rawBars = response.data?.bars || response.data?.data || [];

      const bars: CandlestickBar[] = rawBars.map((bar: any) => ({
        timestamp: new Date((bar.timestamp || bar.time) * 1000),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseInt(bar.volume, 10) || 0
      }));

      return {
        symbol: params.symbol,
        timeframe: params.timeframe,
        bars,
        source: 'IB',
        count: bars.length,
        lastUpdated: new Date()
      };
    } catch (error: any) {
      this.handleHttpError(error, 'get historical data');
    }
  }

  async getQuote(symbol: string): Promise<BrokerQuote> {
    try {
      const response = await this.httpClient.get('/market-data/realtime', {
        params: {
          symbol: this.toBrokerSymbol(symbol),
          account_mode: this.currentAccountMode
        },
        timeout: 10000
      });

      const data = response.data;

      return {
        symbol,
        brokerType: 'IB',
        bid: data.bid ? parseFloat(data.bid) : undefined,
        ask: data.ask ? parseFloat(data.ask) : undefined,
        last: data.last ? parseFloat(data.last) : undefined,
        bidSize: data.bidSize ? parseInt(data.bidSize, 10) : undefined,
        askSize: data.askSize ? parseInt(data.askSize, 10) : undefined,
        lastSize: data.lastSize ? parseInt(data.lastSize, 10) : undefined,
        volume: data.volume ? parseInt(data.volume, 10) : undefined,
        open: data.open ? parseFloat(data.open) : undefined,
        high: data.high ? parseFloat(data.high) : undefined,
        low: data.low ? parseFloat(data.low) : undefined,
        close: data.close ? parseFloat(data.close) : undefined,
        previousClose: data.previousClose ? parseFloat(data.previousClose) : undefined,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.handleHttpError(error, 'get quote');
    }
  }

  async subscribeMarketData(symbol: string, callback: (event: any) => void): Promise<string> {
    // For IB, market data subscriptions are handled via Socket.IO in index.ts
    // This method returns a subscription ID that can be used with the WebSocket
    const subscriptionId = `IB_${symbol}_${Date.now()}`;
    
    // Register the callback
    this.quoteUpdateCallbacks.push((event) => {
      if (event.quote.symbol === symbol) {
        callback(event);
      }
    });

    return subscriptionId;
  }

  async unsubscribeMarketData(subscriptionId: string): Promise<void> {
    // Parse symbol from subscription ID
    const parts = subscriptionId.split('_');
    if (parts.length >= 2) {
      const symbol = parts[1];
      // Remove callbacks for this symbol
      this.quoteUpdateCallbacks = this.quoteUpdateCallbacks.filter(cb => {
        // This is a simplified implementation - in production you'd track callbacks by ID
        return true;
      });
    }
  }

  // ============================================================================
  // Symbol Mapping
  // ============================================================================

  /**
   * Convert canonical symbol to IB format
   * For IB, most symbols are used as-is
   */
  toBrokerSymbol(canonicalSymbol: string): string {
    // IB uses standard symbols for most instruments
    // Forex pairs in IB use format like "EUR.USD"
    if (canonicalSymbol.includes('/')) {
      return canonicalSymbol.replace('/', '.');
    }
    return canonicalSymbol;
  }

  /**
   * Convert IB symbol to canonical format
   */
  toCanonicalSymbol(brokerSymbol: string): string {
    // Convert forex back from "EUR.USD" to "EUR/USD"
    if (brokerSymbol.includes('.') && brokerSymbol.length === 7) {
      return brokerSymbol.replace('.', '/');
    }
    return brokerSymbol;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map internal order type to IB order type string
   */
  private mapOrderTypeToIB(orderType: string): string {
    const mapping: Record<string, string> = {
      'MARKET': 'MKT',
      'LIMIT': 'LMT',
      'STOP': 'STP',
      'STOP_LIMIT': 'STP LMT'
    };
    return mapping[orderType] || 'MKT';
  }

  /**
   * Map IB order type to internal order type
   */
  private mapIBOrderTypeToInternal(ibOrderType: string): string {
    const mapping: Record<string, string> = {
      'MKT': 'MARKET',
      'LMT': 'LIMIT',
      'STP': 'STOP',
      'STP LMT': 'STOP_LIMIT'
    };
    return mapping[ibOrderType] || 'MARKET';
  }

  /**
   * Map IB order status to internal status
   */
  private mapIBStatusToInternal(ibStatus: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      'PendingSubmit': 'pending',
      'PreSubmitted': 'pending',
      'Submitted': 'submitted',
      'Filled': 'filled',
      'Cancelled': 'cancelled',
      'Inactive': 'rejected',
      'ApiCancelled': 'cancelled',
      'ApiPending': 'pending'
    };
    return mapping[ibStatus] || 'pending';
  }

  /**
   * Map IB order response to BrokerOrder
   */
  private mapIBOrderToBrokerOrder(order: any): BrokerOrder {
    return {
      id: order.id || 0,
      brokerOrderId: String(order.order_id || order.orderId || order.permId),
      brokerType: 'IB',
      symbol: this.toCanonicalSymbol(order.symbol || order.contract?.symbol || ''),
      brokerSymbol: order.symbol || order.contract?.symbol || '',
      action: order.action || order.side || 'BUY',
      orderType: this.mapIBOrderTypeToInternal(order.order_type || order.orderType || 'MKT') as any,
      quantity: parseFloat(order.quantity || order.totalQuantity || 0),
      filledQuantity: parseFloat(order.filled_quantity || order.filledQuantity || 0),
      remainingQuantity: parseFloat(order.remaining_quantity || order.remaining || order.quantity || 0),
      limitPrice: order.limit_price || order.lmtPrice ? parseFloat(order.limit_price || order.lmtPrice) : undefined,
      stopPrice: order.stop_price || order.auxPrice ? parseFloat(order.stop_price || order.auxPrice) : undefined,
      averageFillPrice: order.avg_fill_price || order.avgFillPrice ? parseFloat(order.avg_fill_price || order.avgFillPrice) : undefined,
      status: this.mapIBStatusToInternal(order.status || 'Submitted'),
      statusMessage: order.status_message || order.whyHeld,
      timeInForce: order.time_in_force || order.tif || 'DAY',
      submittedAt: order.submitted_at ? new Date(order.submitted_at) : undefined,
      filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
      lastUpdated: new Date()
    };
  }

  /**
   * Set account mode
   */
  setAccountMode(mode: AccountMode): void {
    this.currentAccountMode = mode;
  }

  /**
   * Get current account mode
   */
  getAccountMode(): AccountMode {
    return this.currentAccountMode;
  }
}

// Export singleton instance with default configuration
export const ibBrokerService = new IBBrokerService();
export default ibBrokerService;
