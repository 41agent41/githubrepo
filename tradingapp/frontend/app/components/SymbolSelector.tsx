'use client';

import React, { useState, useEffect } from 'react';
import { useTradingAccount } from '../contexts/TradingAccountContext';

interface ContractResult {
  conid: string;
  symbol: string;
  companyName: string;
  description: string;
  secType: string;
  currency?: string;
  exchange?: string;
  primaryExchange?: string;
}

interface SymbolSelectorProps {
  selectedContract: ContractResult | null;
  onContractSelect: (contract: ContractResult | null) => void;
  disabled?: boolean;
}

const POPULAR_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' }
];

export default function SymbolSelector({
  selectedContract,
  onContractSelect,
  disabled = false
}: SymbolSelectorProps) {
  const { accountMode } = useTradingAccount();
  const [symbol, setSymbol] = useState('');
  const [searchResults, setSearchResults] = useState<ContractResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!symbol.trim() || disabled) return;

    setLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!backendUrl) {
        throw new Error('API URL not configured');
      }

      const response = await fetch(`${backendUrl}/api/market-data/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          secType: 'STK',
          exchange: 'SMART',
          currency: 'USD',
          searchByName: false,
          account_mode: accountMode
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setShowResults(true);
      } else {
        setError('No contracts found for the specified symbol');
        setShowResults(false);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (quickSymbol: string) => {
    if (disabled) return;
    setSymbol(quickSymbol);
    setError(null);
    setSearchResults([]);
    setShowResults(false);
    // Auto-search after setting symbol
    setTimeout(() => {
      setSymbol(quickSymbol);
      handleSearch();
    }, 100);
  };

  const handleContractSelect = (contract: ContractResult) => {
    if (disabled) return;
    onContractSelect(contract);
    setShowResults(false);
    setSymbol(contract.symbol);
  };

  const handleClear = () => {
    if (disabled) return;
    onContractSelect(null);
    setSymbol('');
    setSearchResults([]);
    setShowResults(false);
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !disabled) {
      handleSearch();
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-lg">🔍</span>
        <h3 className="font-medium text-gray-900">Select Symbol</h3>
        {selectedContract && (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
            {selectedContract.symbol}
          </span>
        )}
      </div>

      {/* Quick Search */}
      <div className="mb-4">
        <div className="text-xs text-gray-600 mb-2">Quick Search:</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {POPULAR_SYMBOLS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => handleQuickSearch(item.symbol)}
              disabled={disabled}
              className="p-2 text-xs sm:text-sm bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-md transition-colors disabled:opacity-50"
            >
              <div className="font-medium truncate">{item.symbol}</div>
              <div className="text-xs text-gray-500 truncate">{item.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Symbol Search */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter symbol (e.g., MSFT, AAPL)"
            disabled={disabled}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <button
            onClick={handleSearch}
            disabled={loading || !symbol.trim() || disabled}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">↻</span>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <span>🔍</span>
                <span>Search</span>
              </>
            )}
          </button>
          {selectedContract && (
            <button
              onClick={handleClear}
              disabled={disabled}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">❌ {error}</div>
        </div>
      )}

      {/* Selected Contract Display */}
      {selectedContract && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <div className="font-semibold text-gray-900 text-lg">
                  {selectedContract.symbol}
                </div>
                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {selectedContract.secType}
                </div>
                {selectedContract.exchange && selectedContract.exchange !== 'SMART' && (
                  <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {selectedContract.exchange}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-700">
                {selectedContract.companyName || selectedContract.description}
              </div>
              {selectedContract.currency && (
                <div className="text-xs text-gray-500 mt-1">
                  Currency: {selectedContract.currency}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {showResults && searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
          <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            {searchResults.length} result(s) found
          </div>
          <div className="divide-y divide-gray-200">
            {searchResults.map((contract) => (
              <div
                key={contract.conid}
                onClick={() => handleContractSelect(contract)}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedContract?.conid === contract.conid
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="font-medium text-gray-900">
                        {contract.symbol}
                      </div>
                      <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {contract.secType}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">
                      {contract.companyName || contract.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

