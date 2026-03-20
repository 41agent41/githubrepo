/**
 * cTrader Broker Service Implementation
 *
 * Implements the IBrokerService interface for cTrader.
 * This adapter wraps calls to the cTrader service (Python FastAPI).
 */

import axios, { AxiosInstance } from 'axios';
import { BaseBrokerService } from './IBrokerService.js';
import { brokerConnectionResolver } from '../brokerConnectionResolver.js';
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
  BrokerConnectionError,
  BrokerOrderError
} from '../../types/broker.js';
import { getBrokerServiceUrl } from '../../config/runtimeConfig.js';
import {
  toBrokerSymbol as configToBrokerSymbol,
  toCanonicalSymbol as configToCanonicalSymbol
} from '../../config/ctraderSymbolMap.js';

/**
 * cTrader-specific configuration (OAuth tokens, etc.)
 */
interface CTraderConnectionConfig extends BrokerConnectionConfig {
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  redirectUri?: string;
}

/**
 * cTrader broker service implementation
 */
export class CTraderBrokerService extends BaseBrokerService {
  readonly brokerType: BrokerType = 'CTRADER';

  private httpClient: AxiosInstance;
  private currentAccountMode: AccountMode = 'paper';

  constructor(serviceUrl?: string) {
    const url = serviceUrl || getBrokerServiceUrl('CTRADER');
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

  async connect(config: BrokerConnectionConfig): Promise<BrokerConnectionStatusResponse> {
    try {
      const ctraderConfig = config as CTraderConnectionConfig;
      const response = await this.httpClient.post('/connection/connect', {
        client_id: ctraderConfig.clientId != null ? String(ctraderConfig.clientId) : undefined,
        client_secret: ctraderConfig.clientSecret,
        redirect_uri: ctraderConfig.redirectUri,
        auth_code: (ctraderConfig as any).authCode,
        account_mode: ctraderConfig.accountMode || 'paper'
      }, {
        timeout: 15000
      });

      this.currentAccountMode = (ctraderConfig.accountMode || 'paper') as AccountMode;

      return {
        brokerType: 'CTRADER',
        connected: response.data?.success || false,
        accountMode: this.currentAccountMode,
        details: response.data
      };
    } catch (error: any) {
      throw new BrokerConnectionError(
        error.response?.data?.detail || error.message || 'Failed to connect to cTrader',
        'CTRADER',
        error.code,
        error
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.httpClient.post('/connection/disconnect', {}, { timeout: 10000 });
    } catch (error: any) {
      throw new BrokerConnectionError(
        error.message || 'Failed to disconnect from cTrader',
        'CTRADER',
        error.code,
        error
      );
    }
  }

  async getConnectionStatus(): Promise<BrokerConnectionStatusResponse> {
    try {
      const response = await this.httpClient.get('/health', { timeout: 5000 });
      const ctrader = response.data?.connection?.ctrader || {};

      return {
        brokerType: 'CTRADER',
        connected: ctrader.connected || false,
        accountMode: (ctrader.account_mode || this.currentAccountMode) as AccountMode,
        lastError: ctrader.last_error,
        details: ctrader
      };
    } catch (error: any) {
      return {
        brokerType: 'CTRADER',
        connected: false,
        lastError: error.message
      };
    }
  }

  async testConnection(config: BrokerConnectionConfig): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.httpClient.get('/health', { timeout: 5000 });
      return {
        success: response.status === 200,
        message: 'cTrader service reachable',
        details: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'cTrader service unreachable',
        details: { error: error.message }
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const response = await this.httpClient.get('/health', { timeout: 5000 });
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

  private async getCredentialHeaders(): Promise<Record<string, string>> {
    const connection = await brokerConnectionResolver.getActiveConnection('CTRADER');
    if (!connection?.config?.settings?.accessToken) {
      throw new BrokerConnectionError(
        'No cTrader connection configured. Add a profile and complete OAuth.',
        'CTRADER',
        'NO_CONNECTION'
      );
    }
    const s = connection.config.settings as Record<string, unknown>;
    const headers: Record<string, string> = {
      'X-Access-Token': String(s.accessToken),
      'X-Client-Id': String(s.clientId ?? connection.config.clientId),
      'X-Client-Secret': String(s.clientSecret ?? connection.config.clientSecret),
      'X-Account-Mode': (connection.config.accountMode ?? this.currentAccountMode) as string
    };
    if (s.ctraderAccountId != null) {
      headers['X-Ctid-Trader-Account-Id'] = String(s.ctraderAccountId);
    }
    return headers;
  }

  async getAccountSummary(): Promise<BrokerAccountSummary> {
    try {
      const headers = await this.getCredentialHeaders();
      const response = await this.httpClient.get('/account/summary', {
        headers,
        timeout: 30000
      });
      const data = response.data;

      return {
        accountId: data.account_id || data.accountId || 'ctrader-stub',
        brokerType: 'CTRADER',
        accountMode: this.currentAccountMode,
        currency: data.currency || 'USD',
        netLiquidation: parseFloat(data.net_liquidation ?? data.NetLiquidation ?? 0),
        totalCashValue: parseFloat(data.total_cash_value ?? data.TotalCashValue ?? 0),
        buyingPower: parseFloat(data.buying_power ?? data.BuyingPower ?? 0),
        availableFunds: parseFloat(data.available_funds ?? data.AvailableFunds ?? 0),
        excessLiquidity: parseFloat(data.excess_liquidity ?? data.ExcessLiquidity ?? 0),
        maintenanceMargin: parseFloat(data.maintenance_margin ?? data.MaintMarginReq ?? 0),
        initialMargin: parseFloat(data.initial_margin ?? data.InitMarginReq ?? 0),
        unrealizedPnL: parseFloat(data.unrealized_pnl ?? data.UnrealizedPnL ?? 0),
        realizedPnL: parseFloat(data.realized_pnl ?? data.RealizedPnL ?? 0),
        lastUpdated: new Date()
      };
    } catch (error: any) {
      this.handleHttpError(error, 'get account summary');
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    try {
      const headers = await this.getCredentialHeaders();
      const response = await this.httpClient.get('/account/positions', {
        headers,
        timeout: 30000
      });
      const positions = Array.isArray(response.data) ? response.data : response.data?.positions || [];

      return positions.map((pos: any) => ({
        symbol: this.toCanonicalSymbol(pos.symbol || pos.contract?.symbol || ''),
        brokerType: 'CTRADER' as BrokerType,
        brokerSymbol: pos.symbol || pos.contract?.symbol || '',
        position: parseFloat(pos.position ?? pos.pos ?? 0),
        averageCost: parseFloat(pos.average_cost ?? pos.avgCost ?? 0),
        marketPrice: pos.market_price != null ? parseFloat(pos.market_price) : undefined,
        marketValue: pos.market_value != null ? parseFloat(pos.market_value) : undefined,
        unrealizedPnL: pos.unrealized_pnl != null ? parseFloat(pos.unrealized_pnl) : undefined,
        realizedPnL: pos.realized_pnl != null ? parseFloat(pos.realized_pnl) : undefined,
        securityType: pos.sec_type ?? pos.secType ?? 'CASH',
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
      const headers = await this.getCredentialHeaders();
      const response = await this.httpClient.get('/account/orders', {
        headers,
        timeout: 30000
      });
      const orders = Array.isArray(response.data) ? response.data : response.data?.orders || [];

      return orders.map((order: any) => this.mapCTraderOrderToBrokerOrder(order));
    } catch (error: any) {
      this.handleHttpError(error, 'get orders');
    }
  }

  // ============================================================================
  // Order Operations
  // ============================================================================

  async placeOrder(orderRequest: BrokerOrderRequest): Promise<BrokerOrder> {
    try {
      const headers = await this.getCredentialHeaders();
      const ctraderOrderType = this.mapOrderTypeToCTrader(orderRequest.orderType);

      const response = await this.httpClient.post('/orders/place', {
        symbol: this.toBrokerSymbol(orderRequest.symbol),
        action: orderRequest.action,
        quantity: orderRequest.quantity,
        order_type: ctraderOrderType,
        limit_price: orderRequest.orderType === 'LIMIT' || orderRequest.orderType === 'STOP_LIMIT'
          ? orderRequest.limitPrice
          : undefined,
        stop_price: orderRequest.orderType === 'STOP' || orderRequest.orderType === 'STOP_LIMIT'
          ? orderRequest.stopPrice
          : undefined,
        time_in_force: orderRequest.timeInForce || 'GTC'
      }, {
        headers,
        timeout: 30000
      });

      const data = response.data;

      return {
        id: 0,
        brokerOrderId: String(data.order_id ?? data.orderId ?? 0),
        brokerType: 'CTRADER',
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
        timeInForce: orderRequest.timeInForce || 'GTC',
        submittedAt: new Date(),
        clientOrderId: orderRequest.clientOrderId,
        setupId: orderRequest.setupId,
        signalId: orderRequest.signalId,
        lastUpdated: new Date()
      };
    } catch (error: any) {
      throw new BrokerOrderError(
        error.response?.data?.detail || error.message || 'Failed to place order',
        'CTRADER',
        undefined,
        error.code,
        error
      );
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const headers = await this.getCredentialHeaders();
      await this.httpClient.post('/orders/cancel', {
        order_id: parseInt(orderId, 10)
      }, {
        headers,
        timeout: 10000
      });
      return true;
    } catch (error: any) {
      throw new BrokerOrderError(
        error.response?.data?.detail || error.message || 'Failed to cancel order',
        'CTRADER',
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
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Market Data Operations
  // ============================================================================

  async searchContracts(params: ContractSearchParams): Promise<BrokerContract[]> {
    try {
      const headers = await this.getCredentialHeaders();
      const response = await this.httpClient.post('/contract/search', {
        symbol: params.symbol,
        secType: params.securityType,
        exchange: params.exchange,
        currency: params.currency,
        name: params.searchByName
      }, {
        headers,
        timeout: 30000
      });

      const results = response.data?.results || [];

      return results.map((contract: any) => ({
        symbol: this.toCanonicalSymbol(contract.symbol ?? contract.symbolId),
        brokerSymbol: contract.symbol,
        securityType: contract.secType ?? 'CASH',
        exchange: contract.exchange,
        currency: contract.currency || 'USD',
        contractId: contract.contractId ?? contract.symbolId,
        multiplier: contract.multiplier ? parseFloat(contract.multiplier) : undefined,
        expiry: contract.expiry,
        strike: contract.strike ? parseFloat(contract.strike) : undefined,
        right: contract.right,
        localSymbol: contract.localSymbol,
        description: contract.longName ?? contract.description
      }));
    } catch (error: any) {
      this.handleHttpError(error, 'search contracts');
    }
  }

  async searchContractsAdvanced(params: AdvancedContractSearchParams): Promise<BrokerContract[]> {
    try {
      const headers = await this.getCredentialHeaders();
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
        headers,
        timeout: 30000
      });

      const results = response.data?.results || [];

      return results.map((contract: any) => ({
        symbol: this.toCanonicalSymbol(contract.symbol ?? contract.symbolId),
        brokerSymbol: contract.symbol,
        securityType: contract.secType ?? 'CASH',
        exchange: contract.exchange,
        currency: contract.currency || 'USD',
        contractId: contract.contractId ?? contract.symbolId,
        multiplier: contract.multiplier ? parseFloat(contract.multiplier) : undefined,
        expiry: contract.expiry,
        strike: contract.strike ? parseFloat(contract.strike) : undefined,
        right: contract.right,
        localSymbol: contract.localSymbol,
        description: contract.longName ?? contract.description
      }));
    } catch (error: any) {
      this.handleHttpError(error, 'search contracts (advanced)');
    }
  }

  async getHistoricalData(params: HistoricalDataParams): Promise<HistoricalDataResponse> {
    try {
      const headers = await this.getCredentialHeaders();
      const response = await this.httpClient.get('/market-data/history', {
        headers,
        params: {
          symbol: this.toBrokerSymbol(params.symbol),
          timeframe: params.timeframe,
          period: params.period,
          start_date: params.startDate?.toISOString(),
          end_date: params.endDate?.toISOString(),
          secType: params.securityType || 'CASH',
          exchange: params.exchange,
          currency: params.currency || 'USD',
          account_mode: this.currentAccountMode
        },
        timeout: 60000
      });

      const rawBars = response.data?.bars ?? response.data?.data ?? [];
      const bars: CandlestickBar[] = rawBars.map((bar: any) => ({
        timestamp: new Date(bar.timestamp && bar.timestamp > 1e12 ? bar.timestamp : (bar.timestamp || bar.time || 0) * 1000),
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
        source: 'CTRADER',
        count: bars.length,
        lastUpdated: new Date()
      };
    } catch (error: any) {
      this.handleHttpError(error, 'get historical data');
    }
  }

  async getQuote(symbol: string): Promise<BrokerQuote> {
    try {
      const headers = await this.getCredentialHeaders();
      const response = await this.httpClient.get('/market-data/realtime', {
        headers,
        params: {
          symbol: this.toBrokerSymbol(symbol),
          account_mode: this.currentAccountMode
        },
        timeout: 15000
      });

      const data = response.data;

      return {
        symbol,
        brokerType: 'CTRADER',
        bid: data.bid != null ? parseFloat(data.bid) : undefined,
        ask: data.ask != null ? parseFloat(data.ask) : undefined,
        last: data.last != null ? parseFloat(data.last) : undefined,
        bidSize: data.bidSize != null ? parseInt(data.bidSize, 10) : undefined,
        askSize: data.askSize != null ? parseInt(data.askSize, 10) : undefined,
        lastSize: data.lastSize != null ? parseInt(data.lastSize, 10) : undefined,
        volume: data.volume != null ? parseInt(data.volume, 10) : undefined,
        open: data.open != null ? parseFloat(data.open) : undefined,
        high: data.high != null ? parseFloat(data.high) : undefined,
        low: data.low != null ? parseFloat(data.low) : undefined,
        close: data.close != null ? parseFloat(data.close) : undefined,
        previousClose: data.previousClose != null ? parseFloat(data.previousClose) : undefined,
        timestamp: new Date()
      };
    } catch (error: any) {
      this.handleHttpError(error, 'get quote');
    }
  }

  // ============================================================================
  // Symbol Mapping (C10: config + fallbacks for forex, CFDs, indices)
  // ============================================================================

  toBrokerSymbol(canonicalSymbol: string): string {
    return configToBrokerSymbol(canonicalSymbol);
  }

  toCanonicalSymbol(brokerSymbol: string): string {
    return configToCanonicalSymbol(brokerSymbol);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapOrderTypeToCTrader(orderType: string): string {
    const mapping: Record<string, string> = {
      'MARKET': 'MARKET',
      'LIMIT': 'LIMIT',
      'STOP': 'STOP',
      'STOP_LIMIT': 'STOP_LIMIT'
    };
    return mapping[orderType] || 'MARKET';
  }

  private mapCTraderOrderTypeToInternal(ctraderOrderType: string): string {
    const mapping: Record<string, string> = {
      'Market': 'MARKET',
      'Limit': 'LIMIT',
      'Stop': 'STOP',
      'Stop limit': 'STOP_LIMIT'
    };
    return mapping[ctraderOrderType] || 'MARKET';
  }

  private mapCTraderStatusToInternal(status: string): OrderStatus {
    const mapping: Record<string, OrderStatus> = {
      'Pending': 'pending',
      'Accepted': 'submitted',
      'Filled': 'filled',
      'Cancelled': 'cancelled',
      'Rejected': 'rejected',
      'Expired': 'expired',
      'PartiallyFilled': 'partially_filled'
    };
    return mapping[status] || 'pending';
  }

  private mapCTraderOrderToBrokerOrder(order: any): BrokerOrder {
    return {
      id: order.id || 0,
      brokerOrderId: String(order.order_id ?? order.orderId ?? order.id),
      brokerType: 'CTRADER',
      symbol: this.toCanonicalSymbol(order.symbol || order.contract?.symbol || ''),
      brokerSymbol: order.symbol || order.contract?.symbol || '',
      action: (order.action || order.side || 'BUY') as 'BUY' | 'SELL',
      orderType: this.mapCTraderOrderTypeToInternal(order.order_type || order.orderType || 'Market') as any,
      quantity: parseFloat(order.quantity ?? order.totalQuantity ?? 0),
      filledQuantity: parseFloat(order.filled_quantity ?? order.filledQuantity ?? 0),
      remainingQuantity: parseFloat(order.remaining_quantity ?? order.remaining ?? order.quantity ?? 0),
      limitPrice: (order.limit_price ?? order.lmtPrice) != null ? parseFloat(order.limit_price ?? order.lmtPrice) : undefined,
      stopPrice: (order.stop_price ?? order.auxPrice) != null ? parseFloat(order.stop_price ?? order.auxPrice) : undefined,
      averageFillPrice: (order.avg_fill_price ?? order.avgFillPrice) != null ? parseFloat(order.avg_fill_price ?? order.avgFillPrice) : undefined,
      status: this.mapCTraderStatusToInternal(order.status || 'Pending'),
      statusMessage: order.status_message,
      timeInForce: order.time_in_force ?? order.tif ?? 'GTC',
      submittedAt: order.submitted_at ? new Date(order.submitted_at) : undefined,
      filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
      lastUpdated: new Date()
    };
  }

  setAccountMode(mode: AccountMode): void {
    this.currentAccountMode = mode;
  }

  getAccountMode(): AccountMode {
    return this.currentAccountMode;
  }
}
