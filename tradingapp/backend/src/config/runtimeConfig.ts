/**
 * Runtime configuration from System Settings (database) with .env fallback.
 * Load system settings at startup so these sync getters use DB values when available.
 */
import { systemSettingsService } from '../services/systemSettingsService.js';

export function getIBServiceUrl(): string {
  const fromSettings = systemSettingsService.getCachedDeploymentValue('ib_service_url');
  return fromSettings || process.env.IB_SERVICE_URL || 'http://ib_service:8000';
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
