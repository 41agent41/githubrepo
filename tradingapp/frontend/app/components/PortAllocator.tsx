'use client';

import React from 'react';

interface PortAllocatorProps {
  port: number | null;
  symbol: string | null;
  timeframes: string[];
  indicators: string[];
  strategies: string[];
  setupId: number | null;
  onOpenCharts: () => void;
}

export default function PortAllocator({
  port,
  symbol,
  timeframes,
  indicators,
  strategies,
  setupId,
  onOpenCharts
}: PortAllocatorProps) {
  const generateChartUrls = () => {
    if (!symbol || timeframes.length === 0) return [];

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const indicatorsParam = indicators.length > 0 ? `&indicators=${indicators.join(',')}` : '';
    const strategiesParam = strategies.length > 0 ? `&strategies=${strategies.join(',')}` : '';
    const portParam = port ? `&port=${port}` : '';

    return timeframes.map(timeframe => {
      const url = `${baseUrl}/chart/${symbol}/${timeframe}?setupId=${setupId || ''}${indicatorsParam}${strategiesParam}${portParam}`;
      return { timeframe, url };
    });
  };

  const chartUrls = generateChartUrls();
  const canOpenCharts = symbol && timeframes.length > 0 && setupId !== null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-lg">🚀</span>
        <h3 className="font-medium text-gray-900">Chart Configuration</h3>
      </div>

      {port ? (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">Allocated Port:</div>
              <div className="text-lg font-mono font-bold">{port}</div>
            </div>
          </div>

          {setupId && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-1">Setup ID:</div>
                <div className="text-lg font-mono">{setupId}</div>
              </div>
            </div>
          )}

          {chartUrls.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Chart URLs:</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {chartUrls.map(({ timeframe, url }) => (
                  <div key={timeframe} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                    <div className="font-medium text-gray-600 mb-1">{timeframe}:</div>
                    <div className="font-mono text-gray-800 break-all">{url}</div>
                    <button
                      onClick={() => window.open(url, '_blank')}
                      className="mt-1 text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      Open in new tab
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onOpenCharts}
            disabled={!canOpenCharts}
            className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <span>📊</span>
            <span>Open All Charts in New Tabs</span>
          </button>
        </div>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-1">⚠️ Port Not Allocated</div>
            <div>Port will be allocated when you create the trading setup.</div>
          </div>
        </div>
      )}

      {!canOpenCharts && port && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="text-xs text-gray-600">
            Complete the setup configuration to open charts.
          </div>
        </div>
      )}
    </div>
  );
}

