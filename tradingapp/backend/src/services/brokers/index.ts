/**
 * Broker Services Module
 * 
 * This module provides a unified interface for interacting with different
 * trading brokers (Interactive Brokers, MetaTrader 5, cTrader, etc.)
 * 
 * Usage:
 * ```typescript
 * import { getBroker, getDefaultBroker, brokerFactory } from './services/brokers';
 * 
 * // Get the default broker (IB)
 * const broker = getDefaultBroker();
 * 
 * // Get a specific broker
 * const ibBroker = getBroker('IB');
 * 
 * // Use the broker
 * const account = await broker.getAccountSummary();
 * const positions = await broker.getPositions();
 * const quote = await broker.getQuote('AAPL');
 * ```
 */

// Re-export types
export * from '../../types/broker.js';

// Re-export interfaces and base class
export {
  IBrokerService,
  BaseBrokerService,
  type OrderStatusCallback,
  type PositionUpdateCallback,
  type QuoteUpdateCallback
} from './IBrokerService.js';

// Re-export IB implementation
export { IBBrokerService, ibBrokerService } from './IBBroker.js';

// Re-export factory
export {
  brokerFactory,
  getBroker,
  getDefaultBroker
} from './BrokerFactory.js';

// Default export is the broker factory
export { brokerFactory as default } from './BrokerFactory.js';
