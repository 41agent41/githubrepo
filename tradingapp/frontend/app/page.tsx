'use client';

import React from 'react';
import MarketDataFilter from './components/MarketDataFilter';
import ConnectionStatusIndicator from './components/ConnectionStatusIndicator';
import { useIBConnection } from './contexts/IBConnectionContext';

export default function HomePage() {
  const { isConnected, isLiveTrading } = useIBConnection();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">Trading App</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1">Interactive Brokers Market Data & TradingView Charts</p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ConnectionStatusIndicator showDetails={true} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Quick Access Links */}
        <div className="mb-6 sm:mb-8 lg:mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          <a 
            href="/account" 
            className="block p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">👤</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg lg:text-xl font-medium text-gray-900 truncate">Account Dashboard</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1 line-clamp-2">View your trading account and portfolio</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/historical" 
            className="block p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">📊</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg lg:text-xl font-medium text-gray-900 truncate">Historical Chart</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1 line-clamp-2">MSFT historical data with multiple timeframes</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/download" 
            className="block p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">⬇️</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg lg:text-xl font-medium text-gray-900 truncate">Download Data</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1 line-clamp-2">Download historical data and load into database</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/chart/MSFT/1hour?fullscreen=true" 
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">📈</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg lg:text-xl font-medium text-gray-900 truncate">MSFT Real-time Chart</h3>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">New Tab</span>
                </div>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1 line-clamp-2">Live Microsoft stock data with TradingView charts</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/configure" 
            className="block p-4 sm:p-6 lg:p-8 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">⚙️</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg lg:text-xl font-medium text-gray-900 truncate">Trading Setup</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1 line-clamp-2">Configure symbol, timeframes, indicators, and strategies</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/connections" 
            className="block p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow-sm border border-slate-700 hover:shadow-md hover:border-cyan-500/50 transition-all duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">🔌</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg lg:text-xl font-medium text-white truncate">IB Connections</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-400 mt-1 line-clamp-2">Configure IB Gateway & TWS connections (Live/Paper)</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/settings" 
            className="block p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-purple-900/50 to-slate-900 rounded-lg shadow-sm border border-purple-700/50 hover:shadow-md hover:border-purple-500/50 transition-all duration-200"
          >
            <div className="flex items-start sm:items-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl mr-3 sm:mr-4 flex-shrink-0">⚙️</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg lg:text-xl font-medium text-white truncate">System Settings</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-400 mt-1 line-clamp-2">Configure CORS, security, caching, and all app settings</p>
              </div>
            </div>
          </a>
        </div>

        {/* Connection Status Info Banner - Only shown when connected */}
        {isConnected && (
          <div className={`mb-6 sm:mb-8 lg:mb-10 p-4 rounded-lg border-l-4 ${
            isLiveTrading 
              ? 'bg-red-50 border-red-500' 
              : 'bg-blue-50 border-blue-500'
          }`}>
            <div className="flex items-start space-x-3">
              <div className={`text-lg ${isLiveTrading ? 'text-red-600' : 'text-blue-600'}`}>
                {isLiveTrading ? '⚠️' : '📊'}
              </div>
              <div className="flex-1">
                <h4 className={`font-medium mb-1 ${isLiveTrading ? 'text-red-900' : 'text-blue-900'}`}>
                  {isLiveTrading ? 'Live Trading Mode' : 'Paper Trading Mode'}
                </h4>
                <p className={`text-sm ${isLiveTrading ? 'text-red-700' : 'text-blue-700'}`}>
                  {isLiveTrading 
                    ? 'You are connected to a LIVE trading account. All trades use real money.'
                    : 'You are connected to a paper trading account. Trades are simulated.'
                  }
                </p>
                <a 
                  href="/connections" 
                  className={`inline-block mt-2 text-sm underline ${
                    isLiveTrading ? 'text-red-600 hover:text-red-800' : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  Manage connections →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Market Data Search Section */}
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-medium text-gray-900 mb-2 sm:mb-3">
            Market Data Search & Filter
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-4 sm:mb-6">
            Search for stocks, options, futures, and other financial instruments using Interactive Brokers data.
          </p>

          {/* Market Data Filter Component */}
          <MarketDataFilter />
        </div>
      </main>
    </div>
  );
}
