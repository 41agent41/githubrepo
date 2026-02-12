/**
 * Broker Service Interface
 * 
 * Abstract interface that all broker implementations must adhere to.
 * This provides a unified API for interacting with different brokers
 * (Interactive Brokers, MetaTrader 5, cTrader, etc.)
 */

import {
  BrokerType,
  BrokerAccountSummary,
  BrokerPosition,
  BrokerOrder,
  BrokerOrderRequest,
  BrokerQuote,
  BrokerContract,
  CandlestickBar,
  ContractSearchParams,
  AdvancedContractSearchParams,
  HistoricalDataParams,
  HistoricalDataResponse,
  BrokerConnectionConfig,
  BrokerConnectionStatusResponse,
  OrderStatusEvent,
  PositionUpdateEvent,
  QuoteUpdateEvent
} from '../../types/broker.js';

/**
 * Event callback types for real-time updates
 */
export type OrderStatusCallback = (event: OrderStatusEvent) => void;
export type PositionUpdateCallback = (event: PositionUpdateEvent) => void;
export type QuoteUpdateCallback = (event: QuoteUpdateEvent) => void;

/**
 * Broker Service Interface
 * 
 * All broker implementations must implement this interface to ensure
 * consistent behavior across different brokers.
 */
export interface IBrokerService {
  // ============================================================================
  // Identity & Configuration
  // ============================================================================
  
  /**
   * Get the broker type identifier
   */
  readonly brokerType: BrokerType;
  
  /**
   * Get the service URL for this broker
   */
  getServiceUrl(): string;

  // ============================================================================
  // Connection Management
  // ============================================================================
  
  /**
   * Connect to the broker
   * @param config Connection configuration
   */
  connect(config: BrokerConnectionConfig): Promise<BrokerConnectionStatusResponse>;
  
  /**
   * Disconnect from the broker
   */
  disconnect(): Promise<void>;
  
  /**
   * Get current connection status
   */
  getConnectionStatus(): Promise<BrokerConnectionStatusResponse>;
  
  /**
   * Test connection without establishing persistent connection
   * @param config Connection configuration to test
   */
  testConnection(config: BrokerConnectionConfig): Promise<{ success: boolean; message: string; details?: any }>;
  
  /**
   * Check if broker service is healthy
   */
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;

  // ============================================================================
  // Account Operations
  // ============================================================================
  
  /**
   * Get account summary
   */
  getAccountSummary(): Promise<BrokerAccountSummary>;
  
  /**
   * Get all positions
   */
  getPositions(): Promise<BrokerPosition[]>;
  
  /**
   * Get all open orders
   */
  getOrders(): Promise<BrokerOrder[]>;
  
  /**
   * Get complete account data (summary, positions, orders)
   */
  getAccountData(): Promise<{
    account: BrokerAccountSummary;
    positions: BrokerPosition[];
    orders: BrokerOrder[];
  }>;

  // ============================================================================
  // Order Operations
  // ============================================================================
  
  /**
   * Place a new order
   * @param order Order request details
   */
  placeOrder(order: BrokerOrderRequest): Promise<BrokerOrder>;
  
  /**
   * Cancel an existing order
   * @param orderId Broker order ID
   */
  cancelOrder(orderId: string): Promise<boolean>;
  
  /**
   * Modify an existing order
   * @param orderId Broker order ID
   * @param modifications Order modifications
   */
  modifyOrder?(orderId: string, modifications: Partial<BrokerOrderRequest>): Promise<BrokerOrder>;
  
  /**
   * Get order status
   * @param orderId Broker order ID
   */
  getOrderStatus(orderId: string): Promise<BrokerOrder | null>;

  // ============================================================================
  // Market Data Operations
  // ============================================================================
  
  /**
   * Search for contracts/instruments
   * @param params Search parameters
   */
  searchContracts(params: ContractSearchParams): Promise<BrokerContract[]>;
  
  /**
   * Advanced contract search (options, futures, etc.)
   * @param params Advanced search parameters
   */
  searchContractsAdvanced?(params: AdvancedContractSearchParams): Promise<BrokerContract[]>;
  
  /**
   * Get historical candlestick data
   * @param params Historical data request parameters
   */
  getHistoricalData(params: HistoricalDataParams): Promise<HistoricalDataResponse>;
  
  /**
   * Get real-time quote for a symbol
   * @param symbol Symbol to get quote for
   */
  getQuote(symbol: string): Promise<BrokerQuote>;
  
  /**
   * Subscribe to real-time market data
   * @param symbol Symbol to subscribe to
   * @param callback Callback for quote updates
   */
  subscribeMarketData?(symbol: string, callback: QuoteUpdateCallback): Promise<string>; // Returns subscription ID
  
  /**
   * Unsubscribe from real-time market data
   * @param subscriptionId Subscription ID to cancel
   */
  unsubscribeMarketData?(subscriptionId: string): Promise<void>;

  // ============================================================================
  // Symbol Mapping
  // ============================================================================
  
  /**
   * Convert canonical symbol to broker-specific format
   * @param canonicalSymbol Internal unified symbol
   */
  toBrokerSymbol(canonicalSymbol: string): string;
  
