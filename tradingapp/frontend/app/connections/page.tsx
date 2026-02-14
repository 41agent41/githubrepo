'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import BackToHome from '../components/BackToHome';

// Types
interface IBConnectionProfile {
  id?: number;
  name: string;
  description?: string;
  connection_type: 'gateway' | 'tws';
  account_mode: 'live' | 'paper';
  host: string;
  port: number;
  client_id: number;
  timeout_seconds: number;
  auto_reconnect: boolean;
  max_retry_attempts: number;
  timezone: string;
  is_active: boolean;
  is_default: boolean;
  last_connected_at?: string;
  last_error?: string;
  connection_count: number;
  created_at?: string;
  updated_at?: string;
}

interface ConnectionStatus {
  connected: boolean;
  profile: IBConnectionProfile | null;
  ib_gateway: {
    connected: boolean;
    host: string;
    port: number;
    client_id: number;
    account_mode: string;
    last_error?: string;
  } | null;
  last_check: string;
}

// Get a readable error message (unwrap AggregateError and other nested errors)
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { name?: string; errors?: unknown[]; cause?: unknown };
    const errors = e.errors;
    if (e.name === 'AggregateError' && Array.isArray(errors) && errors.length > 0) {
      const first = errors[0];
      return first instanceof Error ? first.message : String(first);
    }
    if (e.message === 'AggregateError' && Array.isArray(errors) && errors.length > 0) {
      const first = errors[0];
      return first instanceof Error ? first.message : String(first);
    }
    if (e.cause instanceof Error) return e.cause.message;
    if (e.cause != null) return String(e.cause);
    return e.message;
  }
  return String(err);
}

// Default ports for different connection types
const DEFAULT_PORTS = {
  gateway_paper: 4002,
  gateway_live: 4001,
  tws_paper: 7497,
  tws_live: 7496
};

