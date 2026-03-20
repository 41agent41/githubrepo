import { marketDataCollector } from './marketDataCollector.js';
import { strategyService } from './strategyService.js';
import { tradingSetupService } from './tradingSetupService.js';
import { ibConnectionService } from './ibConnectionService.js';
import { ctraderConnectionService } from './ctraderConnectionService.js';

// Simple in-memory job scheduler
// In production, consider using node-cron or a proper job queue

let dataCollectionInterval: NodeJS.Timeout | null = null;
let strategyCalculationInterval: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;
let ctraderTokenRefreshInterval: NodeJS.Timeout | null = null;

// Default keep-alive interval (15 minutes in milliseconds)
const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 15 * 60 * 1000;
// C3: cTrader token refresh - run every hour
const CTRADER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export const backgroundJobs = {
  /**
   * Start automatic data collection job
   * Collects data every 5 minutes for intraday timeframes, hourly for others
   */
  startDataCollection(): void {
    if (dataCollectionInterval) {
      console.log('Data collection job already running');
      return;
    }

    console.log('Starting automatic data collection job...');

    // Run immediately on start
    this.runDataCollection();

    // Then run every 5 minutes
    dataCollectionInterval = setInterval(() => {
      this.runDataCollection();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('Data collection job started (runs every 5 minutes)');
  },

  /**
   * Stop automatic data collection job
   */
  stopDataCollection(): void {
    if (dataCollectionInterval) {
      clearInterval(dataCollectionInterval);
      dataCollectionInterval = null;
      console.log('Data collection job stopped');
    }
  },

  /**
   * Run data collection for all active setups
   */
  async runDataCollection(): Promise<void> {
    try {
      console.log('Running scheduled data collection...');
      const stats = await marketDataCollector.collectForAllActiveSetups();
      console.log(`Data collection completed: ${stats.successful}/${stats.totalTimeframes} successful`);
    } catch (error) {
      console.error('Error in scheduled data collection:', error);
    }
  },

  /**
   * Start automatic strategy calculation job
   * Calculates signals every 5 minutes for active setups
   */
  startStrategyCalculation(): void {
    if (strategyCalculationInterval) {
      console.log('Strategy calculation job already running');
      return;
    }

    console.log('Starting automatic strategy calculation job...');

    // Run immediately on start
    this.runStrategyCalculation();

    // Then run every 5 minutes
    strategyCalculationInterval = setInterval(() => {
      this.runStrategyCalculation();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('Strategy calculation job started (runs every 5 minutes)');
  },

  /**
   * Stop automatic strategy calculation job
   */
  stopStrategyCalculation(): void {
    if (strategyCalculationInterval) {
      clearInterval(strategyCalculationInterval);
      strategyCalculationInterval = null;
      console.log('Strategy calculation job stopped');
    }
  },

  /**
   * Run strategy calculation for all active setups
   */
  async runStrategyCalculation(): Promise<void> {
    try {
      console.log('Running scheduled strategy calculation...');
      const activeSetups = await tradingSetupService.listSetups('active');
      
      for (const setup of activeSetups) {
        if (setup.strategies && setup.strategies.length > 0) {
          try {
            const result = await strategyService.calculateSignalsForSetup(setup.id);
            console.log(`Strategy calculation for setup ${setup.id}: ${result.totalSignals} signals generated`);
          } catch (error) {
            console.error(`Error calculating strategies for setup ${setup.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in scheduled strategy calculation:', error);
    }
  },

  /**
   * Start IB connection keep-alive job
   * Checks connection health and reconnects if needed (default: every 15 minutes)
   */
  startKeepAlive(): void {
    if (keepAliveInterval) {
      console.log('Keep-alive job already running');
      return;
    }

    console.log('Starting IB connection keep-alive job...');

    // Run first check after a short delay (30 seconds) to allow initial connection
    setTimeout(() => {
      this.runKeepAlive();
    }, 30 * 1000);

    // Then run at the default interval (will be adjusted based on profile settings)
    keepAliveInterval = setInterval(() => {
      this.runKeepAlive();
    }, DEFAULT_KEEP_ALIVE_INTERVAL_MS);

    console.log(`Keep-alive job started (runs every ${DEFAULT_KEEP_ALIVE_INTERVAL_MS / 60000} minutes)`);
  },

  /**
   * Stop IB connection keep-alive job
   */
  stopKeepAlive(): void {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
      console.log('Keep-alive job stopped');
    }
  },

  /**
   * Run keep-alive check for active IB connection
   */
  async runKeepAlive(): Promise<void> {
    try {
      const result = await ibConnectionService.performKeepAlive();
      
      if (result.checked) {
        if (result.reconnectAttempted) {
          console.log(`[Keep-Alive] ${result.message} for profile: ${result.profile?.name}`);
        } else if (result.isConnected) {
          // Only log occasionally for healthy connections to reduce noise
          console.log(`[Keep-Alive] Connection healthy for profile: ${result.profile?.name}`);
        }
      }
    } catch (error) {
      console.error('[Keep-Alive] Error running keep-alive check:', error);
    }
  },

  /**
   * C3: Start cTrader token refresh job.
   * Refreshes tokens for profiles expiring within 24 hours (runs every hour).
   */
  startCTraderTokenRefresh(): void {
    if (ctraderTokenRefreshInterval) {
      console.log('cTrader token refresh job already running');
      return;
    }

    console.log('Starting cTrader token refresh job...');

    const runRefresh = () => {
      this.runCTraderTokenRefresh();
    };

    // Run first refresh after 2 minutes (allow services to start)
    setTimeout(runRefresh, 2 * 60 * 1000);

    ctraderTokenRefreshInterval = setInterval(runRefresh, CTRADER_REFRESH_INTERVAL_MS);

    console.log(`cTrader token refresh job started (runs every ${CTRADER_REFRESH_INTERVAL_MS / 60000} minutes)`);
  },

  /**
   * Stop cTrader token refresh job
   */
  stopCTraderTokenRefresh(): void {
    if (ctraderTokenRefreshInterval) {
      clearInterval(ctraderTokenRefreshInterval);
      ctraderTokenRefreshInterval = null;
      console.log('cTrader token refresh job stopped');
    }
  },

  /**
   * C3: Refresh cTrader tokens for profiles expiring within 24 hours
   */
  async runCTraderTokenRefresh(): Promise<void> {
    try {
      const profiles = await ctraderConnectionService.getAllProfiles();
      const bufferHours = 24;
      const bufferMs = bufferHours * 60 * 60 * 1000;
      const now = Date.now();

      for (const profile of profiles) {
        if (!profile.refresh_token || !profile.client_secret_encrypted || !profile.token_expires_at) {
          continue;
        }
        const expiresAt = new Date(profile.token_expires_at).getTime();
        if (expiresAt - now <= bufferMs) {
          const refreshed = await ctraderConnectionService.refreshTokens(profile.id!);
          if (refreshed) {
            console.log(`[cTrader Refresh] Tokens refreshed for profile: ${profile.name}`);
          } else {
            console.warn(`[cTrader Refresh] Failed to refresh tokens for profile: ${profile.name}`);
          }
        }
      }
    } catch (error) {
      console.error('[cTrader Refresh] Error running token refresh:', error);
    }
  },

  /**
   * Start all background jobs
   */
  startAll(): void {
    this.startDataCollection();
    this.startStrategyCalculation();
    this.startKeepAlive();
    this.startCTraderTokenRefresh();
    console.log('All background jobs started');
  },

  /**
   * Stop all background jobs
   */
  stopAll(): void {
    this.stopDataCollection();
    this.stopStrategyCalculation();
    this.stopKeepAlive();
    this.stopCTraderTokenRefresh();
    console.log('All background jobs stopped');
  }
};

