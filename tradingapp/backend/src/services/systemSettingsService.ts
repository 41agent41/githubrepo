import { dbService } from './database.js';
import crypto from 'crypto';

// Setting value types
export type SettingValueType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

// System setting interface
export interface SystemSetting {
  id?: number;
  category: string;
  key: string;
  value: string | null;
  value_type: SettingValueType;
  description?: string;
  is_sensitive: boolean;
  is_readonly: boolean;
  display_order: number;
  created_at?: Date;
  updated_at?: Date;
}

// Setting categories
export type SettingCategory = 
  | 'deployment'
  | 'cors'
  | 'redis'
  | 'security'
  | 'timezone'
  | 'data_collection'
  | 'ui'
  | 'api'
  | 'features'
  | 'notifications';

// Parsed settings by category
export interface ParsedSettings {
  deployment: {
    server_ip: string;
    frontend_port: number;
    backend_port: number;
    ib_service_port: number;
    ib_service_url: string;
    frontend_url: string;
  };
  cors: {
    allowed_origins: string;
    allow_credentials: boolean;
    allowed_methods: string;
    allowed_headers: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    enabled: boolean;
    ttl_seconds: number;
  };
  security: {
    jwt_secret: string;
    session_secret: string;
    jwt_expiry_hours: number;
    session_expiry_hours: number;
    require_auth: boolean;
  };
  timezone: {
    default_timezone: string;
    ib_timezone: string;
    data_timezone: string;
    date_format: string;
    time_format: string;
  };
  data_collection: {
    auto_collect_enabled: boolean;
    collection_interval_minutes: number;
    default_symbols: string[];
    default_timeframes: string[];
    retention_days: number;
  };
  ui: {
    theme: string;
    default_chart_type: string;
    show_volume: boolean;
    auto_refresh_seconds: number;
    max_chart_bars: number;
  };
  api: {
    rate_limit_enabled: boolean;
    rate_limit_requests: number;
    request_timeout_seconds: number;
    log_requests: boolean;
  };
  features: {
    enable_live_trading: boolean;
    enable_backtesting: boolean;
    enable_strategies: boolean;
    enable_alerts: boolean;
    enable_export: boolean;
  };
  notifications: {
    email_enabled: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_password: string;
    from_email: string;
    alert_email: string;
  };
}

class SystemSettingsService {
  private settingsCache: Map<string, SystemSetting> = new Map();
  private cacheExpiry: number = 0;
  private cacheTTL: number = 60000; // 1 minute cache

  // Generate a secure random secret
  private generateSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Parse value based on type
  private parseValue(value: string | null, type: SettingValueType): any {
    if (value === null || value === '') {
      return type === 'boolean' ? false : type === 'number' ? 0 : '';
    }

    switch (type) {
      case 'number':
        return parseFloat(value) || 0;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      case 'secret':
      case 'string':
      default:
        return value;
    }
  }

  // Get cache key
  private getCacheKey(category: string, key: string): string {
    return `${category}:${key}`;
  }

  // Check if cache is valid
  private isCacheValid(): boolean {
    return Date.now() < this.cacheExpiry && this.settingsCache.size > 0;
  }

  // Load all settings into cache
  async loadAllSettings(): Promise<void> {
    try {
      const result = await dbService.query('SELECT * FROM system_settings ORDER BY category, display_order');
      
      this.settingsCache.clear();
      for (const row of result.rows) {
        const cacheKey = this.getCacheKey(row.category, row.key);
        this.settingsCache.set(cacheKey, row);
      }
      
      this.cacheExpiry = Date.now() + this.cacheTTL;
      console.log(`Loaded ${result.rows.length} system settings into cache`);
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  }

  // Get a single setting
  async getSetting(category: string, key: string): Promise<string | null> {
    if (!this.isCacheValid()) {
      await this.loadAllSettings();
    }

    const cacheKey = this.getCacheKey(category, key);
    const setting = this.settingsCache.get(cacheKey);
    return setting?.value || null;
  }

  // Get a setting with parsed value
  async getSettingParsed<T>(category: string, key: string, defaultValue: T): Promise<T> {
    if (!this.isCacheValid()) {
      await this.loadAllSettings();
    }

    const cacheKey = this.getCacheKey(category, key);
    const setting = this.settingsCache.get(cacheKey);
    
    if (!setting) {
      return defaultValue;
    }

    return this.parseValue(setting.value, setting.value_type) as T;
  }

  // Get all settings for a category
  async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    const result = await dbService.query(
      'SELECT * FROM system_settings WHERE category = $1 ORDER BY display_order, key',
      [category]
    );
    return result.rows;
  }

