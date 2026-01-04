'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import {
  REGIONS,
  CURRENCIES,
  POPULAR_SYMBOLS,
  PRODUCT_TYPES,
  getExchangesByRegion,
  getExchangesByCountry,
  getProductTypesForExchange,
  getCurrenciesForCountry,
  getPopularSymbolsForExchange,
  getDefaultExchange,
  getDefaultProductType,
  getCountryForExchange,
  type Exchange,
  type ProductType,
  type ProductTypeConfig,
  type CurrencyConfig
} from '../config/exchanges';

// =============================================================================
// INTERFACES
// =============================================================================

interface FilterState {
  region: string;
  country: string;
  exchange: string;
  secType: string;
  symbol: string;
  currency: string;
  searchTerm: string;
}

interface ExchangeDrivenFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExchangeDrivenFilters({ onFiltersChange, disabled = false }: ExchangeDrivenFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    region: 'AMERICAS',
    country: 'US',
    exchange: 'SMART',
    secType: 'STK',
    symbol: '',
    currency: 'USD',
    searchTerm: ''
  });

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // =============================================================================
  // MEMOIZED DATA GETTERS
  // =============================================================================

  // Get region configuration
  const currentRegion = useMemo(() => {
    return REGIONS.find(r => r.code === filters.region);
  }, [filters.region]);

  // Get countries for current region
  const availableCountries = useMemo(() => {
    return currentRegion?.countries || [];
  }, [currentRegion]);

  // Get exchanges for current country
  const availableExchanges = useMemo(() => {
    return getExchangesByCountry(filters.country);
  }, [filters.country]);

  // Get product types for current exchange
  const availableProductTypes = useMemo(() => {
    return getProductTypesForExchange(filters.exchange);
  }, [filters.exchange]);

  // Get currencies for current country
  const availableCurrencies = useMemo(() => {
    return getCurrenciesForCountry(filters.country);
  }, [filters.country]);

  // Get popular symbols for current exchange and product type
  const popularSymbols = useMemo(() => {
    return getPopularSymbolsForExchange(filters.exchange, filters.secType);
  }, [filters.exchange, filters.secType]);

  // =============================================================================
  // FILTER UPDATE HANDLERS
  // =============================================================================

  // Handle region change
  const handleRegionChange = (regionCode: string) => {
    const region = REGIONS.find(r => r.code === regionCode);
    if (!region) return;

    const defaultCountry = region.countries[0];
    const defaultExchange = getDefaultExchange(defaultCountry.code);
    const defaultSecType = getDefaultProductType(defaultExchange);

    const newFilters: FilterState = {
      region: regionCode,
      country: defaultCountry.code,
      exchange: defaultExchange,
      secType: defaultSecType,
      symbol: '',
      currency: defaultCountry.currency,
      searchTerm: ''
    };

    setFilters(newFilters);
    onFiltersChange(newFilters);
    setSearchResults([]);
  };

  // Handle country change (within Americas region)
  const handleCountryChange = (countryCode: string) => {
    const country = availableCountries.find(c => c.code === countryCode);
    if (!country) return;

    const defaultExchange = getDefaultExchange(countryCode);
    const defaultSecType = getDefaultProductType(defaultExchange);

    const newFilters: FilterState = {
      ...filters,
      country: countryCode,
      exchange: defaultExchange,
      secType: defaultSecType,
      symbol: '',
      currency: country.currency,
      searchTerm: ''
    };

    setFilters(newFilters);
    onFiltersChange(newFilters);
    setSearchResults([]);
  };

  // Handle exchange change
  const handleExchangeChange = (exchangeCode: string) => {
    const exchange = availableExchanges.find(e => e.value === exchangeCode);
    if (!exchange) return;

    // Check if current secType is valid for new exchange
    const validSecTypes = getProductTypesForExchange(exchangeCode);
    const secTypeValid = validSecTypes.some(st => st.value === filters.secType);
    const newSecType = secTypeValid ? filters.secType : getDefaultProductType(exchangeCode);

    const newFilters: FilterState = {
      ...filters,
      exchange: exchangeCode,
      secType: newSecType,
      symbol: '',
      searchTerm: ''
    };

    setFilters(newFilters);
    onFiltersChange(newFilters);
    setSearchResults([]);
  };

  // Handle security type change
  const handleSecTypeChange = (secType: string) => {
    const newFilters: FilterState = {
      ...filters,
      secType,
      symbol: '',
      searchTerm: ''
    };

    setFilters(newFilters);
    onFiltersChange(newFilters);
    setSearchResults([]);
  };

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    const newFilters: FilterState = {
      ...filters,
      symbol: symbol.toUpperCase(),
      searchTerm: symbol
    };

    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Handle currency change
  const handleCurrencyChange = (currency: string) => {
    const newFilters: FilterState = {
      ...filters,
      currency
    };

    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // =============================================================================
  // SYMBOL SEARCH
  // =============================================================================

  const searchSymbols = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use dynamic API URL that auto-detects correct backend address
      const apiUrl = getApiUrl();

      // Use the enhanced symbol discovery endpoint
      const response = await fetch(`${apiUrl}/api/market-data/symbols/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Data-Query-Enabled': 'true',
        },
        body: JSON.stringify({
          pattern: searchTerm,
          secType: filters.secType,
          exchange: filters.exchange,
          currency: filters.currency,
          max_results: 20,
          use_fallback: true,
          account_mode: 'paper'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Symbol discovery: Found ${data.count} results using ${data.method}${data.cached ? ' (cached)' : ''}`);
        setSearchResults(data.results || []);
      } else {
        console.error('Symbol discovery failed:', response.statusText);
        
        // Fallback to the old search method
        try {
          const fallbackResponse = await fetch(`${apiUrl}/api/market-data/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Data-Query-Enabled': 'true',
            },
            body: JSON.stringify({
              symbol: searchTerm,
              secType: filters.secType,
              exchange: filters.exchange,
              currency: filters.currency,
              account_mode: 'paper'
            })
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log('Fallback search successful');
            setSearchResults(fallbackData.results || []);
          } else {
            setSearchResults([]);
          }
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError);
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error in symbol discovery:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.searchTerm && filters.searchTerm.length >= 1) {
        searchSymbols(filters.searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters.searchTerm, filters.exchange, filters.secType, filters.currency]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-4">
      {/* Region Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Market Region
        </label>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((region) => (
            <button
              key={region.code}
              onClick={() => handleRegionChange(region.code)}
              disabled={disabled}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                filters.region === region.code
                  ? region.code === 'GLOBAL'
                    ? 'bg-purple-600 text-white'
                    : region.code === 'AU'
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {region.label}
            </button>
          ))}
        </div>
      </div>

      {/* Country Selection (only show if region has multiple countries) */}
      {availableCountries.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country
          </label>
          <div className="flex flex-wrap gap-2">
            {availableCountries.map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountryChange(country.code)}
                disabled={disabled}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  filters.country === country.code
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {country.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exchange Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Exchange
          <span className="text-xs text-gray-500 ml-2">({availableExchanges.length} available)</span>
        </label>
        <select
          value={filters.exchange}
          onChange={(e) => handleExchangeChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {availableExchanges.map((exchange) => (
            <option key={exchange.value} value={exchange.value}>
              {exchange.label} - {exchange.description}
            </option>
          ))}
        </select>
        {availableExchanges.find(e => e.value === filters.exchange) && (
          <p className="text-xs text-gray-500 mt-1">
            Products: {availableExchanges.find(e => e.value === filters.exchange)?.products.join(', ')}
          </p>
        )}
      </div>

      {/* Security Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product Type
          <span className="text-xs text-gray-500 ml-2">({availableProductTypes.length} for this exchange)</span>
        </label>
        <select
          value={filters.secType}
          onChange={(e) => handleSecTypeChange(e.target.value)}
          disabled={disabled || availableProductTypes.length === 0}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {availableProductTypes.map((productType) => (
            <option key={productType.value} value={productType.value}>
              {productType.label} - {productType.description}
            </option>
          ))}
        </select>
      </div>

      {/* Symbol Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Symbol
        </label>
        <div className="relative">
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => handleSymbolChange(e.target.value)}
            placeholder="Search for symbols..."
            disabled={disabled}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isSearching && (
            <div className="absolute right-3 top-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => {
                  handleSymbolChange(result.symbol);
                  setSearchResults([]);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium">{result.symbol}</div>
                <div className="text-xs text-gray-500">{result.companyName || result.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Popular Symbols */}
        {!filters.searchTerm && popularSymbols.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Popular symbols:</p>
            <div className="flex flex-wrap gap-1">
              {popularSymbols.slice(0, 10).map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolChange(symbol)}
                  disabled={disabled}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    filters.symbol === symbol
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Currency Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Currency
        </label>
        <select
          value={filters.currency}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {availableCurrencies.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.label} - {currency.description}
            </option>
          ))}
        </select>
      </div>

      {/* Current Selection Summary */}
      {filters.symbol && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Selected:</span> {filters.symbol}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Exchange: {filters.exchange} | Type: {filters.secType} | Currency: {filters.currency}
          </p>
          <p className="text-xs text-blue-500 mt-0.5">
            Region: {currentRegion?.label} {availableCountries.length > 1 ? `/ ${filters.country}` : ''}
          </p>
        </div>
      )}

      {/* Exchange Info Card */}
      {!filters.symbol && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-xs text-gray-600">
            <span className="font-medium">{filters.exchange}</span>: {availableExchanges.find(e => e.value === filters.exchange)?.description}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Available products: {availableProductTypes.map(pt => pt.label).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
