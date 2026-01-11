'use client';

import { useState, useRef, useEffect } from 'react';
import { useIBConnection, IBConnectionProfile } from '../contexts/IBConnectionContext';

interface ConnectionStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export default function ConnectionStatusIndicator({ 
  showDetails = false,
  className = ''
}: ConnectionStatusIndicatorProps) {
  const {
    connectionStatus,
    activeProfile,
    isConnected,
    accountMode,
    connectionType,
    isLoading,
    error,
    profiles,
    refresh,
    activateProfile,
    deactivateProfile,
    fetchProfiles
  } = useIBConnection();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch profiles when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      fetchProfiles();
    }
  }, [showDropdown, fetchProfiles]);

  const handleToggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleActivate = async (profileId: number) => {
    setActionInProgress(profileId);
    try {
      await activateProfile(profileId);
      setShowDropdown(false);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeactivate = async (profileId: number) => {
    setActionInProgress(profileId);
    try {
      await deactivateProfile(profileId);
      setShowDropdown(false);
    } finally {
      setActionInProgress(null);
    }
  };

  const isLive = accountMode === 'live';

  if (isLoading && !connectionStatus) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
        <span className="text-xs text-gray-500">Checking...</span>
      </div>
    );
  }

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

  // Detailed mode with dropdown
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        onClick={handleToggleDropdown}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
        <div className="text-left">
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
          {isConnected && activeProfile && (
            <div className="text-xs text-gray-500 mt-0.5">
              {connectionType === 'tws' ? 'TWS' : 'Gateway'} @ {connectionStatus?.ib_gateway?.host}:{connectionStatus?.ib_gateway?.port}
            </div>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">IB Connections</h3>
              <button 
                onClick={() => refresh()}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                ↻ Refresh
              </button>
            </div>
            {activeProfile && (
              <div className="mt-2 text-xs text-gray-600">
                Active: <span className="font-medium">{activeProfile.name}</span>
              </div>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {profiles.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No connection profiles found.
                <a href="/connections" className="block mt-2 text-blue-600 hover:text-blue-800">
                  Configure connections →
                </a>
              </div>
            ) : (
              <div className="py-1">
                {profiles.map((profile) => (
                  <div 
                    key={profile.id}
                    className={`px-3 py-2 hover:bg-gray-50 ${
                      profile.is_active ? 'bg-green-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            profile.is_active && isConnected ? 'bg-green-500' : 'bg-gray-300'
                          }`}></span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {profile.name}
                          </span>
                          {profile.is_default && (
                            <span className="px-1 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                              Default
                            </span>
                          )}
                          <span className={`px-1 py-0.5 text-xs rounded ${
                            profile.account_mode === 'live'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {profile.account_mode.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 ml-4">
                          {profile.connection_type === 'tws' ? 'TWS' : 'Gateway'} @ {profile.host}:{profile.port}
                        </div>
                      </div>
                      
                      <div className="ml-2">
                        {profile.is_active ? (
                          <button
                            onClick={() => handleDeactivate(profile.id!)}
                            disabled={actionInProgress !== null}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            {actionInProgress === profile.id ? '...' : 'Disconnect'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(profile.id!)}
                            disabled={actionInProgress !== null}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            {actionInProgress === profile.id ? '...' : 'Connect'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
            <a 
              href="/connections" 
              className="block w-full text-center text-xs text-blue-600 hover:text-blue-800 py-1"
            >
              Manage all connections →
            </a>
          </div>

          {/* Live Trading Warning */}
          {isConnected && isLive && (
            <div className="p-2 bg-red-50 border-t border-red-200 rounded-b-lg">
              <div className="flex items-center gap-2 text-xs text-red-700">
                <span>⚠️</span>
                <span><strong>LIVE MODE</strong> - Real money trades</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Disconnected call to action */}
      {!isConnected && !showDropdown && (
        <a 
          href="/connections" 
          className="absolute top-full right-0 mt-1 text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
        >
          Configure connections →
        </a>
      )}
    </div>
  );
}
