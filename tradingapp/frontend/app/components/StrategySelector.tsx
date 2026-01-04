'use client';

import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/apiConfig';

interface StrategyMetadata {
  name: string;
  description: string;
  category: string;
  parameters?: Record<string, any>;
}

interface StrategySelectorProps {
  selectedStrategies: string[];
  onStrategyChange: (strategies: string[]) => void;
  disabled?: boolean;
}

const DEFAULT_STRATEGIES: Record<string, StrategyMetadata> = {
  'ma_crossover': {
    name: 'Moving Average Crossover',
    description: 'Buy when fast MA crosses above slow MA, sell when it crosses below',
    category: 'Trend Following',
    parameters: { fast_period: 12, slow_period: 26 }
  },
  'rsi_strategy': {
    name: 'RSI Strategy',
    description: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)',
    category: 'Momentum',
    parameters: { oversold: 30, overbought: 70 }
  },
  'macd_strategy': {
    name: 'MACD Strategy',
    description: 'Buy when MACD crosses above signal line, sell when it crosses below',
    category: 'Momentum',
    parameters: {}
  },
  'bollinger_bands': {
    name: 'Bollinger Bands',
    description: 'Buy when price touches lower band, sell when it touches upper band',
    category: 'Mean Reversion',
    parameters: { period: 20, std_dev: 2 }
  },
  'stochastic_strategy': {
    name: 'Stochastic Strategy',
    description: 'Buy when stochastic is oversold, sell when overbought',
    category: 'Momentum',
    parameters: { oversold: 20, overbought: 80 }
  }
};

export default function StrategySelector({
  selectedStrategies,
  onStrategyChange,
  disabled = false
}: StrategySelectorProps) {
  const [availableStrategies, setAvailableStrategies] = useState<Record<string, StrategyMetadata>>(DEFAULT_STRATEGIES);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        // Use dynamic API URL that auto-detects correct backend address
        const apiUrl = getApiUrl();

        // Try to fetch from backend (if endpoint exists)
        const response = await fetch(`${apiUrl}/api/strategies/available`);
        if (response.ok) {
          const data = await response.json();
          if (data.strategies) {
            setAvailableStrategies(data.strategies);
          }
        }
      } catch (err) {
        console.warn('Could not fetch strategies from API, using defaults:', err);
        // Use default strategies
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  const handleToggle = (strategyKey: string) => {
    if (disabled) return;
    
    if (selectedStrategies.includes(strategyKey)) {
      onStrategyChange(selectedStrategies.filter(s => s !== strategyKey));
    } else {
      onStrategyChange([...selectedStrategies, strategyKey]);
    }
  };

  const handleClearAll = () => {
    if (disabled) return;
    onStrategyChange([]);
  };

  const strategiesByCategory = Object.entries(availableStrategies).reduce((acc, [key, strategy]) => {
    const category = strategy.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ key, ...strategy });
    return acc;
  }, {} as Record<string, Array<{ key: string } & StrategyMetadata>>);

  const categoryColors = {
    'Trend Following': 'text-blue-600 border-blue-200 bg-blue-50',
    'Momentum': 'text-orange-600 border-orange-200 bg-orange-50',
    'Mean Reversion': 'text-purple-600 border-purple-200 bg-purple-50',
    'Other': 'text-gray-600 border-gray-200 bg-gray-50'
  };

  const categoryIcons = {
    'Trend Following': '📈',
    'Momentum': '⚡',
    'Mean Reversion': '🔄',
    'Other': '📊'
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Loading strategies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">🎯</span>
          <h3 className="font-medium text-gray-900">Trading Strategies</h3>
          {selectedStrategies.length > 0 && (
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
              {selectedStrategies.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {selectedStrategies.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
              disabled={disabled}
            >
              Clear All
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Strategy Categories */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {Object.entries(strategiesByCategory).map(([category, strategies]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{categoryIcons[category as keyof typeof categoryIcons] || '📊'}</span>
                <h4 className="font-medium text-gray-700">{category}</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {strategies.map((strategy) => {
                  const isSelected = selectedStrategies.includes(strategy.key);
                  return (
                    <label
                      key={strategy.key}
                      className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? categoryColors[category as keyof typeof categoryColors] || 'border-gray-200 bg-gray-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(strategy.key)}
                        disabled={disabled}
                        className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {strategy.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {strategy.description}
                        </div>
                        {strategy.parameters && Object.keys(strategy.parameters).length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            Parameters: {JSON.stringify(strategy.parameters)}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Usage Info */}
          {selectedStrategies.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                <div className="font-medium mb-1">Selected Strategies:</div>
                <div className="text-xs">
                  {selectedStrategies.map(key => availableStrategies[key]?.name || key).join(', ')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