export default function ConnectionsPage() {
  const [profiles, setProfiles] = useState<IBConnectionProfile[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<IBConnectionProfile | null>(null);
  const [formData, setFormData] = useState<Partial<IBConnectionProfile>>({
    name: '',
    description: '',
    connection_type: 'gateway',
    account_mode: 'paper',
    host: 'localhost',
    port: 4002,
    client_id: 1,
    timeout_seconds: 15,
    auto_reconnect: true,
    max_retry_attempts: 3,
    timezone: 'UTC',
    is_active: false,
    is_default: false
  });

  // Testing state
  const [testingProfileId, setTestingProfileId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Connecting state
  const [connectingProfileId, setConnectingProfileId] = useState<number | null>(null);

  const apiUrl = getApiUrl();

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.message || data.error || 'Failed to fetch profiles';
        throw new Error(message);
      }
      setProfiles(data.profiles || []);
    } catch (err: any) {
      console.error('Error fetching profiles:', err);
      setError(getErrorMessage(err));
    }
  }, [apiUrl]);

  // Fetch connection status
  const fetchConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/status`);
      if (!response.ok) throw new Error('Failed to fetch connection status');
      const data = await response.json();
      setConnectionStatus(data);
    } catch (err: any) {
      console.error('Error fetching connection status:', err);
    }
  }, [apiUrl]);

  // Initial load (use allSettled so one failure doesn't throw AggregateError)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const [profilesResult, statusResult] = await Promise.allSettled([
        fetchProfiles(),
        fetchConnectionStatus()
      ]);
      if (profilesResult.status === 'rejected') {
        setError(getErrorMessage(profilesResult.reason));
      }
      setLoading(false);
    };
    loadData();
    
    // Poll connection status every 30 seconds
    const interval = setInterval(fetchConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchProfiles, fetchConnectionStatus]);

  // Update port when connection type or account mode changes
  useEffect(() => {
    const key = `${formData.connection_type}_${formData.account_mode}` as keyof typeof DEFAULT_PORTS;
    if (DEFAULT_PORTS[key]) {
      setFormData(prev => ({ ...prev, port: DEFAULT_PORTS[key] }));
    }
  }, [formData.connection_type, formData.account_mode]);

  // Show success message temporarily
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Create or update profile
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingProfile 
        ? `${apiUrl}/api/ib-connections/profiles/${editingProfile.id}`
        : `${apiUrl}/api/ib-connections/profiles`;
      
      const response = await fetch(url, {
        method: editingProfile ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.message || data.detail || data.error || 'Failed to save profile';
        throw new Error(message);
      }

      showSuccess(editingProfile ? 'Profile updated successfully' : 'Profile created successfully');
      setShowForm(false);
      setEditingProfile(null);
      resetForm();
      // Refresh list in background so a failing refresh doesn't overwrite success
      fetchProfiles().catch((e) => console.warn('Refresh after save failed:', e));
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Delete profile
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete profile');
      }

      showSuccess('Profile deleted successfully');
      await fetchProfiles();
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Activate profile (connect)
  const handleActivate = async (id: number) => {
    setConnectingProfileId(id);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${id}/activate`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to activate profile');
      }

      showSuccess('Connection activated successfully');
      await Promise.all([fetchProfiles(), fetchConnectionStatus()]);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setConnectingProfileId(null);
    }
  };

  // Deactivate profile (disconnect)
  const handleDeactivate = async (id: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${id}/deactivate`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate profile');
      }

      showSuccess('Connection deactivated successfully');
      await Promise.all([fetchProfiles(), fetchConnectionStatus()]);
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Set as default
  const handleSetDefault = async (id: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${id}/set-default`, {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set default');
      }

      showSuccess('Default profile set successfully');
      await fetchProfiles();
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  // Test connection
  const handleTest = async (profile: IBConnectionProfile) => {
    setTestingProfileId(profile.id || null);
    setTestResult(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${profile.id}/test`, {
        method: 'POST'
      });

      const data = await response.json();
      setTestResult(data.test_result);
    } catch (err: any) {
      setTestResult({ success: false, message: getErrorMessage(err) });
    } finally {
      setTestingProfileId(null);
    }
  };

  // Edit profile
  const handleEdit = (profile: IBConnectionProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      connection_type: profile.connection_type,
      account_mode: profile.account_mode,
      host: profile.host,
      port: profile.port,
      client_id: profile.client_id,
      timeout_seconds: profile.timeout_seconds,
      auto_reconnect: profile.auto_reconnect,
      max_retry_attempts: profile.max_retry_attempts,
      timezone: profile.timezone,
      is_active: profile.is_active,
      is_default: profile.is_default
    });
    setShowForm(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      connection_type: 'gateway',
      account_mode: 'paper',
      host: 'localhost',
      port: 4002,
      client_id: 1,
      timeout_seconds: 15,
      auto_reconnect: true,
      max_retry_attempts: 3,
      timezone: 'UTC',
      is_active: false,
      is_default: false
    });
  };

  // Get connection type label
  const getConnectionTypeLabel = (type: string) => {
    return type === 'gateway' ? 'IB Gateway' : 'Trader Workstation';
  };

  // Get account mode badge color
  const getAccountModeBadgeClass = (mode: string) => {
    return mode === 'live' 
      ? 'bg-red-900/50 text-red-300 border border-red-700' 
      : 'bg-blue-900/50 text-blue-300 border border-blue-700';
  };

  // Get status badge
  const getStatusBadge = (profile: IBConnectionProfile) => {
    if (profile.is_active && connectionStatus?.connected) {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-300 border border-green-700">Connected</span>;
    }
    if (profile.is_active) {
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700">Active (Disconnected)</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-400">Inactive</span>;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <BackToHome />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Connection Manager
          </h1>
          <p className="text-gray-400 mt-2">
            Configure connections to IB Gateway or Trader Workstation (TWS) for live or paper trading
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <strong>Error:</strong> {error}
                {(error.includes('does not exist') || error.includes('relation ') || error.includes('column ')) && (
                  <p className="mt-2 text-sm text-gray-400">
                    If this mentions a missing table or column, run the backend database migrations (e.g. <code className="bg-slate-800 px-1 rounded">migration-ib-connections.sql</code> and <code className="bg-slate-800 px-1 rounded">migration-keepalive.sql</code>).
                  </p>
                )}
                {(error.includes('fetch profiles') || error.includes('fetch connection') || error.includes('Failed to fetch')) && (
                  <p className="mt-2 text-sm text-gray-400">
                    Ensure the backend is running and reachable. API: <code className="bg-slate-800 px-1 rounded text-cyan-300">{apiUrl}</code> — You can retry below.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(error.includes('fetch profiles') || error.includes('fetch connection') || error.includes('Failed to fetch')) && (
                  <button
                    type="button"
                    onClick={() => { setError(null); fetchProfiles(); fetchConnectionStatus(); }}
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
        {testResult && (
          <div className={`mb-6 p-4 rounded-lg border ${testResult.success 
            ? 'bg-green-900/30 border-green-700 text-green-300' 
            : 'bg-red-900/30 border-red-700 text-red-300'}`}>
            <strong>{testResult.success ? '✓ Test Passed:' : '✗ Test Failed:'}</strong> {testResult.message}
            <button onClick={() => setTestResult(null)} className="ml-4 hover:opacity-70">×</button>
          </div>
        )}

        {/* Connection Status Card */}
        <div className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${connectionStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
            Connection Status
          </h2>
          
          {connectionStatus?.connected ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-gray-400 text-sm">Host</span>
                <p className="font-mono">{connectionStatus.ib_gateway?.host}:{connectionStatus.ib_gateway?.port}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Client ID</span>
                <p className="font-mono">{connectionStatus.ib_gateway?.client_id}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Mode</span>
                <p className={`font-semibold ${connectionStatus.ib_gateway?.account_mode === 'live' ? 'text-red-400' : 'text-blue-400'}`}>
                  {connectionStatus.ib_gateway?.account_mode?.toUpperCase()}
                </p>
              </div>
              <div className="md:col-span-3">
                <span className="text-gray-400 text-sm">Active Profile</span>
                <p className="text-cyan-400">{connectionStatus.profile?.name || 'Unknown'}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">Not connected to any IB Gateway or TWS instance</p>
          )}
        </div>

        {/* Add Profile Button */}
        {!showForm && (
          <button
            onClick={() => {
              setEditingProfile(null);
              resetForm();
              setShowForm(true);
            }}
            className="mb-6 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            + Add New Connection Profile
          </button>
        )}

        {/* Profile Form */}
        {showForm && (
          <div className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-xl">
            <h2 className="text-xl font-semibold mb-4">
              {editingProfile ? 'Edit Connection Profile' : 'New Connection Profile'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Profile Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., IB Gateway - Paper"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Connection Type & Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Connection Type *</label>
                  <select
                    value={formData.connection_type}
                    onChange={(e) => setFormData({ ...formData, connection_type: e.target.value as 'gateway' | 'tws' })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="gateway">IB Gateway</option>
                    <option value="tws">Trader Workstation (TWS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Account Mode *</label>
                  <select
                    value={formData.account_mode}
                    onChange={(e) => setFormData({ ...formData, account_mode: e.target.value as 'live' | 'paper' })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="paper">Paper Trading</option>
                    <option value="live">Live Trading</option>
                  </select>
                </div>
              </div>

              {/* Network Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Host / IP Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="localhost or IP address"
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: Gateway Paper=4002, Live=4001 | TWS Paper=7497, Live=7496
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Client ID</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Connection Timeout (seconds)</label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={formData.timeout_seconds}
                    onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Max Retry Attempts</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.max_retry_attempts}
                    onChange={(e) => setFormData({ ...formData, max_retry_attempts: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (ET)</option>
                    <option value="America/Chicago">America/Chicago (CT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_reconnect}
                    onChange={(e) => setFormData({ ...formData, auto_reconnect: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-300">Auto-reconnect on disconnect</span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold transition-all duration-200"
                >
                  {editingProfile ? 'Update Profile' : 'Create Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProfile(null);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Profiles List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Connection Profiles</h2>
          
          {profiles.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/30 border border-slate-700 rounded-xl">
              <p className="text-gray-400">No connection profiles configured yet.</p>
              <p className="text-gray-500 text-sm mt-2">Click "Add New Connection Profile" to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {profiles.map((profile) => (
                <div 
                  key={profile.id}
                  className={`p-6 bg-slate-800/50 border rounded-xl transition-all duration-200 ${
                    profile.is_active 
                      ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10' 
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Profile Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{profile.name}</h3>
                        {profile.is_default && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-900/50 text-purple-300 border border-purple-700">
                            Default
                          </span>
                        )}
                        {getStatusBadge(profile)}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getAccountModeBadgeClass(profile.account_mode)}`}>
                          {profile.account_mode.toUpperCase()}
                        </span>
                      </div>
                      
                      {profile.description && (
                        <p className="text-gray-400 text-sm mb-3">{profile.description}</p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Type</span>
                          <p className="font-medium">{getConnectionTypeLabel(profile.connection_type)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Host</span>
                          <p className="font-mono">{profile.host}:{profile.port}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Client ID</span>
                          <p className="font-mono">{profile.client_id}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Connections</span>
                          <p>{profile.connection_count}</p>
                        </div>
                      </div>

                      {profile.last_error && (
                        <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-red-300 text-sm">
                          <strong>Last Error:</strong> {profile.last_error}
                        </div>
                      )}

                      {profile.last_connected_at && (
                        <p className="mt-2 text-xs text-gray-500">
                          Last connected: {new Date(profile.last_connected_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {profile.is_active ? (
                        <button
                          onClick={() => handleDeactivate(profile.id!)}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600 text-red-300 rounded-lg text-sm font-medium transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(profile.id!)}
                          disabled={connectingProfileId === profile.id}
                          className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-600 text-green-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {connectingProfileId === profile.id ? (
                            <span className="flex items-center gap-2">
                              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-300"></span>
                              Connecting...
                            </span>
                          ) : (
                            'Connect'
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleTest(profile)}
                        disabled={testingProfileId === profile.id}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {testingProfileId === profile.id ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            Testing...
                          </span>
                        ) : (
                          'Test'
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleEdit(profile)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Edit
                      </button>
                      
                      {!profile.is_default && (
                        <button
                          onClick={() => handleSetDefault(profile.id!)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                        >
                          Set Default
                        </button>
                      )}
                      
                      {!profile.is_default && !profile.is_active && (
                        <button
                          onClick={() => handleDelete(profile.id!)}
                          className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-400 rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Reference */}
        <div className="mt-12 p-6 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 text-gray-300">Quick Reference: Default Ports</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-gray-500">IB Gateway - Paper</p>
              <p className="font-mono text-lg">4002</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-gray-500">IB Gateway - Live</p>
              <p className="font-mono text-lg text-red-400">4001</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-gray-500">TWS - Paper</p>
              <p className="font-mono text-lg">7497</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-gray-500">TWS - Live</p>
              <p className="font-mono text-lg text-red-400">7496</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

