'use client';

import React, { useState, useEffect, useMemo } from 'react';
import EnhancedTradingChart from './EnhancedTradingChart';
import { useIBConnection } from '../contexts/IBConnectionContext';
import { getApiUrl } from '../utils/apiConfig';
import {
  REGIONS,
  PRODUCT_TYPES,
  CURRENCIES,
  getExchangesByCountry,
  getProductTypesForExchange,
  getCurrenciesForCountry,
  getDefaultExchange,
  getDefaultProductType,
  type Exchange,
  type ProductTypeConfig,
  type CurrencyConfig
} from '../config/exchanges';

// =============================================================================
// LOCAL INTERFACES
// =============================================================================

interface Timeframe {
  value: string;
  label: string;
  minutes: number;
}

interface ContractResult {
  conid: string;
  symbol: string;
  companyName: string;
  description: string;
  secType: string;
  currency?: string;
  exchange?: string;
  primaryExchange?: string;
  localSymbol?: string;
  tradingClass?: string;
  multiplier?: string;
  strike?: string;
  right?: string;
  expiry?: string;
  includeExpired?: boolean;
  comboLegsDescrip?: string;
  contractMonth?: string;
  industry?: string;
  category?: string;
  subcategory?: string;
  timeZoneId?: string;
  tradingHours?: string;
  liquidHours?: string;
  evRule?: string;
  evMultiplier?: string;
  secIdList?: any[];
  aggGroup?: string;
  underSymbol?: string;
  underSecType?: string;
  marketRuleIds?: string;
  realExpirationDate?: string;
  lastTradingDay?: string;
  stockType?: string;
  minSize?: string;
  sizeIncrement?: string;
  suggestedSizeIncrement?: string;
  sections?: any[];
}

interface MarketData {
  symbol: string;
  last?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
}

// =============================================================================
// STATIC DATA
// =============================================================================

const TIMEFRAMES: Timeframe[] = [
  { value: '1min', label: '1m', minutes: 1 },
  { value: '5min', label: '5m', minutes: 5 },
  { value: '15min', label: '15m', minutes: 15 },
  { value: '30min', label: '30m', minutes: 30 },
  { value: '1hour', label: '1h', minutes: 60 },
  { value: '4hour', label: '4h', minutes: 240 },
  { value: '8hour', label: '8h', minutes: 480 },
  { value: '1day', label: '1d', minutes: 1440 }
];

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

// =============================================================================
// COMPONENT
// =============================================================================

