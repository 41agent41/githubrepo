/**
 * Broker Connection Resolver
 *
 * Unified connection resolution that routes by brokerType to the appropriate
 * broker-specific connection service. Keeps ib_connection_profiles and future
 * ctrader_connection_profiles as-is (Option B from architecture review).
 */

import { BrokerType, BrokerConnectionConfig, AccountMode } from '../types/broker.js';
import { ibConnectionService, type IBConnectionProfile } from './ibConnectionService.js';
import { ctraderConnectionService, type CTraderConnectionProfile } from './ctraderConnectionService.js';

/** Result of getActiveConnection - profile metadata + config for connecting */
export interface ActiveConnectionResult {
  profileId: number;
  profileName: string;
  config: BrokerConnectionConfig;
  /** Broker-specific raw profile (e.g. IBConnectionProfile) */
  rawProfile?: unknown;
}

/** Connection status from a broker-specific service */
export interface ResolvedConnectionStatus {
  brokerType: BrokerType;
  connected: boolean;
  profileId?: number;
  profileName?: string;
  accountMode?: AccountMode;
  lastError?: string;
  details?: Record<string, unknown>;
}

/**
 * Maps IBConnectionProfile to BrokerConnectionConfig.
 * Includes connectionType for IBBroker.connect() compatibility.
 */
function mapIBProfileToConfig(profile: IBConnectionProfile): BrokerConnectionConfig {
  return {
    brokerType: 'IB',
    name: profile.name,
    description: profile.description ?? undefined,
    accountMode: profile.account_mode as AccountMode,
    host: profile.host,
    port: profile.port,
    clientId: profile.client_id,
    timeoutSeconds: profile.timeout_seconds,
    autoReconnect: profile.auto_reconnect,
    maxRetryAttempts: profile.max_retry_attempts,
    keepAliveIntervalMinutes: profile.keep_alive_interval_minutes,
    settings: {
      connectionType: profile.connection_type,
      connection_type: profile.connection_type
    },
    // For IBBroker.connect() - IBConnectionConfig extends with connectionType
    connectionType: profile.connection_type
  } as BrokerConnectionConfig;
}

/**
 * Maps CTraderConnectionProfile to BrokerConnectionConfig.
 */
function mapCTraderProfileToConfig(profile: CTraderConnectionProfile): BrokerConnectionConfig {
  return {
    brokerType: 'CTRADER',
    name: profile.name,
    description: profile.description ?? undefined,
    accountMode: profile.account_mode as AccountMode,
    clientId: profile.client_id,
    clientSecret: profile.client_secret_encrypted,
    redirectUri: profile.redirect_uri,
    settings: {
      clientId: profile.client_id,
      clientSecret: profile.client_secret_encrypted,
      redirectUri: profile.redirect_uri,
      accessToken: profile.access_token,
      refreshToken: profile.refresh_token,
      tokenExpiresAt: profile.token_expires_at,
      ctraderAccountId: profile.ctrader_account_id
    }
  } as BrokerConnectionConfig;
}

/**
 * BrokerConnectionResolver - routes by brokerType to the correct connection service
 */
class BrokerConnectionResolver {
  /**
   * Check if a connection service exists for the given broker type
   */
  hasConnectionService(brokerType: BrokerType): boolean {
    switch (brokerType) {
      case 'IB':
      case 'CTRADER':
        return true;
      case 'MT5':
        return false;
      default:
        return false;
    }
  }

  /**
   * Get the active connection profile and config for a broker type.
   * Returns null if no connection service or no active profile.
   */
  async getActiveConnection(brokerType: BrokerType): Promise<ActiveConnectionResult | null> {
    switch (brokerType) {
      case 'IB': {
        const profile = await ibConnectionService.getActiveProfile();
        if (!profile) {
          const defaultProfile = await ibConnectionService.getDefaultProfile();
          if (!defaultProfile) return null;
          return {
            profileId: defaultProfile.id!,
            profileName: defaultProfile.name,
            config: mapIBProfileToConfig(defaultProfile),
            rawProfile: defaultProfile
          };
        }
        return {
          profileId: profile.id!,
          profileName: profile.name,
          config: mapIBProfileToConfig(profile),
          rawProfile: profile
        };
      }
      case 'CTRADER': {
        let profile = await ctraderConnectionService.getActiveProfile();
        if (!profile) {
          profile = await ctraderConnectionService.getDefaultProfile();
        }
        if (!profile) return null;

        // C3: Refresh tokens if expired or within 5 minutes of expiry
        profile = await ctraderConnectionService.refreshTokensIfNeeded(profile, 5);

        return {
          profileId: profile.id!,
          profileName: profile.name,
          config: mapCTraderProfileToConfig(profile),
          rawProfile: profile
        };
      }
      case 'MT5':
        return null;
      default:
        return null;
    }
  }

  /**
   * Get connection status for a broker type.
   * Delegates to the appropriate broker-specific service.
   */
  async getConnectionStatus(brokerType: BrokerType): Promise<ResolvedConnectionStatus | null> {
    switch (brokerType) {
      case 'IB': {
        const status = await ibConnectionService.getConnectionStatus();
        return {
          brokerType: 'IB',
          connected: status.connected,
          profileId: status.profile?.id,
          profileName: status.profile?.name,
          accountMode: (status.profile?.account_mode ?? status.ib_gateway?.account_mode) as AccountMode | undefined,
          lastError: status.ib_gateway?.last_error,
          details: {
            host: status.ib_gateway?.host,
            port: status.ib_gateway?.port,
            clientId: status.ib_gateway?.client_id
          }
        };
      }
      case 'CTRADER': {
        const profile = await ctraderConnectionService.getActiveProfile() ?? await ctraderConnectionService.getDefaultProfile();
        if (!profile) return null;
        const hasToken = !!profile.access_token;
        const tokenExpired = profile.token_expires_at
          ? new Date(profile.token_expires_at).getTime() <= Date.now()
          : false;
        return {
          brokerType: 'CTRADER',
          connected: hasToken && !tokenExpired,
          profileId: profile.id,
          profileName: profile.name,
          accountMode: profile.account_mode as AccountMode,
          lastError: tokenExpired ? 'Token expired – refresh needed' : (profile.last_error ?? undefined),
          details: {
            clientId: profile.client_id,
            ctraderAccountId: profile.ctrader_account_id,
            tokenExpired,
          }
        };
      }
      case 'MT5':
        return null;
      default:
        return null;
    }
  }

  /**
   * Get connection config for a specific profile ID.
   * Useful when activating or testing a specific profile.
   */
  async getConnectionConfigForProfile(
    brokerType: BrokerType,
    profileId: number
  ): Promise<BrokerConnectionConfig | null> {
    switch (brokerType) {
      case 'IB': {
        const profile = await ibConnectionService.getProfileById(profileId);
        return profile ? mapIBProfileToConfig(profile) : null;
      }
      case 'CTRADER': {
        const profile = await ctraderConnectionService.getProfileById(profileId);
        if (!profile) return null;
        const refreshed = await ctraderConnectionService.refreshTokensIfNeeded(profile, 5);
        return mapCTraderProfileToConfig(refreshed);
      }
      default:
        return null;
    }
  }
}

export const brokerConnectionResolver = new BrokerConnectionResolver();
export default brokerConnectionResolver;