  // Get all settings (masked for sensitive values)
  async getAllSettings(includeSensitive: boolean = false): Promise<SystemSetting[]> {
    const result = await dbService.query(
      'SELECT * FROM system_settings ORDER BY category, display_order, key'
    );
    
    if (!includeSensitive) {
      return result.rows.map(row => ({
        ...row,
        value: row.is_sensitive ? (row.value ? '********' : '') : row.value
      }));
    }
    
    return result.rows;
  }

  // Get all categories
  async getCategories(): Promise<{ category: string; setting_count: number; last_updated: Date }[]> {
    const result = await dbService.query('SELECT * FROM v_settings_categories');
    return result.rows;
  }

  // Update a setting
  async updateSetting(category: string, key: string, value: string): Promise<boolean> {
    try {
      const result = await dbService.query(
        'UPDATE system_settings SET value = $1 WHERE category = $2 AND key = $3 AND is_readonly = FALSE RETURNING *',
        [value, category, key]
      );
      
      if (result.rows.length > 0) {
        // Update cache
        const cacheKey = this.getCacheKey(category, key);
        this.settingsCache.set(cacheKey, result.rows[0]);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  }

  // Update multiple settings
  async updateSettings(settings: { category: string; key: string; value: string }[]): Promise<number> {
    let updated = 0;
    
    for (const setting of settings) {
      const success = await this.updateSetting(setting.category, setting.key, setting.value);
      if (success) updated++;
    }
    
    return updated;
  }

  // Create a new setting
  async createSetting(setting: Omit<SystemSetting, 'id' | 'created_at' | 'updated_at'>): Promise<SystemSetting> {
    const result = await dbService.query(`
      INSERT INTO system_settings (category, key, value, value_type, description, is_sensitive, is_readonly, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (category, key) DO UPDATE SET value = $3
      RETURNING *
    `, [
      setting.category,
      setting.key,
      setting.value,
      setting.value_type,
      setting.description || null,
      setting.is_sensitive || false,
      setting.is_readonly || false,
      setting.display_order || 0
    ]);
    
    // Invalidate cache
    this.cacheExpiry = 0;
    
    return result.rows[0];
  }

  // Delete a setting (only non-readonly)
  async deleteSetting(category: string, key: string): Promise<boolean> {
    const result = await dbService.query(
      'DELETE FROM system_settings WHERE category = $1 AND key = $2 AND is_readonly = FALSE',
      [category, key]
    );
    
    if ((result.rowCount ?? 0) > 0) {
      const cacheKey = this.getCacheKey(category, key);
      this.settingsCache.delete(cacheKey);
      return true;
    }
    
    return false;
  }

  // Initialize security secrets (auto-generate if empty)
  async initializeSecrets(): Promise<void> {
    const jwtSecret = await this.getSetting('security', 'jwt_secret');
    const sessionSecret = await this.getSetting('security', 'session_secret');

    if (!jwtSecret) {
      const newJwtSecret = this.generateSecret();
      await this.updateSetting('security', 'jwt_secret', newJwtSecret);
      console.log('Generated new JWT secret');
    }

    if (!sessionSecret) {
      const newSessionSecret = this.generateSecret();
      await this.updateSetting('security', 'session_secret', newSessionSecret);
      console.log('Generated new session secret');
    }
  }

  // Get parsed settings for a category
  async getParsedCategorySettings<T extends keyof ParsedSettings>(category: T): Promise<ParsedSettings[T]> {
    await this.loadAllSettings();
    
    const settings: Record<string, any> = {};
    
    for (const [cacheKey, setting] of this.settingsCache.entries()) {
      if (cacheKey.startsWith(`${category}:`)) {
        const key = setting.key;
        let value = this.parseValue(setting.value, setting.value_type);
        
        // Handle comma-separated arrays
        if (typeof value === 'string' && (key.includes('symbols') || key.includes('timeframes'))) {
          value = value.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        }
        
        settings[key] = value;
      }
    }
    
    return settings as ParsedSettings[T];
  }

  // Get CORS configuration for middleware
  async getCorsConfig(): Promise<{
    origin: string | string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  }> {
    const settings = await this.getParsedCategorySettings('cors');
    
    let origin: string | string[] | boolean = settings.allowed_origins;
    if (origin === '*') {
      origin = true; // Allow all origins
    } else if (origin.includes(',')) {
      origin = origin.split(',').map(o => o.trim());
    }

    return {
      origin,
      credentials: settings.allow_credentials,
      methods: settings.allowed_methods.split(',').map(m => m.trim()),
      allowedHeaders: settings.allowed_headers === '*' ? ['*'] : settings.allowed_headers.split(',').map(h => h.trim())
    };
  }

  // Get deployment/server value from cache (sync). Returns null if not loaded or not set.
  getCachedDeploymentValue(key: string): string | null {
    const cacheKey = this.getCacheKey('deployment', key);
    const setting = this.settingsCache.get(cacheKey);
    const raw = setting?.value;
    if (raw === undefined || raw === null || raw === '') return null;
    return String(raw);
  }

  // Get deployment configuration (async, loads cache if needed). Uses env fallback when deployment rows not yet in DB.
  async getDeploymentConfig(): Promise<ParsedSettings['deployment']> {
    try {
      const settings = await this.getParsedCategorySettings('deployment');
      return {
        server_ip: settings?.server_ip ?? process.env.SERVER_IP ?? '',
        frontend_port: Number(settings?.frontend_port) || parseInt(process.env.FRONTEND_PORT || '3000', 10),
        backend_port: Number(settings?.backend_port) || parseInt(process.env.BACKEND_PORT || '4000', 10),
        ib_service_port: Number(settings?.ib_service_port) || parseInt(process.env.IB_SERVICE_PORT || '8000', 10),
        ib_service_url: settings?.ib_service_url || process.env.IB_SERVICE_URL || 'http://ib_service:8000',
        frontend_url: settings?.frontend_url || process.env.FRONTEND_URL || 'http://localhost:3000'
      };
    } catch {
      return {
        server_ip: process.env.SERVER_IP ?? '',
        frontend_port: parseInt(process.env.FRONTEND_PORT || '3000', 10),
        backend_port: parseInt(process.env.BACKEND_PORT || '4000', 10),
        ib_service_port: parseInt(process.env.IB_SERVICE_PORT || '8000', 10),
        ib_service_url: process.env.IB_SERVICE_URL || 'http://ib_service:8000',
        frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000'
      };
    }
  }

  // Get Redis configuration
  async getRedisConfig(): Promise<{ host: string; port: number; password: string; enabled: boolean }> {
    const settings = await this.getParsedCategorySettings('redis');
    return {
      host: settings.host,
      port: settings.port,
      password: settings.password,
      enabled: settings.enabled
    };
  }

  // Get security configuration
  async getSecurityConfig(): Promise<{ jwtSecret: string; sessionSecret: string; jwtExpiry: number; requireAuth: boolean }> {
    await this.initializeSecrets();
    const settings = await this.getParsedCategorySettings('security');
    return {
      jwtSecret: settings.jwt_secret,
      sessionSecret: settings.session_secret,
      jwtExpiry: settings.jwt_expiry_hours * 60 * 60, // Convert to seconds
      requireAuth: settings.require_auth
    };
  }

  // Clear cache
  clearCache(): void {
    this.settingsCache.clear();
    this.cacheExpiry = 0;
  }

  // Export settings as JSON (for backup)
  async exportSettings(): Promise<Record<string, Record<string, string>>> {
    const allSettings = await this.getAllSettings(false);
    const exported: Record<string, Record<string, string>> = {};
    
    for (const setting of allSettings) {
      if (!exported[setting.category]) {
        exported[setting.category] = {};
      }
      exported[setting.category][setting.key] = setting.value || '';
    }
    
    return exported;
  }

  // Import settings from JSON
  async importSettings(settings: Record<string, Record<string, string>>): Promise<number> {
    let imported = 0;
    
    for (const [category, categorySettings] of Object.entries(settings)) {
      for (const [key, value] of Object.entries(categorySettings)) {
        try {
          const success = await this.updateSetting(category, key, value);
          if (success) imported++;
        } catch (error) {
          console.error(`Error importing setting ${category}.${key}:`, error);
        }
      }
    }
    
    this.clearCache();
    return imported;
  }
}

// Export singleton instance
export const systemSettingsService = new SystemSettingsService();
export default systemSettingsService;