export default function MarketDataFilter() {
  const { accountMode, isLiveTrading, isConnected } = useIBConnection();
  const dataType = isLiveTrading ? 'real-time' : 'delayed';
  
  // Region and country state
  const [region, setRegion] = useState('AMERICAS');
  const [country, setCountry] = useState('US');
  
  // Basic filter state
  const [symbol, setSymbol] = useState('');
  const [securityType, setSecurityType] = useState('STK');
  const [exchange, setExchange] = useState('SMART');
  const [currency, setCurrency] = useState('USD');
  const [timeframe, setTimeframe] = useState('1hour');
  const [searchByName, setSearchByName] = useState(false);

  // Advanced filter state
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [strike, setStrike] = useState('');
  const [right, setRight] = useState('');
  const [multiplier, setMultiplier] = useState('');
  const [includeExpired, setIncludeExpired] = useState(false);

  // Results state
  const [searchResults, setSearchResults] = useState<ContractResult[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractResult | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);
  
  // Search history
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Track if search should be auto-triggered
  const [autoSearchTrigger, setAutoSearchTrigger] = useState<string | null>(null);

  // =============================================================================
  // MEMOIZED DATA
  // =============================================================================

  // Get current region configuration
  const currentRegion = useMemo(() => {
    return REGIONS.find(r => r.code === region);
  }, [region]);

  // Get countries for current region
  const availableCountries = useMemo(() => {
    return currentRegion?.countries || [];
  }, [currentRegion]);

  // Get exchanges for current country
  const availableExchanges = useMemo(() => {
    return getExchangesByCountry(country);
  }, [country]);

  // Get product types for current exchange
  const availableProductTypes = useMemo(() => {
    return getProductTypesForExchange(exchange);
  }, [exchange]);

  // Get currencies for current country
  const availableCurrencies = useMemo(() => {
    return getCurrenciesForCountry(country);
  }, [country]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Auto-trigger search when autoSearchTrigger changes
  useEffect(() => {
    if (autoSearchTrigger && symbol === autoSearchTrigger) {
      handleSearch();
      setAutoSearchTrigger(null);
    }
  }, [autoSearchTrigger, symbol]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  // Handle region change
  const handleRegionChange = (newRegion: string) => {
    const regionConfig = REGIONS.find(r => r.code === newRegion);
    if (!regionConfig) return;

    const defaultCountry = regionConfig.countries[0];
    const defaultExch = getDefaultExchange(defaultCountry.code);
    const defaultSecType = getDefaultProductType(defaultExch);

    setRegion(newRegion);
    setCountry(defaultCountry.code);
    setExchange(defaultExch);
    setSecurityType(defaultSecType);
    setCurrency(defaultCountry.currency);
    
    // Clear search results
    setSearchResults([]);
    setSelectedContract(null);
    setMarketData(null);
    setShowChart(false);
  };

  // Handle country change
  const handleCountryChange = (newCountry: string) => {
    const countryConfig = availableCountries.find(c => c.code === newCountry);
    if (!countryConfig) return;

    const defaultExch = getDefaultExchange(newCountry);
    const defaultSecType = getDefaultProductType(defaultExch);

    setCountry(newCountry);
    setExchange(defaultExch);
    setSecurityType(defaultSecType);
    setCurrency(countryConfig.currency);
    
    // Clear search results
    setSearchResults([]);
    setSelectedContract(null);
    setMarketData(null);
    setShowChart(false);
  };

  // Handle exchange change
  const handleExchangeChange = (newExchange: string) => {
    const exchangeConfig = availableExchanges.find(e => e.value === newExchange);
    if (!exchangeConfig) return;

    // Check if current secType is valid for new exchange
    const validSecTypes = getProductTypesForExchange(newExchange);
    const secTypeValid = validSecTypes.some(st => st.value === securityType);
    
    setExchange(newExchange);
    if (!secTypeValid && validSecTypes.length > 0) {
      setSecurityType(getDefaultProductType(newExchange));
    }
  };

  const handleSearch = async () => {
    if (!showAdvancedSearch && !symbol.trim()) {
      setError('Please enter a symbol to search');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResults([]);
    setSelectedContract(null);
    setMarketData(null);
    setShowChart(false);

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();

      const endpoint = showAdvancedSearch ? '/api/market-data/advanced-search' : '/api/market-data/search';
      
      // Use 'paper' as safe default if account mode is unknown
      const effectiveAccountMode = accountMode === 'unknown' ? 'paper' : accountMode;
      
      const searchPayload = showAdvancedSearch ? {
        symbol: symbol.trim().toUpperCase() || '',
        secType: securityType,
        exchange: exchange,
        currency: currency,
        expiry: expiry,
        strike: strike ? parseFloat(strike) : undefined,
        right: right,
        multiplier: multiplier,
        includeExpired: includeExpired,
        searchByName: searchByName,
        account_mode: effectiveAccountMode
      } : {
        symbol: symbol.trim().toUpperCase(),
        secType: securityType,
        exchange: exchange,
        currency: currency,
        searchByName: searchByName,
        account_mode: effectiveAccountMode
      };

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true',
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        
        if (symbol.trim()) {
          const newHistory = [symbol.trim().toUpperCase(), ...searchHistory.filter(h => h !== symbol.trim().toUpperCase())].slice(0, 10);
          setSearchHistory(newHistory);
        }
      } else {
        setError('No contracts found for the specified criteria');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleContractSelect = async (contract: ContractResult) => {
    setSelectedContract(contract);
    setMarketData(null);
    setLoading(true);

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();
      // Use 'paper' as safe default if account mode is unknown
      const effectiveAccountMode = accountMode === 'unknown' ? 'paper' : accountMode;
      const response = await fetch(
        `${backendUrl}/api/market-data/realtime?symbol=${contract.symbol}&conid=${contract.conid}&account_mode=${effectiveAccountMode}`,
        {
          headers: {
            'X-Data-Query-Enabled': 'true',
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMarketData(data);
      }
    } catch (err) {
      console.error('Market data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowChart = () => {
    setShowChart(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleQuickSearch = async (quickSymbol: string) => {
    setError(null);
    setSearchResults([]);
    setSelectedContract(null);
    setMarketData(null);
    setShowChart(false);
    
    setSymbol(quickSymbol);
    // Use current exchange settings instead of resetting to defaults
    // This respects the user's selected region/country/exchange configuration
    // Only reset security type to STK for quick stock searches
    setSecurityType('STK');
    // Keep current exchange and currency based on selected region/country
    
    setAutoSearchTrigger(quickSymbol);
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Quick Search */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-base sm:text-lg">⚡</span>
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Quick Search</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {POPULAR_SYMBOLS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => handleQuickSearch(item.symbol)}
              className="p-2 text-xs sm:text-sm bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-md transition-colors"
            >
              <div className="font-medium truncate">{item.symbol}</div>
              <div className="text-xs text-gray-500 truncate">{item.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Search Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-base sm:text-lg">🔍</span>
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Search Filters</h3>
        </div>

        {/* Region and Country Selection */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Region Selection */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Market Region
              </label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => handleRegionChange(r.code)}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors ${
                      region === r.code
                        ? r.code === 'GLOBAL'
                          ? 'bg-purple-600 text-white'
                          : r.code === 'AU'
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Country Selection (only show if region has multiple countries) */}
            {availableCountries.length > 1 && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCountries.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleCountryChange(c.code)}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors ${
                        country === c.code
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {/* Symbol Search */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Symbol / Company Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., AAPL, Microsoft"
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute left-2 sm:left-3 top-2.5 text-gray-400 text-xs sm:text-sm">🔍</span>
            </div>
            <div className="mt-1">
              <label className="flex items-center text-xs sm:text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={searchByName}
                  onChange={(e) => setSearchByName(e.target.checked)}
                  className="mr-2"
                />
                Search by company name
              </label>
            </div>
            
            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Recent searches:</div>
                <div className="flex flex-wrap gap-1">
                  {searchHistory.slice(0, 5).map((item) => (
                    <button
                      key={item}
                      onClick={() => handleQuickSearch(item)}
                      className="text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security Type */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Security Type
              <span className="text-xs text-gray-500 ml-1">({availableProductTypes.length} for {exchange})</span>
            </label>
            <select
              value={securityType}
              onChange={(e) => setSecurityType(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableProductTypes.length > 0 ? (
                availableProductTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))
              ) : (
                PRODUCT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Exchange */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Exchange
              <span className="text-xs text-gray-500 ml-1">({availableExchanges.length} available)</span>
            </label>
            <select
              value={exchange}
              onChange={(e) => handleExchangeChange(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableExchanges.map((ex) => (
                <option key={ex.value} value={ex.value}>
                  {ex.label} - {ex.description}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableCurrencies.map((curr) => (
                <option key={curr.value} value={curr.value}>
                  {curr.label} - {curr.description}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf.value} value={tf.value}>
                  {tf.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exchange Info */}
        {availableExchanges.find(e => e.value === exchange) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
            <p className="text-xs text-blue-800">
              <span className="font-medium">{exchange}</span>: {availableExchanges.find(e => e.value === exchange)?.description}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Available products: {availableExchanges.find(e => e.value === exchange)?.products.join(', ')}
            </p>
          </div>
        )}

        {/* Advanced Search Toggle */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>{showAdvancedSearch ? '▼' : '▶'}</span>
            <span>Advanced Search Options</span>
          </button>
        </div>

        {/* Advanced Search Fields */}
        {showAdvancedSearch && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 p-3 sm:p-4 bg-gray-50 rounded-md">
            {/* Expiry Date */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="YYYYMMDD or YYYYMM"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Strike Price */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Strike Price
              </label>
              <input
                type="number"
                step="0.01"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                placeholder="e.g., 150.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Option Right */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Option Right
              </label>
              <select
                value={right}
                onChange={(e) => setRight(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Any</option>
                <option value="C">Call</option>
                <option value="P">Put</option>
              </select>
            </div>

            {/* Multiplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multiplier
              </label>
              <input
                type="text"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                placeholder="e.g., 100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Include Expired */}
            <div className="flex items-center">
              <label className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="mr-2"
                />
                Include Expired Contracts
              </label>
            </div>
          </div>
        )}

        {/* Search Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              setSymbol('');
              setSearchResults([]);
              setSelectedContract(null);
              setMarketData(null);
              setShowChart(false);
              setError(null);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            Clear Search
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={handleSearch}
              disabled={loading || (!showAdvancedSearch && !symbol.trim())}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <span className="animate-spin">↻</span>
              ) : (
                <span>🔍</span>
              )}
              <span>{loading ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">❌ {error}</div>
        </div>
      )}

      {/* Search Tips */}
      {!searchResults.length && !loading && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 text-lg">💡</span>
            <div>
              <div className="text-blue-800 font-medium mb-1">Search Tips:</div>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• <strong>Region:</strong> Select Americas for US, Canada, Mexico, or Brazil markets</li>
                <li>• <strong>Exchange filtering:</strong> Product types automatically update based on selected exchange</li>
                <li>• Use Quick Search buttons for popular US stocks</li>
                <li>• Try searching by company name (check "Search by company name")</li>
                <li>• Use Advanced Search for options, futures, and specific criteria</li>
                <li>• For futures options (FOP): Available on CME, CBOT, NYMEX, COMEX</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            📊 Search Results ({searchResults.length})
          </h3>
          <div className="space-y-3">
            {searchResults.map((contract) => (
              <div
                key={contract.conid}
                onClick={() => handleContractSelect(contract)}
                className={`p-4 border rounded-md cursor-pointer transition-colors ${
                  selectedContract?.conid === contract.conid
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="font-medium text-gray-900">
                        {contract.symbol}
                      </div>
                      <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {contract.secType}
                      </div>
                      {contract.exchange && contract.exchange !== 'SMART' && (
                        <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {contract.exchange}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-2">
                      {contract.companyName}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                      {contract.currency && (
                        <div>Currency: {contract.currency}</div>
                      )}
                      {contract.primaryExchange && (
                        <div>Primary: {contract.primaryExchange}</div>
                      )}
                      {contract.expiry && (
                        <div>Expiry: {contract.expiry}</div>
                      )}
                      {contract.strike && (
                        <div>Strike: {contract.strike}</div>
                      )}
                      {contract.right && (
                        <div>Right: {contract.right === 'C' ? 'Call' : 'Put'}</div>
                      )}
                      {contract.multiplier && (
                        <div>Multiplier: {contract.multiplier}</div>
                      )}
                      {contract.tradingClass && (
                        <div>Class: {contract.tradingClass}</div>
                      )}
                      {contract.industry && (
                        <div>Industry: {contract.industry}</div>
                      )}
                    </div>
                    
                    {contract.tradingHours && (
                      <div className="text-xs text-gray-500 mt-1">
                        Trading Hours: {contract.tradingHours}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 ml-4">
                    <div>ID: {contract.conid}</div>
                    {contract.localSymbol && (
                      <div>Local: {contract.localSymbol}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Data Display */}
      {selectedContract && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-lg text-green-500">📈</span>
              <h3 className="text-lg font-medium text-gray-900">
                Market Data - {selectedContract.symbol}
              </h3>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleShowChart}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center space-x-2"
              >
                <span>📊</span>
                <span>View Chart</span>
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="animate-spin mr-2">↻</span>
              <span className="text-gray-600">Loading market data...</span>
            </div>
          ) : marketData ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">Last Price</div>
                <div className="text-xl font-bold text-gray-900">
                  ${marketData.last?.toFixed(2) || 'N/A'}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">Bid</div>
                <div className="text-xl font-bold text-blue-600">
                  ${marketData.bid?.toFixed(2) || 'N/A'}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">Ask</div>
                <div className="text-xl font-bold text-red-600">
                  ${marketData.ask?.toFixed(2) || 'N/A'}
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-md">
                <div className="text-sm text-gray-600">Volume</div>
                <div className="text-xl font-bold text-gray-900">
                  {marketData.volume?.toLocaleString() || 'N/A'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No market data available
            </div>
          )}
        </div>
      )}

      {/* Enhanced Trading Chart */}
      {selectedContract && showChart && (
        <EnhancedTradingChart
          contract={selectedContract}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />
      )}
    </div>
  );
}
