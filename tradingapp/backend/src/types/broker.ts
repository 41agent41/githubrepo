/**
 * Broker Abstraction Types
 * 
 * Common types and interfaces for multi-broker support.
 * These types provide a unified interface regardless of the underlying broker
 * (Interactive Brokers, MetaTrader 5, cTrader, etc.)
 */

// ============================================================================
// Broker Types
// ============================================================================

/**
 * Supported broker types
 */
export type BrokerType = 'IB' | 'MT5' | 'CTRADER';

/**
 * Broker connection status
 */
export type BrokerConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * Account modes
 */
export type AccountMode = 'live' | 'paper' | 'demo';

// ============================================================================
// Account Types
// ============================================================================

/**
 * Unified account summary across all brokers
 */
export interface BrokerAccountSummary {
  accountId: string;
  brokerType: BrokerType;
  accountMode: AccountMode;
  currency: string;
  
  // Core balance fields
  netLiquidation: number;
  totalCashValue?: number;
  buyingPower?: number;
  
  // Margin fields
  availableFunds?: number;
  excessLiquidity?: number;
  maintenanceMargin?: number;
  initialMargin?: number;
  
  // P&L fields
  unrealizedPnL?: number;
  realizedPnL?: number;
  
  lastUpdated: Date;
}

/**
 * Unified position across all brokers
 */
export interface BrokerPosition {
  symbol: string;
  brokerType: BrokerType;
  brokerSymbol: string; // Original symbol format from broker
  
  position: number; // Positive = long, negative = short
  averageCost: number;
  
  // Current market data
  marketPrice?: number;
  marketValue?: number;
  
  // P&L
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  realizedPnL?: number;
  
  // Contract details
  securityType?: string;
  exchange?: string;
  currency: string;
  
  lastUpdated: Date;
}

// ============================================================================
// Order Types
// ============================================================================

/**
 * Order types supported across brokers
 */
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

/**
 * Order actions
 */
export type OrderAction = 'BUY' | 'SELL';

/**
 * Order status
 */
export type OrderStatus = 
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

/**
 * Time in force options
 */
export type TimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK' | 'GTD';

/**
 * Order request (for placing new orders)
 */
export interface BrokerOrderRequest {
  symbol: string;
  action: OrderAction;
  quantity: number;
  orderType: OrderType;
  
  // Price fields
  limitPrice?: number;
  stopPrice?: number;
  
  // Time and expiry
  timeInForce?: TimeInForce;
  goodTillDate?: Date;
  
  // Metadata
  clientOrderId?: string;
  setupId?: number;
  signalId?: number;
}

/**
 * Unified order across all brokers
 */
export interface BrokerOrder {
  id: number; // Internal order ID
  brokerOrderId: string; // Broker's order ID
  brokerType: BrokerType;
  
  symbol: string;
  brokerSymbol: string;
  action: OrderAction;
  orderType: OrderType;
  
  // Quantities
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  
  // Prices
  limitPrice?: number;
  stopPrice?: number;
  averageFillPrice?: number;
  
  // Status
  status: OrderStatus;
  statusMessage?: string;
  
  // Time fields
  timeInForce: TimeInForce;
  submittedAt?: Date;
  filledAt?: Date;
  cancelledAt?: Date;
  
  // Metadata
  clientOrderId?: string;
  setupId?: number;
  signalId?: number;
  
  lastUpdated: Date;
}

// ============================================================================
// Market Data Types
// ============================================================================

/**
 * Security types
 */
export type SecurityType = 'STK' | 'OPT' | 'FUT' | 'CASH' | 'CFD' | 'CRYPTO' | 'BOND' | 'INDEX';

/**
 * Timeframe for candlestick data
 */
export type Timeframe = '1min' | '5min' | '15min' | '30min' | '1hour' | '4hour' | '8hour' | '1day' | '1week' | '1month';

/**
 * Contract/instrument definition
 */
export interface BrokerContract {
  symbol: string;
  brokerSymbol?: string; // Broker-specific symbol format
  securityType: SecurityType;
  exchange?: string;
  currency: string;
  
