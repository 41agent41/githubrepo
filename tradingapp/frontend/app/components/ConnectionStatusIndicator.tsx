'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../utils/apiConfig';

interface ConnectionStatus {
  connected: boolean;
  profile: {
    name: string;
    connection_type: string;
    account_mode: string;
    host: string;
    port: number;
  } | null;
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

interface ConnectionStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export default function ConnectionStatusIndicator({ 
  showDetails = false,
  className = ''
}: ConnectionStatusIndicatorProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const apiUrl = getApiUrl();

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/ib-connections/status`);
      if (!response.ok) throw new Error('Failed to fetch connection status');
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching connection status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchStatus();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
        <span className="text-xs text-gray-500">Checking...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
        <span className="text-xs text-yellow-600">Status unavailable</span>
      </div>
    );
  }

  const isConnected = status?.connected || false;
  const accountMode = status?.ib_gateway?.account_mode || status?.profile?.account_mode || 'unknown';
  const isLive = accountMode.toLowerCase() === 'live';
  const connectionType = status?.ib_gateway?.connection_type || status?.profile?.connection_type || 'gateway';

  if (!showDetails) {
    // Compact mode - just the indicator
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
        <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {isConnected ? (isLive ? 'LIVE' : 'Paper') : 'Disconnected'}
        </span>
      </div>
    );
  }

  // Detailed mode
  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {isConnected && (
              <span className={`px-1.5 py-0.5 text-xs rounded ${
                isLive 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-blue-100 text-blue-700 border border-blue-300'
              }`}>
                {accountMode.toUpperCase()}
              </span>
            )}
          </div>
          {isConnected && status?.ib_gateway && (
            <div className="text-xs text-gray-500 mt-0.5">
              {connectionType === 'tws' ? 'TWS' : 'Gateway'} @ {status.ib_gateway.host}:{status.ib_gateway.port}
            </div>
          )}
          {isConnected && status?.profile && (
            <div className="text-xs text-gray-400">
              Profile: {status.profile.name}
            </div>
          )}
        </div>
      </div>
      
      {!isConnected && (
        <a 
          href="/connections" 
          className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Configure connections →
        </a>
      )}
    </div>
  );
}

