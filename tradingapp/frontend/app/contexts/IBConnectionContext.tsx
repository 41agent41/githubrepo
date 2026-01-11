'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getApiUrl } from '../utils/apiConfig';

// Types matching the backend IB Connection service
export interface IBConnectionProfile {
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

export interface ConnectionStatus {
  connected: boolean;
  profile: IBConnectionProfile | null;
  ib_gateway: {
    connected: boolean;
    host: string;
    port: number;
    client_id: number;
    account_mode: string;
    connection_type?: string;
    last_error?: string;
  } | null;
  last_check: string;
}

export interface IBConnectionContextType {
  // Connection state
  connectionStatus: ConnectionStatus | null;
  activeProfile: IBConnectionProfile | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Derived values from the active connection
  accountMode: 'live' | 'paper' | 'unknown';
  isLiveTrading: boolean;
  connectionType: 'gateway' | 'tws' | 'unknown';
  
  // Actions
  refresh: () => Promise<void>;
  activateProfile: (profileId: number) => Promise<boolean>;
  deactivateProfile: (profileId: number) => Promise<boolean>;
  
  // All profiles (for quick switching)
  profiles: IBConnectionProfile[];
  fetchProfiles: () => Promise<void>;
}

const IBConnectionContext = createContext<IBConnectionContextType | undefined>(undefined);

interface IBConnectionProviderProps {
  children: ReactNode;
  pollInterval?: number; // in milliseconds, default 30000 (30 seconds)
}

export function IBConnectionProvider({ 
  children, 
  pollInterval = 30000 
}: IBConnectionProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [profiles, setProfiles] = useState<IBConnectionProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getApiUrl();

  // Fetch connection status from the backend
  const fetchConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch connection status');
      }
      const data: ConnectionStatus = await response.json();
      setConnectionStatus(data);
      setError(null);
      return data;
    } catch (err: any) {
      console.error('Error fetching IB connection status:', err);
      setError(err.message || 'Failed to fetch connection status');
      return null;
    }
  }, [apiUrl]);

  // Fetch all profiles
  const fetchProfiles = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles`);
      if (!response.ok) {
        throw new Error('Failed to fetch profiles');
      }
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch (err: any) {
      console.error('Error fetching IB profiles:', err);
    }
  }, [apiUrl]);

  // Refresh both status and profiles
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchConnectionStatus(), fetchProfiles()]);
    setIsLoading(false);
  }, [fetchConnectionStatus, fetchProfiles]);

  // Activate a profile
  const activateProfile = useCallback(async (profileId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${profileId}/activate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to activate profile');
      }
      
      // Refresh status after activation
      await refresh();
      return true;
    } catch (err: any) {
      console.error('Error activating profile:', err);
      setError(err.message);
      return false;
    }
  }, [apiUrl, refresh]);

  // Deactivate a profile
  const deactivateProfile = useCallback(async (profileId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/profiles/${profileId}/deactivate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate profile');
      }
      
      // Refresh status after deactivation
      await refresh();
      return true;
    } catch (err: any) {
      console.error('Error deactivating profile:', err);
      setError(err.message);
      return false;
    }
  }, [apiUrl, refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for status updates
  useEffect(() => {
    if (pollInterval <= 0) return;
    
    const interval = setInterval(() => {
      fetchConnectionStatus();
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [fetchConnectionStatus, pollInterval]);

  // Derived values
  const isConnected = connectionStatus?.connected || false;
  const activeProfile = connectionStatus?.profile || null;
  
  // Get account mode from the actual connection, fallback to profile, then to 'unknown'
  const accountMode: 'live' | 'paper' | 'unknown' = 
    (connectionStatus?.ib_gateway?.account_mode as 'live' | 'paper') ||
    connectionStatus?.profile?.account_mode ||
    'unknown';
  
  const isLiveTrading = accountMode === 'live';
  
  const connectionType: 'gateway' | 'tws' | 'unknown' = 
    (connectionStatus?.ib_gateway?.connection_type as 'gateway' | 'tws') ||
    connectionStatus?.profile?.connection_type ||
    'unknown';

  const value: IBConnectionContextType = {
    connectionStatus,
    activeProfile,
    isConnected,
    isLoading,
    error,
    accountMode,
    isLiveTrading,
    connectionType,
    refresh,
    activateProfile,
    deactivateProfile,
    profiles,
    fetchProfiles
  };

  return (
    <IBConnectionContext.Provider value={value}>
      {children}
    </IBConnectionContext.Provider>
  );
}

export function useIBConnection() {
  const context = useContext(IBConnectionContext);
  if (context === undefined) {
    throw new Error('useIBConnection must be used within an IBConnectionProvider');
  }
  return context;
}

// Backward compatibility hook - provides same interface as old TradingAccountContext
// This allows gradual migration of components
export function useTradingAccount() {
  const { accountMode, isLiveTrading } = useIBConnection();
  
  return {
    isLiveTrading,
    setIsLiveTrading: () => {
      console.warn('setIsLiveTrading is deprecated. Use IB Connection Manager to change account mode.');
    },
    accountMode: accountMode === 'unknown' ? 'paper' : accountMode,
    dataType: isLiveTrading ? 'real-time' as const : 'delayed' as const
  };
}
