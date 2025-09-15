'use client';

import React from 'react';
import ExchangeDrivenFilters from './ExchangeDrivenFilters';
import PeriodDateFilters from './PeriodDateFilters';

export interface DownloadConfig {
  // Common filter states
  exchangeFilters: {
    region: 'US' | 'AU';
    exchange: string;
    secType: string;
    symbol: string;
    currency: string;
    searchTerm: string;
  };
  periodFilters: {
    period: string;
    startDate?: string;
    endDate?: string;
    useDateRange: boolean;
  };
  // Feature-specific configurations
  timeframe?: string; // Single symbol
  bulkSymbols?: string; // Bulk collection & validation
  bulkTimeframes?: string[]; // Bulk collection & validation
}

export interface DownloadConfigPanelProps {
  config: DownloadConfig;
  onConfigChange: (updates: Partial<DownloadConfig>) => void;
  mode: 'single' | 'bulk' | 'validation';
  disabled?: boolean;
  timeframes: Array<{ label: string; value: string }>;
}

export default function DownloadConfigPanel({
  config,
  onConfigChange,
  mode,
  disabled = false,
  timeframes
}: DownloadConfigPanelProps) {
  
  const handleExchangeFiltersChange = (exchangeFilters: DownloadConfig['exchangeFilters']) => {
    onConfigChange({ exchangeFilters });
  };

  const handlePeriodFiltersChange = (periodFilters: DownloadConfig['periodFilters']) => {
    onConfigChange({ periodFilters });
  };

  const handleTimeframeChange = (timeframe: string) => {
    onConfigChange({ timeframe });
  };

  const handleBulkSymbolsChange = (bulkSymbols: string) => {
    onConfigChange({ bulkSymbols });
  };

  const handleBulkTimeframesChange = (timeframeValue: string, checked: boolean) => {
    const currentTimeframes = config.bulkTimeframes || [];
    const newTimeframes = checked
      ? [...currentTimeframes, timeframeValue]
      : currentTimeframes.filter(t => t !== timeframeValue);
    onConfigChange({ bulkTimeframes: newTimeframes });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exchange-Driven Filters - Common to all modes */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Market & Symbol</h3>
          <ExchangeDrivenFilters
            onFiltersChange={handleExchangeFiltersChange}
            disabled={disabled}
          />
          
          {/* Bulk symbols input for bulk and validation modes */}
          {(mode === 'bulk' || mode === 'validation') && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'bulk' ? 'Symbols (comma-separated)' : 'Symbols to Validate'}
              </label>
              <textarea
                value={config.bulkSymbols || ''}
                onChange={(e) => handleBulkSymbolsChange(e.target.value)}
                placeholder="MSFT,AAPL,GOOGL,AMZN,TSLA"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter symbols separated by commas (e.g., MSFT,AAPL,GOOGL)
              </p>
            </div>
          )}
        </div>

        {/* Period & Date Filters - Common to all modes */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">Time Period</h3>
          <PeriodDateFilters
            onFiltersChange={handlePeriodFiltersChange}
            disabled={disabled}
          />
        </div>

        {/* Timeframe Selection - Varies by mode */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            {mode === 'single' ? 'Download Settings' : 'Timeframe Selection'}
          </h3>
          
          {mode === 'single' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeframe
              </label>
              <select
                value={config.timeframe || '1hour'}
                onChange={(e) => handleTimeframeChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              >
                {timeframes.map((tf) => (
                  <option key={tf.value} value={tf.value}>
                    {tf.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === 'bulk' || mode === 'validation') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'bulk' ? 'Timeframes' : 'Timeframes to Validate'}
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                {timeframes.map((tf) => (
                  <label key={tf.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={(config.bulkTimeframes || []).includes(tf.value)}
                      onChange={(e) => handleBulkTimeframesChange(tf.value, e.target.checked)}
                      disabled={disabled}
                      className="rounded"
                    />
                    <span className="text-sm">{tf.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
