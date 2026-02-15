'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import BackToHome from '../components/BackToHome';

// Types
interface SystemSetting {
  id: number;
  category: string;
  key: string;
  value: string | null;
  value_type: 'string' | 'number' | 'boolean' | 'json' | 'secret';
  description?: string;
  is_sensitive: boolean;
  is_readonly: boolean;
  display_order: number;
}

interface SettingsGroup {
  [category: string]: SystemSetting[];
}

// Category display names and icons
const CATEGORY_INFO: Record<string, { name: string; icon: string; description: string }> = {
  deployment: { name: 'Deployment & URLs', icon: '🖥️', description: 'Server IP, ports, and service URLs (replaces most .env values)' },
  cors: { name: 'CORS Settings', icon: '🔒', description: 'Cross-Origin Resource Sharing configuration' },
  redis: { name: 'Redis Cache', icon: '💾', description: 'Redis caching configuration' },
  security: { name: 'Security', icon: '🛡️', description: 'Authentication and security settings' },
  timezone: { name: 'Timezone', icon: '🌍', description: 'Timezone and date format settings' },
  data_collection: { name: 'Data Collection', icon: '📊', description: 'Automatic data collection settings' },
  ui: { name: 'User Interface', icon: '🎨', description: 'UI appearance and behavior' },
  api: { name: 'API Settings', icon: '⚡', description: 'API rate limiting and configuration' },
  features: { name: 'Feature Flags', icon: '🚀', description: 'Enable or disable features' },
  notifications: { name: 'Notifications', icon: '📧', description: 'Email and notification settings' }
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsGroup>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  
  const apiUrl = getApiUrl();

  // Fetch all settings
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/system-settings`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.message || data.error || 'Failed to fetch settings';
        throw new Error(message);
      }
      setSettings(data.settings || {});

      // Set first category as active if none selected
      if (!activeCategory && data.settings) {
        const categories = Object.keys(data.settings);
        if (categories.length > 0) {
          setActiveCategory(categories[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, activeCategory]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Show success message temporarily
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Handle setting value change
  const handleValueChange = (category: string, key: string, value: string) => {
    const changeKey = `${category}:${key}`;
    const newChanges = new Map(pendingChanges);
    newChanges.set(changeKey, value);
    setPendingChanges(newChanges);
  };

  // Get current value (pending change or original)
  const getCurrentValue = (setting: SystemSetting): string => {
    const changeKey = `${setting.category}:${setting.key}`;
    if (pendingChanges.has(changeKey)) {
      return pendingChanges.get(changeKey) || '';
    }
    return setting.value || '';
  };

  // Check if setting has pending changes
  const hasChanges = (setting: SystemSetting): boolean => {
    const changeKey = `${setting.category}:${setting.key}`;
    return pendingChanges.has(changeKey);
  };

  // Save all pending changes
  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const updates = Array.from(pendingChanges.entries()).map(([key, value]) => {
        const [category, settingKey] = key.split(':');
        return { category, key: settingKey, value };
      });
      
      const response = await fetch(`${apiUrl}/api/system-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      
      const result = await response.json();
      showSuccess(`Saved ${result.updated_count} settings successfully`);
      setPendingChanges(new Map());
      await fetchSettings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Discard pending changes
  const discardChanges = () => {
    setPendingChanges(new Map());
  };

  // Regenerate security secrets
  const regenerateSecrets = async (type: 'jwt' | 'session' | 'all') => {
    if (!confirm(`Are you sure you want to regenerate ${type === 'all' ? 'all security secrets' : `the ${type} secret`}? This will invalidate existing sessions.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${apiUrl}/api/system-settings/security/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret_type: type })
      });
      
      if (!response.ok) throw new Error('Failed to regenerate secrets');
      
      showSuccess('Security secrets regenerated successfully');
      await fetchSettings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Render setting input based on type
  const renderSettingInput = (setting: SystemSetting) => {
    const value = getCurrentValue(setting);
    const isChanged = hasChanges(setting);
    
    const baseClasses = `w-full px-3 py-2 bg-slate-900 border rounded-lg focus:outline-none transition-colors ${
      isChanged 
        ? 'border-yellow-500 ring-1 ring-yellow-500/50' 
        : 'border-slate-600 focus:border-cyan-500'
    } ${setting.is_readonly ? 'opacity-60 cursor-not-allowed' : ''}`;

    if (setting.value_type === 'boolean') {
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => !setting.is_readonly && handleValueChange(setting.category, setting.key, value === 'true' ? 'false' : 'true')}
            disabled={setting.is_readonly}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              value === 'true' 
                ? 'bg-cyan-600' 
                : 'bg-slate-700'
            } ${setting.is_readonly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              value === 'true' ? 'left-8' : 'left-1'
            }`} />
          </button>
          <span className={`text-sm ${value === 'true' ? 'text-cyan-400' : 'text-gray-500'}`}>
            {value === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      );
    }

    if (setting.value_type === 'secret') {
      return (
        <div className="flex gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => handleValueChange(setting.category, setting.key, e.target.value)}
            disabled={setting.is_readonly}
            placeholder={setting.is_sensitive ? '••••••••' : 'Enter value'}
            className={`${baseClasses} font-mono`}
          />
          {setting.category === 'security' && (
            <button
              onClick={() => regenerateSecrets(setting.key.includes('jwt') ? 'jwt' : 'session')}
              className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600 text-purple-300 rounded-lg text-sm whitespace-nowrap"
            >
              Regenerate
            </button>
          )}
        </div>
      );
    }

    if (setting.value_type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleValueChange(setting.category, setting.key, e.target.value)}
          disabled={setting.is_readonly}
          className={`${baseClasses} font-mono`}
        />
      );
    }

    // Default: string input
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleValueChange(setting.category, setting.key, e.target.value)}
        disabled={setting.is_readonly}
        className={`${baseClasses} ${setting.key.includes('host') || setting.key.includes('port') ? 'font-mono' : ''}`}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <BackToHome />
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        </div>
      </div>
    );
  }

  const categories = Object.keys(settings).sort((a, b) => {
    if (a === 'deployment') return -1;
    if (b === 'deployment') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <BackToHome />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            System Settings
          </h1>
          <p className="text-gray-400 mt-2">
            Configure all application settings from your browser - no .env file needed
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <strong>Error:</strong> {error}
                {(error.includes('fetch settings') || error.includes('5432') || error.includes('ECONNREFUSED')) && (
                  <p className="mt-2 text-sm text-gray-400">
                    Ensure the backend is running and can reach the database. Only database connection (POSTGRES_*) must be in .env; other settings are configured here once the app is running.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(error.includes('fetch settings') || error.includes('Failed to fetch')) && (
                  <button
                    type="button"
                    onClick={() => { setError(null); fetchSettings(); }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                )}
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 p-1" aria-label="Dismiss">×</button>
              </div>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300">
            {successMessage}
          </div>
        )}

        {/* Pending Changes Bar */}
        {pendingChanges.size > 0 && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg flex items-center justify-between">
            <span className="text-yellow-300">
              You have {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-3">
              <button
                onClick={discardChanges}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium"
              >
                Discard
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-8">
          {/* Category Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1 sticky top-8">
              {categories.map(category => {
                const info = CATEGORY_INFO[category] || { name: category, icon: '⚙️', description: '' };
                const isActive = activeCategory === category;
                const categorySettings = settings[category] || [];
                const hasUnsaved = categorySettings.some(s => hasChanges(s));
                
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-cyan-600/20 border border-cyan-500/50 text-cyan-300' 
                        : 'bg-slate-800/50 hover:bg-slate-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{info.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{info.name}</span>
                          {hasUnsaved && (
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{categorySettings.length} settings</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Settings Panel */}
          <div className="flex-1">
            {activeCategory && settings[activeCategory] && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{CATEGORY_INFO[activeCategory]?.icon || '⚙️'}</span>
                    <h2 className="text-xl font-semibold">
                      {CATEGORY_INFO[activeCategory]?.name || activeCategory}
                    </h2>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {CATEGORY_INFO[activeCategory]?.description || ''}
                  </p>
                </div>

                <div className="space-y-6">
                  {settings[activeCategory].map(setting => (
                    <div key={`${setting.category}-${setting.key}`} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-300">
                          {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </label>
                        {setting.is_readonly && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-gray-500">
                            Read-only
                          </span>
                        )}
                        {setting.is_sensitive && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-red-900/50 text-red-400">
                            Sensitive
                          </span>
                        )}
                        {hasChanges(setting) && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-900/50 text-yellow-400">
                            Modified
                          </span>
                        )}
                      </div>
                      
                      {renderSettingInput(setting)}
                      
                      {setting.description && (
                        <p className="text-xs text-gray-500">{setting.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Category-specific actions */}
                {activeCategory === 'security' && (
                  <div className="mt-8 pt-6 border-t border-slate-700">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Security Actions</h3>
                    <button
                      onClick={() => regenerateSecrets('all')}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600 text-red-300 rounded-lg text-sm"
                    >
                      Regenerate All Secrets
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      Warning: This will invalidate all existing sessions and tokens
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-12 p-6 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 text-gray-300">About System Settings</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-gray-300 mb-2">No .env File Required</h4>
              <p>All configuration is stored in the database and can be modified through this interface. Changes take effect immediately without restarting services.</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-300 mb-2">Security</h4>
              <p>Sensitive values like passwords and secrets are encrypted in the database. JWT and session secrets are auto-generated on first run if not set.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

