'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, SeriesMarker, CandlestickData, HistogramData } from 'lightweight-charts';
import { io, Socket } from 'socket.io-client';
import OrderDialog from '../../../components/OrderDialog';
import OrderHistory from '../../../components/OrderHistory';
import BackToHome from '../../../components/BackToHome';

interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface StrategySignal {
  id?: number;
  setup_id?: number;
  timeframe?: string;
  timestamp: string | number | Time;
  strategy?: string;
  strategy_name?: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence?: number;
  indicator_values?: Record<string, any>;
}

export default function StandaloneChartPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const symbol = params.symbol as string;
  const timeframe = params.timeframe as string;
  const setupId = searchParams.get('setupId');
  const indicators = searchParams.get('indicators')?.split(',') || [];
  const strategies = searchParams.get('strategies')?.split(',') || [];
  const port = searchParams.get('port');

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeries = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  const [chartData, setChartData] = useState<CandlestickData[]>([]);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [selectedSignal, setSelectedSignal] = useState<StrategySignal | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [contractId, setContractId] = useState<number | undefined>(undefined);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chart.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#cccccc',
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    candlestickSeries.current = chart.current.addCandlestickSeries({
      upColor: '#4CAF50',
      downColor: '#F44336',
      borderDownColor: '#F44336',
      borderUpColor: '#4CAF50',
      wickDownColor: '#F44336',
      wickUpColor: '#4CAF50',
    });

    volumeSeries.current = chart.current.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      visible: true,
    });

    volumeSeries.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const handleResize = () => {
      if (chart.current && chartContainerRef.current) {
        chart.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart.current) {
        chart.current.remove();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch historical data
  useEffect(() => {
    const fetchData = async () => {
      if (!symbol || !timeframe) return;

      setIsLoading(true);
      setError(null);

      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!backendUrl) {
          throw new Error('API URL not configured');
        }

        const response = await fetch(
          `${backendUrl}/api/market-data/history?symbol=${symbol}&timeframe=${timeframe}&period=3M&include_indicators=${indicators.length > 0}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const data = await response.json();
        const bars = data.bars || [];

        if (bars.length === 0) {
          setError('No data available for this symbol and timeframe');
          return;
        }

        const formattedData: CandlestickData[] = bars.map((bar: any) => ({
          time: (bar.time || bar.timestamp) as Time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
        }));

        setChartData(formattedData);

        if (candlestickSeries.current) {
          candlestickSeries.current.setData(formattedData);
        }

        if (volumeSeries.current) {
          const volumeData: HistogramData[] = formattedData
            .filter(d => d.volume !== undefined)
            .map(d => ({
              time: d.time,
              value: d.volume!,
              color: d.close >= d.open ? '#26a69a80' : '#ef535080',
            }));
          volumeSeries.current.setData(volumeData);
        }

        // Fetch existing strategy signals for this setup
        if (setupId) {
          fetchStrategySignals();
        }

        if (chart.current) {
          chart.current.timeScale().fitContent();
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [symbol, timeframe, indicators]);

  // Fetch strategy signals
  const fetchStrategySignals = useCallback(async () => {
    if (!setupId) return;

    try {
      const backendUrl = (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_API_URL) || process.env.NEXT_PUBLIC_API_URL;
      if (!backendUrl) return;

      const response = await fetch(
        `${backendUrl}/api/strategies/signals/${setupId}?timeframe=${timeframe}&limit=100`
      );

      if (response.ok) {
        const data = await response.json();
        const fetchedSignals = (data.signals || []).filter((s: StrategySignal) => s.signal_type !== 'HOLD');
        setSignals(fetchedSignals);
        updateChartMarkers(fetchedSignals);
      }
    } catch (err) {
      console.error('Error fetching strategy signals:', err);
    }
  }, [setupId, timeframe]);

  // Update chart markers from signals
  const updateChartMarkers = useCallback((signalList: StrategySignal[]) => {
    if (!candlestickSeries.current) return;

    const markers: SeriesMarker<Time>[] = signalList
      .filter(s => s.signal_type !== 'HOLD')
      .map((signal) => {
        const signalTime = typeof signal.timestamp === 'string' 
          ? (Math.floor(new Date(signal.timestamp).getTime() / 1000) as Time)
          : (typeof signal.timestamp === 'number' 
              ? (signal.timestamp as Time)
              : signal.timestamp);

        return {
          time: signalTime,
          position: signal.signal_type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: signal.signal_type === 'BUY' ? '#4CAF50' : '#F44336',
          shape: signal.signal_type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: `${signal.strategy || signal.strategy_name || 'Strategy'}: ${signal.signal_type} @ $${signal.price.toFixed(2)}`,
          size: 1,
        };
      });

    candlestickSeries.current.setMarkers(markers);
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (!setupId) return;

    const backendUrl = (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_API_URL) || process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl) return;

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit('subscribe-setup', { setup_id: parseInt(setupId) });
      socket.emit('subscribe-market-data', { symbol, timeframe, port });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('strategy-signal', (data: StrategySignal) => {
      // Only add signals for current timeframe
      if (data.timeframe === timeframe && data.signal_type !== 'HOLD') {
        setSignals(prev => {
          const newSignals = [...prev, data];
          updateChartMarkers(newSignals);
          return newSignals;
        });
      }
    });

    socket.on('market-data-update', (data: any) => {
      if (candlestickSeries.current && data.symbol === symbol && data.timeframe === timeframe) {
        const newBar: CandlestickData = {
          time: (typeof data.time === 'string' 
            ? Math.floor(new Date(data.time).getTime() / 1000)
            : data.time || data.timestamp) as Time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        };
        candlestickSeries.current.update(newBar);

        if (volumeSeries.current && data.volume !== undefined) {
          const volumeBar: HistogramData = {
            time: newBar.time,
            value: data.volume,
            color: data.close >= data.open ? '#26a69a80' : '#ef535080',
          };
          volumeSeries.current.update(volumeBar);
        }
      }
    });

    socket.on('order-status', (orderData: any) => {
      console.log('Order status update:', orderData);
      // Optionally refresh order history
    });

    return () => {
      socket.disconnect();
    };
  }, [setupId, symbol, timeframe, port, updateChartMarkers]);

  // Update markers when signals change
  useEffect(() => {
    if (signals.length > 0 && candlestickSeries.current) {
      updateChartMarkers(signals);
    }
  }, [signals, updateChartMarkers]);

  // Get contract ID for order placement
  useEffect(() => {
    const fetchContractId = async () => {
      try {
        const backendUrl = (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_API_URL) || process.env.NEXT_PUBLIC_API_URL;
        if (!backendUrl || !setupId) return;

        const response = await fetch(`${backendUrl}/api/trading-setup/${setupId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.contract_id) {
            setContractId(data.contract_id);
          }
        }
      } catch (err) {
        console.error('Error fetching contract ID:', err);
      }
    };

    if (setupId) {
      fetchContractId();
    }
  }, [setupId]);

  const handleSignalClick = (signal: StrategySignal) => {
    setSelectedSignal(signal);
    setIsOrderDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-gray-900">
                  {symbol} - {timeframe}
                </h1>
                {port && (
                  <span className="text-sm text-gray-600">Port: {port}</span>
                )}
                {setupId && (
                  <span className="text-sm text-gray-600">Setup ID: {setupId}</span>
                )}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                {indicators.length > 0 && (
                  <span>Indicators: {indicators.join(', ')}</span>
                )}
                {strategies.length > 0 && (
                  <span>Strategies: {strategies.join(', ')}</span>
                )}
              </div>
            </div>
            <BackToHome />
          </div>
        </div>
      </header>

      {/* Chart */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800">❌ {error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <div className="text-gray-600">Loading chart data...</div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div ref={chartContainerRef} className="w-full" style={{ height: '600px' }} />
          </div>
        )}

        {/* Signals Display */}
        {signals.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Signals</h3>
            <div className="space-y-2">
              {signals.slice(-10).reverse().map((signal, idx) => {
                const signalTime = typeof signal.timestamp === 'string' 
                  ? new Date(signal.timestamp)
                  : typeof signal.timestamp === 'number'
                    ? new Date(signal.timestamp * 1000)
                    : new Date();

                return (
                  <div
                    key={idx}
                    onClick={() => handleSignalClick(signal)}
                    className={`p-3 rounded-md border cursor-pointer hover:shadow-md transition-shadow ${
                      signal.signal_type === 'BUY'
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : 'bg-red-50 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {signal.signal_type} - {signal.strategy || signal.strategy_name || 'Strategy'}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Price: ${signal.price.toFixed(2)}
                          {signal.confidence && ` | Confidence: ${(signal.confidence * 100).toFixed(1)}%`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {signalTime.toLocaleString()}
                        </div>
                        <button className="mt-2 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                          Place Order
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order History */}
        {setupId && (
          <div className="mt-6">
            <OrderHistory setupId={parseInt(setupId)} limit={10} autoRefresh={true} />
          </div>
        )}
      </main>

      {/* Order Dialog */}
      <OrderDialog
        isOpen={isOrderDialogOpen}
        onClose={() => {
          setIsOrderDialogOpen(false);
          setSelectedSignal(null);
        }}
        signal={selectedSignal ? {
          signal_type: selectedSignal.signal_type,
          strategy: selectedSignal.strategy || selectedSignal.strategy_name || 'Strategy',
          price: selectedSignal.price,
          confidence: selectedSignal.confidence,
          timestamp: typeof selectedSignal.timestamp === 'string' 
            ? selectedSignal.timestamp
            : typeof selectedSignal.timestamp === 'number'
              ? new Date(selectedSignal.timestamp * 1000).toISOString()
              : new Date().toISOString()
        } : undefined}
        symbol={symbol}
        contractId={contractId}
        setupId={setupId ? parseInt(setupId) : undefined}
        signalId={selectedSignal?.id}
      />
    </div>
  );
}

