'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BackToHome from '../components/BackToHome';
import ConnectionStatusIndicator from '../components/ConnectionStatusIndicator';
import { getApiUrl } from '../utils/apiConfig';

interface SymbolTimeframe {
  timeframe: string;
  bar_count: number;
  earliest_date: string | null;
  latest_date: string | null;
}

interface SymbolData {
  symbol: string;
  timeframes: SymbolTimeframe[];
}

interface DatabaseSymbolsResponse {
  symbols: SymbolData[];
  total_symbols: number;
  timestamp: string;
}

const TIMEFRAMES = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '30m', value: '30min' },
  { label: '1h', value: '1hour' },
  { label: '4h', value: '4hour' },
  { label: '8h', value: '8hour' },
  { label: '1D', value: '1day' },
];

export default function ChartLandingPage() {
  const router = useRouter();
  const [databaseSymbols, setDatabaseSymbols] = useState<SymbolData[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  
  // Search/input state
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1hour');
  const [openFullscreen, setOpenFullscreen] = useState(true);

  // Fetch symbols available in database
  useEffect(() => {
    const fetchDatabaseSymbols = async () => {
      setIsLoadingSymbols(true);
      setSymbolsError(null);
      
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/market-data/database/symbols`, {
          headers: { 'X-Data-Query-Enabled': 'true' }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch symbols: ${response.status}`);
        }
        
        const data: DatabaseSymbolsResponse = await response.json();
        setDatabaseSymbols(data.symbols || []);
      } catch (err) {
        console.error('Error fetching database symbols:', err);
        setSymbolsError(err instanceof Error ? err.message : 'Failed to fetch symbols');
      } finally {
        setIsLoadingSymbols(false);
      }
    };

    fetchDatabaseSymbols();
  }, []);

  // Navigate to chart
  const navigateToChart = (symbol: string, timeframe: string) => {
    const url = openFullscreen 
      ? `/chart/${symbol.toUpperCase()}/${timeframe}?fullscreen=true`
      : `/chart/${symbol.toUpperCase()}/${timeframe}`;
    
    if (openFullscreen) {
      window.open(url, '_blank');
    } else {
      router.push(url);
    }
  };

  // Handle search form submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSymbol.trim()) {
      navigateToChart(searchSymbol.trim(), selectedTimeframe);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get timeframe label
  const getTimeframeLabel = (value: string) => {
    return TIMEFRAMES.find(tf => tf.value === value)?.label || value;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <BackToHome />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Symbol Chart</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">View charts from database or fetch from API</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ConnectionStatusIndicator showDetails={true} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Search/Load New Symbol Section */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>🔍</span> Load Chart
          </h2>
          
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Symbol Input */}
              <div className="sm:col-span-2">
                <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-1">
                  Symbol
                </label>
                <input
                  id="symbol"
                  type="text"
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                  placeholder="Enter symbol (e.g., AAPL, MSFT)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  maxLength={10}
                />
              </div>

              {/* Timeframe Select */}
              <div>
                <label htmlFor="timeframe" className="block text-sm font-medium text-gray-700 mb-1">
                  Timeframe
                </label>
                <select
                  id="timeframe"
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf.value} value={tf.value}>
                      {tf.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Load Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={!searchSymbol.trim()}
                  className="w-full px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Load Chart
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openFullscreen}
                  onChange={(e) => setOpenFullscreen(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                Open in new tab (fullscreen)
              </label>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 How it works:</strong> Data is fetched from the database first. If no data exists, 
              it will be requested from the IB Gateway API and stored for future use.
            </p>
          </div>
        </div>

        {/* Database Symbols Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>📊</span> Symbols in Database
            </h2>
            {databaseSymbols.length > 0 && (
              <span className="text-sm text-gray-500">
                {databaseSymbols.length} symbol{databaseSymbols.length !== 1 ? 's' : ''} available
              </span>
            )}
          </div>

          {/* Loading State */}
          {isLoadingSymbols && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                <span className="text-gray-600">Loading symbols from database...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {symbolsError && !isLoadingSymbols && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {symbolsError}
              </p>
              <p className="text-xs text-red-600 mt-1">
                You can still search for symbols above - they will be fetched from the API.
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingSymbols && !symbolsError && databaseSymbols.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No symbols in database yet</h3>
              <p className="text-gray-600 mb-4">
                Use the search above to load a chart. Data will be fetched from the API and stored in the database.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="text-sm text-gray-500">Quick start:</span>
                {['MSFT', 'AAPL', 'GOOGL', 'AMZN', 'TSLA'].map((symbol) => (
                  <button
                    key={symbol}
                    onClick={() => navigateToChart(symbol, '1hour')}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symbols Grid */}
          {!isLoadingSymbols && !symbolsError && databaseSymbols.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {databaseSymbols.map((symbolData) => (
                <div
                  key={symbolData.symbol}
                  className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
                >
                  {/* Symbol Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900">{symbolData.symbol}</h3>
                    <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                      {symbolData.timeframes.length} timeframe{symbolData.timeframes.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Timeframes */}
                  <div className="space-y-2">
                    {symbolData.timeframes.map((tf) => (
                      <button
                        key={tf.timeframe}
                        onClick={() => navigateToChart(symbolData.symbol, tf.timeframe)}
                        className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-emerald-50 rounded-md transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">
                            {getTimeframeLabel(tf.timeframe)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({tf.bar_count.toLocaleString()} bars)
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 group-hover:text-emerald-600">
                          {formatDate(tf.latest_date)} →
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex gap-2">
                      {TIMEFRAMES.slice(0, 4).map((tf) => {
                        const hasData = symbolData.timeframes.some(t => t.timeframe === tf.value);
                        return (
                          <button
                            key={tf.value}
                            onClick={() => navigateToChart(symbolData.symbol, tf.value)}
                            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                              hasData
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={hasData ? 'Data available' : 'Will fetch from API'}
                          >
                            {tf.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Access Section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>⚡</span> Quick Access
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Popular symbols - click to view chart (data will be fetched if not in database)
          </p>
          <div className="flex flex-wrap gap-2">
            {['MSFT', 'AAPL', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'SPY', 'QQQ', 'IWM'].map((symbol) => {
              const inDatabase = databaseSymbols.some(s => s.symbol === symbol);
              return (
                <button
                  key={symbol}
                  onClick={() => navigateToChart(symbol, '1hour')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    inDatabase
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {symbol}
                  {inDatabase && <span className="ml-1 text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
