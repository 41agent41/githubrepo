/**
 * Runtime configuration from System Settings (database) with .env fallback.
 * Load system settings at startup so these sync getters use DB values when available.
 */
import { systemSettingsService } from '../services/systemSettingsService.js';
import type { BrokerType } from '../types/broker.js';

/** Default service URLs per broker type (used when not in System Settings or env) */
const BROKER_SERVICE_DEFAULTS: Record<BrokerType, string> = {
  IB: 'http://ib_service:8000',
  MT5: 'http://mt5_service:8001',
  CTRADER: 'http://ctrader_service:8002'
};

/** Env var keys per broker type */
const BROKER_SERVICE_ENV_KEYS: Record<BrokerType, string> = {
  IB: 'IB_SERVICE_URL',
  MT5: 'MT5_SERVICE_URL',
  CTRADER: 'CTRADER_SERVICE_URL'
};

/** System Settings keys per broker type */
const BROKER_SERVICE_SETTINGS_KEYS: Record<BrokerType, string> = {
  IB: 'ib_service_url',
  MT5: 'mt5_service_url',
  CTRADER: 'ctrader_service_url'
};

/**
 * Get broker service URL by broker type.
 * Resolution order: System Settings → env var → default.
 */
export function getBrokerServiceUrl(brokerType: BrokerType): string {
  const fromSettings = systemSettingsService.getCachedDeploymentValue(BROKER_SERVICE_SETTINGS_KEYS[brokerType]);
  if (fromSettings) return fromSettings;

  const fromEnv = process.env[BROKER_SERVICE_ENV_KEYS[brokerType]];
  if (fromEnv) return fromEnv;

  return BROKER_SERVICE_DEFAULTS[brokerType];
}

/** @deprecated Use getBrokerServiceUrl('IB') instead. Kept for backwards compatibility. */
export function getIBServiceUrl(): string {
  return getBrokerServiceUrl('IB');
}

export function getFrontendUrl(): string {
  const fromSettings = systemSettingsService.getCachedDeploymentValue('frontend_url');
  return fromSettings || process.env.FRONTEND_URL || 'http://localhost:3000';
}

export function getServerIp(): string {
  const fromSettings = systemSettingsService.getCachedDeploymentValue('server_ip');
  return fromSettings || process.env.SERVER_IP || '';
}

export function getDeploymentPorts(): { frontend: number; backend: number; ibService: number } {
  const frontend = systemSettingsService.getCachedDeploymentValue('frontend_port');
  const backend = systemSettingsService.getCachedDeploymentValue('backend_port');
  const ibService = systemSettingsService.getCachedDeploymentValue('ib_service_port');
  return {
    frontend: frontend ? parseInt(frontend, 10) || 3000 : parseInt(process.env.FRONTEND_PORT || '3000', 10),
    backend: backend ? parseInt(backend, 10) || 4000 : parseInt(process.env.BACKEND_PORT || '4000', 10),
    ibService: ibService ? parseInt(ibService, 10) || 8000 : parseInt(process.env.IB_SERVICE_PORT || '8000', 10)
  };
}
