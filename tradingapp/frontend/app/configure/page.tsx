'use client';

import React, { useState } from 'react';
import SymbolSelector from '../components/SymbolSelector';
import MultiTimeframeSelector from '../components/MultiTimeframeSelector';
import IndicatorSelector from '../components/IndicatorSelector';
import StrategySelector from '../components/StrategySelector';
import PortAllocator from '../components/PortAllocator';
import BackToHome from '../components/BackToHome';
import { getApiUrl } from '../utils/apiConfig';

interface ContractResult {
  conid: string;
  symbol: string;
  companyName: string;
  description: string;
  secType: string;
  currency?: string;
  exchange?: string;
}

interface TradingSetup {
  id: number;
  port: number;
  chart_urls: string[];
}

export default function TradingSetupPage(): JSX.Element {
  const [selectedContract, setSelectedContract] = useState<ContractResult | null>(null);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['1hour']);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [setup, setSetup] = useState<TradingSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'indicators' | 'strategies'>('indicators');

  const handleCreateSetup = async () => {
    if (!selectedContract) {
      setError('Please select a symbol');
      return;
    }

    if (selectedTimeframes.length === 0) {
      setError('Please select at least one timeframe');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();

      const response = await fetch(`${backendUrl}/api/trading-setup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: selectedContract.symbol,
          contract_id: selectedContract.conid,
          timeframes: selectedTimeframes,
          indicators: selectedIndicators,
          strategies: selectedStrategies,
          secType: selectedContract.secType,
          exchange: selectedContract.exchange || 'SMART',
          currency: selectedContract.currency || 'USD'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to create setup: ${response.statusText}`);
      }

      const data = await response.json();
      setSetup({
        id: data.setup_id,
        port: data.port,
        chart_urls: data.chart_urls || []
      });
    } catch (err) {
      console.error('Setup creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create trading setup');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCharts = () => {
    if (!setup || !selectedContract) return;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const indicatorsParam = selectedIndicators.length > 0 ? `&indicators=${selectedIndicators.join(',')}` : '';
    const strategiesParam = selectedStrategies.length > 0 ? `&strategies=${selectedStrategies.join(',')}` : '';
    const portParam = setup.port ? `&port=${setup.port}` : '';

    selectedTimeframes.forEach(timeframe => {
      const url = `${baseUrl}/chart/${selectedContract.symbol}/${timeframe}?setupId=${setup.id}${indicatorsParam}${strategiesParam}${portParam}`;
      window.open(url, '_blank');
    });
  };

  const canCreateSetup = selectedContract && selectedTimeframes.length > 0;

  // Calculate progress
  const getStepStatus = (step: number) => {
    if (setup) return 'complete';
    if (step === 1) return selectedContract ? 'complete' : 'current';
    if (step === 2) return selectedTimeframes.length > 0 ? 'complete' : (selectedContract ? 'current' : 'pending');
    if (step === 3) return 'current'; // Indicators/Strategies - always current if previous steps done
    if (step === 4) return (selectedContract && selectedTimeframes.length > 0) ? 'current' : 'pending';
    return 'pending';
  };

  const steps = [
    { number: 1, title: 'Select Symbol', description: 'Choose the market symbol to trade', status: getStepStatus(1) },
    { number: 2, title: 'Select Timeframes', description: 'Choose one or more timeframes', status: getStepStatus(2) },
    { number: 3, title: 'Indicators & Strategies', description: 'Choose technical indicators and strategies', status: getStepStatus(3) },
    { number: 4, title: 'Chart Configuration', description: 'Port allocation and chart spawning', status: getStepStatus(4) },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trading Setup Configuration</h1>
              <p className="text-sm text-gray-600 mt-1">Configure symbol, timeframes, indicators, and strategies</p>
            </div>
            <BackToHome />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Progress Indicator */}
        {!setup && (
          <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center flex-1">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium text-sm transition-all ${
                      step.status === 'complete'
                        ? 'bg-green-500 border-green-500 text-white'
                        : step.status === 'current'
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {step.status === 'complete' ? '✓' : step.number}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-xs font-medium ${
                        step.status === 'complete' ? 'text-green-600' : step.status === 'current' ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        Step {step.number}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 max-w-[120px]">
                        {step.title}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      step.status === 'complete' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: Symbol Selection */}
          <div className={`bg-white rounded-lg shadow-sm border p-6 transition-all ${
            getStepStatus(1) === 'current' ? 'ring-2 ring-blue-500' : ''
          }`}>
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm ${
                  selectedContract
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-blue-500 border-blue-500 text-white'
                }`}>
                  {selectedContract ? '✓' : '1'}
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Step 1: Select Symbol</h2>
                  <p className="text-sm text-gray-600">Choose the market symbol to trade</p>
                </div>
              </div>
              {selectedContract && (
                <div className="ml-11 mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-sm font-medium text-green-900">
                    ✓ Selected: {selectedContract.symbol}
                  </div>
                  {selectedContract.companyName && (
                    <div className="text-xs text-green-700 mt-1">{selectedContract.companyName}</div>
                  )}
                </div>
              )}
            </div>
            <SymbolSelector
              selectedContract={selectedContract}
              onContractSelect={setSelectedContract}
              disabled={loading || setup !== null}
            />
          </div>

          {/* Step 2: Timeframe Selection */}
          <div className={`bg-white rounded-lg shadow-sm border p-6 transition-all ${
            getStepStatus(2) === 'current' ? 'ring-2 ring-blue-500' : ''
          }`}>
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm ${
                  selectedTimeframes.length > 0
                    ? 'bg-green-500 border-green-500 text-white'
                    : (selectedContract ? 'bg-blue-500 border-blue-500 text-white' : 'bg-gray-300 border-gray-300 text-gray-500')
                }`}>
                  {selectedTimeframes.length > 0 ? '✓' : '2'}
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Step 2: Select Timeframes</h2>
                  <p className="text-sm text-gray-600">Choose one or more timeframes for analysis</p>
                </div>
              </div>
              {selectedTimeframes.length > 0 && (
                <div className="ml-11 mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-sm font-medium text-green-900">
                    ✓ {selectedTimeframes.length} timeframe{selectedTimeframes.length !== 1 ? 's' : ''} selected: {selectedTimeframes.join(', ')}
                  </div>
                </div>
              )}
            </div>
            <MultiTimeframeSelector
              selectedTimeframes={selectedTimeframes}
              onTimeframeChange={setSelectedTimeframes}
              disabled={loading || setup !== null}
            />
          </div>

          {/* Step 3: Indicators/Strategies Selection */}
          <div className={`bg-white rounded-lg shadow-sm border p-6 transition-all ${
            getStepStatus(3) === 'current' ? 'ring-2 ring-blue-500' : ''
          }`}>
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm ${
                  (selectedIndicators.length > 0 || selectedStrategies.length > 0)
                    ? 'bg-green-500 border-green-500 text-white'
                    : (selectedContract && selectedTimeframes.length > 0 ? 'bg-blue-500 border-blue-500 text-white' : 'bg-gray-300 border-gray-300 text-gray-500')
                }`}>
                  {(selectedIndicators.length > 0 || selectedStrategies.length > 0) ? '✓' : '3'}
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Step 3: Select Indicators & Strategies</h2>
                  <p className="text-sm text-gray-600">Choose technical indicators and trading strategies (optional)</p>
                </div>
              </div>
              {(selectedIndicators.length > 0 || selectedStrategies.length > 0) && (
                <div className="ml-11 mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-sm font-medium text-green-900">
                    {selectedIndicators.length > 0 && `✓ ${selectedIndicators.length} indicator${selectedIndicators.length !== 1 ? 's' : ''} selected`}
                    {selectedIndicators.length > 0 && selectedStrategies.length > 0 && ' • '}
                    {selectedStrategies.length > 0 && `✓ ${selectedStrategies.length} strateg${selectedStrategies.length !== 1 ? 'ies' : 'y'} selected`}
                  </div>
                </div>
              )}
            </div>
            
            {/* Tabs */}
            <div className="mb-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('indicators')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'indicators'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    📊 Technical Indicators
                  </button>
                  <button
                    onClick={() => setActiveTab('strategies')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'strategies'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    🎯 Trading Strategies
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'indicators' ? (
              <IndicatorSelector
                selectedIndicators={selectedIndicators}
                onIndicatorChange={setSelectedIndicators}
                isLoading={loading || setup !== null}
              />
            ) : (
              <StrategySelector
                selectedStrategies={selectedStrategies}
                onStrategyChange={setSelectedStrategies}
                disabled={loading || setup !== null}
              />
            )}
          </div>

          {/* Step 4: Chart Configuration */}
          <div className={`bg-white rounded-lg shadow-sm border p-6 transition-all ${
            getStepStatus(4) === 'current' ? 'ring-2 ring-blue-500' : ''
          }`}>
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm ${
                  setup
                    ? 'bg-green-500 border-green-500 text-white'
                    : (selectedContract && selectedTimeframes.length > 0 ? 'bg-blue-500 border-blue-500 text-white' : 'bg-gray-300 border-gray-300 text-gray-500')
                }`}>
                  {setup ? '✓' : '4'}
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Step 4: Chart Configuration</h2>
                  <p className="text-sm text-gray-600">Port allocation and chart spawning</p>
                </div>
              </div>
              <PortAllocator
                port={setup?.port || null}
                symbol={selectedContract?.symbol || null}
                timeframes={selectedTimeframes}
                indicators={selectedIndicators}
                strategies={selectedStrategies}
                setupId={setup?.id || null}
                onOpenCharts={handleOpenCharts}
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800">❌ {error}</div>
            </div>
          )}

          {/* Success Display */}
          {setup && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="text-green-800">
                <div className="font-medium mb-2">✅ Trading Setup Created Successfully!</div>
                <div className="text-sm">
                  <div>Setup ID: {setup.id}</div>
                  <div>Port: {setup.port}</div>
                  <div className="mt-2">You can now open charts in separate tabs.</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setSelectedContract(null);
                setSelectedTimeframes(['1hour']);
                setSelectedIndicators([]);
                setSelectedStrategies([]);
                setSetup(null);
                setError(null);
              }}
              disabled={loading}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Reset
            </button>
            
            <button
              onClick={handleCreateSetup}
              disabled={!canCreateSetup || loading || setup !== null}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">↻</span>
                  <span>Creating Setup...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Create Trading Setup</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

