/**
 * Broker Factory
 * 
 * Factory for creating and managing broker service instances.
 * Provides a centralized way to get the appropriate broker implementation
 * based on broker type.
 */

import { IBrokerService } from './IBrokerService.js';
import { IBBrokerService } from './IBBroker.js';
import { BrokerType, BrokerError } from '../../types/broker.js';

/**
 * Broker configuration options
 */
interface BrokerConfig {
  serviceUrl?: string;
}

/**
 * Broker Factory
 * 
 * Creates and manages broker service instances. Supports singleton pattern
 * for reusing broker connections, or creating new instances as needed.
 */
class BrokerFactory {
  private instances: Map<BrokerType, IBrokerService> = new Map();
  private configs: Map<BrokerType, BrokerConfig> = new Map();

  constructor() {
    // Initialize with default configurations from environment
    this.configs.set('IB', {
      serviceUrl: process.env.IB_SERVICE_URL || 'http://ib_service:8000'
    });
    
    // MT5 and cTrader configs will be added when those brokers are implemented
    this.configs.set('MT5', {
      serviceUrl: process.env.MT5_SERVICE_URL || 'http://mt5_service:8001'
    });
    
    this.configs.set('CTRADER', {
      serviceUrl: process.env.CTRADER_SERVICE_URL || 'http://ctrader_service:8002'
    });
  }

  /**
   * Get a broker service instance
   * 
   * @param brokerType The type of broker to get
   * @param forceNew If true, creates a new instance even if one exists
   * @returns The broker service instance
   */
  getBroker(brokerType: BrokerType, forceNew: boolean = false): IBrokerService {
    // Return existing instance if available and not forcing new
    if (!forceNew && this.instances.has(brokerType)) {
      return this.instances.get(brokerType)!;
    }

    // Create new instance
    const broker = this.createBroker(brokerType);
    
    // Cache the instance
    if (!forceNew) {
      this.instances.set(brokerType, broker);
    }

    return broker;
  }

  /**
   * Create a new broker service instance
   * 
   * @param brokerType The type of broker to create
   * @returns The new broker service instance
   */
  private createBroker(brokerType: BrokerType): IBrokerService {
    const config = this.configs.get(brokerType);

    switch (brokerType) {
      case 'IB':
        return new IBBrokerService(config?.serviceUrl);

      case 'MT5':
        // MT5 implementation will be added later
        throw new BrokerError(
          'MetaTrader 5 broker is not yet implemented',
          'MT5',
          'NOT_IMPLEMENTED'
        );

      case 'CTRADER':
        // cTrader implementation will be added later
        throw new BrokerError(
          'cTrader broker is not yet implemented',
          'CTRADER',
          'NOT_IMPLEMENTED'
        );

      default:
        throw new BrokerError(
          `Unknown broker type: ${brokerType}`,
          brokerType,
          'UNKNOWN_BROKER'
        );
    }
  }

  /**
   * Set configuration for a broker type
   * 
   * @param brokerType The broker type to configure
   * @param config The configuration options
   */
  setConfig(brokerType: BrokerType, config: BrokerConfig): void {
    this.configs.set(brokerType, { ...this.configs.get(brokerType), ...config });
    
    // Clear cached instance so next call creates with new config
    this.instances.delete(brokerType);
  }

  /**
   * Get configuration for a broker type
   * 
   * @param brokerType The broker type
   * @returns The configuration options
   */
  getConfig(brokerType: BrokerType): BrokerConfig | undefined {
    return this.configs.get(brokerType);
  }

  /**
   * Check if a broker type is supported/implemented
   * 
   * @param brokerType The broker type to check
   * @returns True if the broker is implemented
   */
  isSupported(brokerType: BrokerType): boolean {
    switch (brokerType) {
      case 'IB':
        return true;
      case 'MT5':
      case 'CTRADER':
        return false; // Not yet implemented
      default:
        return false;
    }
  }

  /**
   * Get list of all supported broker types
   * 
   * @returns Array of supported broker types
   */
  getSupportedBrokers(): BrokerType[] {
    return ['IB']; // Will grow as more brokers are implemented
  }

  /**
   * Get list of all configured broker types (including not yet implemented)
   * 
   * @returns Array of all broker types
   */
  getAllBrokerTypes(): BrokerType[] {
    return ['IB', 'MT5', 'CTRADER'];
  }

  /**
   * Clear cached broker instance
   * 
   * @param brokerType The broker type to clear, or all if not specified
   */
  clearCache(brokerType?: BrokerType): void {
    if (brokerType) {
      this.instances.delete(brokerType);
    } else {
      this.instances.clear();
    }
  }

  /**
   * Get the default broker (currently IB)
   * 
   * @returns The default broker service
   */
  getDefaultBroker(): IBrokerService {
    const defaultBroker = (process.env.DEFAULT_BROKER as BrokerType) || 'IB';
    return this.getBroker(defaultBroker);
  }

  /**
   * Health check for all configured brokers
   * 
   * @returns Health status for each broker
   */
  async healthCheckAll(): Promise<Record<BrokerType, { healthy: boolean; details?: any }>> {
    const results: Record<string, { healthy: boolean; details?: any }> = {};

    for (const brokerType of this.getSupportedBrokers()) {
      try {
        const broker = this.getBroker(brokerType);
        results[brokerType] = await broker.healthCheck();
      } catch (error: any) {
        results[brokerType] = {
          healthy: false,
          details: { error: error.message }
        };
      }
    }

    return results as Record<BrokerType, { healthy: boolean; details?: any }>;
  }
}

// Export singleton instance
export const brokerFactory = new BrokerFactory();

// Convenience function to get a broker
export function getBroker(brokerType: BrokerType = 'IB'): IBrokerService {
  return brokerFactory.getBroker(brokerType);
}

// Convenience function to get the default broker
export function getDefaultBroker(): IBrokerService {
  return brokerFactory.getDefaultBroker();
}

export default brokerFactory;