  /**
   * Convert broker-specific symbol to canonical format
   * @param brokerSymbol Broker-specific symbol
   */
  toCanonicalSymbol(brokerSymbol: string): string;

  // ============================================================================
  // Event Subscriptions (Optional - for real-time updates)
  // ============================================================================
  
  /**
   * Subscribe to order status updates
   * @param callback Callback for order status events
   */
  onOrderStatusUpdate?(callback: OrderStatusCallback): void;
  
  /**
   * Subscribe to position updates
   * @param callback Callback for position update events
   */
  onPositionUpdate?(callback: PositionUpdateCallback): void;
  
  /**
   * Remove event listener
   * @param event Event type
   * @param callback Callback to remove
   */
  removeListener?(event: 'orderStatus' | 'position' | 'quote', callback: Function): void;
}

/**
 * Abstract base class for broker implementations
 * 
 * Provides common functionality that can be shared across broker implementations.
 */
export abstract class BaseBrokerService implements IBrokerService {
  abstract readonly brokerType: BrokerType;
  
  protected serviceUrl: string;
  protected orderStatusCallbacks: OrderStatusCallback[] = [];
  protected positionUpdateCallbacks: PositionUpdateCallback[] = [];
  protected quoteUpdateCallbacks: QuoteUpdateCallback[] = [];

  constructor(serviceUrl: string) {
    this.serviceUrl = serviceUrl;
  }

  getServiceUrl(): string {
    return this.serviceUrl;
  }

  // Abstract methods that must be implemented by each broker
  abstract connect(config: BrokerConnectionConfig): Promise<BrokerConnectionStatusResponse>;
  abstract disconnect(): Promise<void>;
  abstract getConnectionStatus(): Promise<BrokerConnectionStatusResponse>;
  abstract testConnection(config: BrokerConnectionConfig): Promise<{ success: boolean; message: string; details?: any }>;
  abstract healthCheck(): Promise<{ healthy: boolean; details?: any }>;
  
  abstract getAccountSummary(): Promise<BrokerAccountSummary>;
  abstract getPositions(): Promise<BrokerPosition[]>;
  abstract getOrders(): Promise<BrokerOrder[]>;
  
  abstract placeOrder(order: BrokerOrderRequest): Promise<BrokerOrder>;
  abstract cancelOrder(orderId: string): Promise<boolean>;
  abstract getOrderStatus(orderId: string): Promise<BrokerOrder | null>;
  
  abstract searchContracts(params: ContractSearchParams): Promise<BrokerContract[]>;
  abstract getHistoricalData(params: HistoricalDataParams): Promise<HistoricalDataResponse>;
  abstract getQuote(symbol: string): Promise<BrokerQuote>;
  
  abstract toBrokerSymbol(canonicalSymbol: string): string;
  abstract toCanonicalSymbol(brokerSymbol: string): string;

  /**
   * Default implementation for getting all account data
   */
  async getAccountData(): Promise<{
    account: BrokerAccountSummary;
    positions: BrokerPosition[];
    orders: BrokerOrder[];
  }> {
    const [account, positions, orders] = await Promise.all([
      this.getAccountSummary(),
      this.getPositions(),
      this.getOrders()
    ]);

    return { account, positions, orders };
  }

  /**
   * Subscribe to order status updates
   */
  onOrderStatusUpdate(callback: OrderStatusCallback): void {
    this.orderStatusCallbacks.push(callback);
  }

  /**
   * Subscribe to position updates
   */
  onPositionUpdate(callback: PositionUpdateCallback): void {
    this.positionUpdateCallbacks.push(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(event: 'orderStatus' | 'position' | 'quote', callback: Function): void {
    switch (event) {
      case 'orderStatus':
        this.orderStatusCallbacks = this.orderStatusCallbacks.filter(cb => cb !== callback);
        break;
      case 'position':
        this.positionUpdateCallbacks = this.positionUpdateCallbacks.filter(cb => cb !== callback);
        break;
      case 'quote':
        this.quoteUpdateCallbacks = this.quoteUpdateCallbacks.filter(cb => cb !== callback);
        break;
    }
  }

  /**
   * Emit order status event to all subscribers
   */
  protected emitOrderStatus(event: OrderStatusEvent): void {
    this.orderStatusCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in order status callback:`, error);
      }
    });
  }

  /**
   * Emit position update event to all subscribers
   */
  protected emitPositionUpdate(event: PositionUpdateEvent): void {
    this.positionUpdateCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in position update callback:`, error);
      }
    });
  }

  /**
   * Emit quote update event to all subscribers
   */
  protected emitQuoteUpdate(event: QuoteUpdateEvent): void {
    this.quoteUpdateCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in quote update callback:`, error);
      }
    });
  }

  /**
   * Helper method to handle common HTTP errors
   */
  protected handleHttpError(error: any, operation: string): never {
    let errorMessage = 'Unknown error';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = `${this.brokerType} Service connection refused - service may be starting up`;
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = `${this.brokerType} Service timeout - service may be busy`;
    } else if (error.response) {
      errorMessage = error.response.data?.detail || error.response.data?.error || error.response.statusText || 'Service error';
    } else {
      errorMessage = error.message || `Failed to ${operation}`;
    }

    throw new Error(`[${this.brokerType}] ${errorMessage}`);
  }
}
