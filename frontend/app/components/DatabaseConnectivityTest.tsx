'use client';

import React, { useState, useEffect } from 'react';

interface DatabaseTestResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  duration?: number;
}

interface DatabaseConnectivityStatus {
  overall: 'healthy' | 'unhealthy' | 'warning';
  tests: DatabaseTestResult[];
  connectionPool: {
    total: number;
    idle: number;
    waiting: number;
    active: number;
  };
  performance: {
    avgQueryTime: number;
    slowestQuery: number;
    totalQueries: number;
  };
  schema: {
    tablesExist: boolean;
    indexesExist: boolean;
    constraintsExist: boolean;
  };
  lastChecked: string;
}

interface DatabaseConnectivityTestProps {
  onStatusChange?: (status: DatabaseConnectivityStatus) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function DatabaseConnectivityTest({ 
  onStatusChange, 
  autoRefresh = false, 
  refreshInterval = 30000 
}: DatabaseConnectivityTestProps) {
  const [status, setStatus] = useState<DatabaseConnectivityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  // Run database connectivity tests
  const runConnectivityTests = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      // Run comprehensive database tests
      const response = await fetch(`${apiUrl}/api/database/connectivity-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setStatus(result);
      
      if (onStatusChange) {
        onStatusChange(result);
      }

    } catch (err) {
      console.error('Error running database connectivity tests:', err);
      setError(err instanceof Error ? err.message : 'Failed to run database tests');
      
      // Set error status
      const errorStatus: DatabaseConnectivityStatus = {
        overall: 'unhealthy',
        tests: [{
          test: 'Connection Test',
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
          duration: 0
        }],
        connectionPool: { total: 0, idle: 0, waiting: 0, active: 0 },
        performance: { avgQueryTime: 0, slowestQuery: 0, totalQueries: 0 },
        schema: { tablesExist: false, indexesExist: false, constraintsExist: false },
        lastChecked: new Date().toISOString()
      };
      
      setStatus(errorStatus);
      if (onStatusChange) {
        onStatusChange(errorStatus);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(runConnectivityTests, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Run tests on component mount
  useEffect(() => {
    runConnectivityTests();
  }, []);

  const toggleTestExpansion = (testName: string) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testName)) {
      newExpanded.delete(testName);
    } else {
      newExpanded.add(testName);
    }
    setExpandedTests(newExpanded);
  };

  const getStatusIcon = (testStatus: string) => {
    switch (testStatus) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (testStatus: string) => {
    switch (testStatus) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getOverallStatusColor = (overall: string) => {
    switch (overall) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">🗄️ Database Connectivity Test</h3>
        <div className="flex items-center space-x-2">
          {status && (
            <span className={`text-xs px-2 py-1 rounded ${
              status.overall === 'healthy' ? 'bg-green-100 text-green-800' :
              status.overall === 'warning' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {status.overall === 'healthy' ? 'Healthy' :
               status.overall === 'warning' ? 'Warning' : 'Unhealthy'}
            </span>
          )}
          <button
            onClick={runConnectivityTests}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Testing...' : 'Test Now'}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      {status && (
        <div className={`mb-6 p-4 rounded-md border ${getOverallStatusColor(status.overall)}`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Overall Database Status</h4>
              <p className="text-sm text-gray-600 mt-1">
                Last checked: {new Date(status.lastChecked).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl">
                {status.overall === 'healthy' ? '✅' :
                 status.overall === 'warning' ? '⚠️' : '❌'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">❌</span>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Connection Pool Status */}
      {status && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Connection Pool Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800 font-medium text-sm">Total</p>
              <p className="text-blue-700 text-lg">{status.connectionPool.total}</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 font-medium text-sm">Idle</p>
              <p className="text-green-700 text-lg">{status.connectionPool.idle}</p>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 font-medium text-sm">Active</p>
              <p className="text-yellow-700 text-lg">{status.connectionPool.active}</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 font-medium text-sm">Waiting</p>
              <p className="text-red-700 text-lg">{status.connectionPool.waiting}</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {status && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Performance Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
              <p className="text-purple-800 font-medium text-sm">Avg Query Time</p>
              <p className="text-purple-700 text-lg">{status.performance.avgQueryTime.toFixed(2)}ms</p>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-orange-800 font-medium text-sm">Slowest Query</p>
              <p className="text-orange-700 text-lg">{status.performance.slowestQuery.toFixed(2)}ms</p>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md">
              <p className="text-indigo-800 font-medium text-sm">Total Queries</p>
              <p className="text-indigo-700 text-lg">{status.performance.totalQueries}</p>
            </div>
          </div>
        </div>
      )}

      {/* Schema Status */}
      {status && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Schema Validation</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-3 rounded-md border ${
              status.schema.tablesExist ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                <span className={status.schema.tablesExist ? 'text-green-600' : 'text-red-600'}>
                  {status.schema.tablesExist ? '✅' : '❌'}
                </span>
                <span className={`font-medium text-sm ${
                  status.schema.tablesExist ? 'text-green-800' : 'text-red-800'
                }`}>
                  Tables
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-md border ${
              status.schema.indexesExist ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                <span className={status.schema.indexesExist ? 'text-green-600' : 'text-red-600'}>
                  {status.schema.indexesExist ? '✅' : '❌'}
                </span>
                <span className={`font-medium text-sm ${
                  status.schema.indexesExist ? 'text-green-800' : 'text-red-800'
                }`}>
                  Indexes
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-md border ${
              status.schema.constraintsExist ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                <span className={status.schema.constraintsExist ? 'text-green-600' : 'text-red-600'}>
                  {status.schema.constraintsExist ? '✅' : '❌'}
                </span>
                <span className={`font-medium text-sm ${
                  status.schema.constraintsExist ? 'text-green-800' : 'text-red-800'
                }`}>
                  Constraints
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Test Results */}
      {status && status.tests.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Detailed Test Results</h4>
          <div className="space-y-2">
            {status.tests.map((test, index) => (
              <div key={index} className="border border-gray-200 rounded-md">
                <button
                  onClick={() => toggleTestExpansion(test.test)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getStatusIcon(test.status)}</span>
                    <div>
                      <span className={`font-medium ${getStatusColor(test.status)}`}>
                        {test.test}
                      </span>
                      <p className="text-sm text-gray-600">{test.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {test.duration !== undefined && (
                      <span className="text-xs text-gray-500">
                        {test.duration.toFixed(2)}ms
                      </span>
                    )}
                    <span className="text-gray-400">
                      {expandedTests.has(test.test) ? '▼' : '▶'}
                    </span>
                  </div>
                </button>
                
                {expandedTests.has(test.test) && test.details && (
                  <div className="px-4 pb-3 border-t border-gray-100">
                    <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-refresh Toggle */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="text-sm font-medium text-gray-900">Auto-refresh</h5>
            <p className="text-xs text-gray-500">
              Automatically test database connectivity every {refreshInterval / 1000} seconds
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => {
                // This would need to be handled by parent component
                console.log('Auto-refresh toggle:', e.target.checked);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