  // Optional contract details
  contractId?: number;
  multiplier?: number;
  expiry?: string;
  strike?: number;
  right?: 'CALL' | 'PUT';
  localSymbol?: string;
  description?: string;
}

/**
 * Search parameters for finding contracts
 */
export interface ContractSearchParams {
  symbol: string;
  securityType: SecurityType;
  exchange?: string;
  currency?: string;
  searchByName?: boolean;
}

/**
 * Advanced search parameters
 */
export interface AdvancedContractSearchParams extends ContractSearchParams {
  expiry?: string;
  strike?: number;
  right?: 'CALL' | 'PUT';
  multiplier?: string;
  includeExpired?: boolean;
}

/**
 * Candlestick/OHLCV bar
 */
export interface CandlestickBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Real-time quote
 */
export interface BrokerQuote {
  symbol: string;
  brokerType: BrokerType;
  
  // Prices
  bid?: number;
  ask?: number;
  last?: number;
  
  // Sizes
  bidSize?: number;
  askSize?: number;
  lastSize?: number;
  
  // Volume
  volume?: number;
  
  // Daily stats
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  previousClose?: number;
  
  timestamp: Date;
}

/**
 * Historical data request parameters
 */
export interface HistoricalDataParams {
  symbol: string;
  timeframe: Timeframe;
  startDate?: Date;
  endDate?: Date;
  period?: string; // e.g., '1D', '1W', '1M', '1Y'
  securityType?: SecurityType;
  exchange?: string;
  currency?: string;
}

/**
 * Historical data response
 */
export interface HistoricalDataResponse {
  symbol: string;
  timeframe: Timeframe;
  bars: CandlestickBar[];
  source: string;
  count: number;
  lastUpdated: Date;
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Broker connection configuration
 */
export interface BrokerConnectionConfig {
  brokerType: BrokerType;
  name: string;
  description?: string;
  accountMode: AccountMode;
  
  // Connection settings
  host?: string;
  port?: number;
  clientId?: number;
  
  // Timeouts
  timeoutSeconds?: number;
  
  // Reconnection settings
  autoReconnect?: boolean;
  maxRetryAttempts?: number;
  keepAliveIntervalMinutes?: number;
  
  // Broker-specific settings
  settings?: Record<string, any>;
}

/**
 * Connection status response
 */
export interface BrokerConnectionStatusResponse {
  brokerType: BrokerType;
  connected: boolean;
  accountMode?: AccountMode;
  lastError?: string;
  lastConnected?: Date;
  details?: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Broker-specific error
 */
export class BrokerError extends Error {
  constructor(
    message: string,
    public brokerType: BrokerType,
    public code?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'BrokerError';
  }
}

/**
 * Connection error
 */
export class BrokerConnectionError extends BrokerError {
  constructor(
    message: string,
    brokerType: BrokerType,
    code?: string,
    originalError?: Error
  ) {
    super(message, brokerType, code, originalError);
    this.name = 'BrokerConnectionError';
  }
}

/**
 * Order error
 */
export class BrokerOrderError extends BrokerError {
  constructor(
    message: string,
    brokerType: BrokerType,
    public orderId?: string,
    code?: string,
    originalError?: Error
  ) {
    super(message, brokerType, code, originalError);
    this.name = 'BrokerOrderError';
  }
}

// ============================================================================
// Symbol Mapping Types
// ============================================================================

/**
 * Symbol mapping between canonical and broker-specific formats
 */
export interface SymbolMapping {
  canonical: string; // Internal unified symbol
  brokerSymbols: {
    [K in BrokerType]?: string;
  };
  securityType: SecurityType;
  exchange?: string;
  currency?: string;
}

// ============================================================================
// Event Types (for real-time updates)
// ============================================================================

/**
 * Order status update event
 */
export interface OrderStatusEvent {
  brokerType: BrokerType;
  order: BrokerOrder;
  previousStatus?: OrderStatus;
}

/**
 * Position update event
 */
export interface PositionUpdateEvent {
  brokerType: BrokerType;
  position: BrokerPosition;
  changeType: 'opened' | 'updated' | 'closed';
}

/**
 * Quote update event
 */
export interface QuoteUpdateEvent {
  brokerType: BrokerType;
  quote: BrokerQuote;
}
