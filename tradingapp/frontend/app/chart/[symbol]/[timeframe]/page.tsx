'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { io, Socket } from 'socket.io-client';

interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface StrategySignal {
  timestamp: string;
  strategy: string;
  signal_type: 'BUY' | 'SELL';
  price: number;
  confidence?: number;
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
          const volumeData = formattedData
            .filter(d => d.volume !== undefined)
            .map(d => ({
              time: d.time,
              value: d.volume!,
              color: d.close >= d.open ? '#26a69a80' : '#ef535080',
            }));
          volumeSeries.current.setData(volumeData);
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

  // Setup WebSocket connection
  useEffect(() => {
    if (!setupId) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl) return;

    const socketUrl = backendUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit('subscribe-setup', { setup_id: setupId });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('strategy-signal', (data: StrategySignal) => {
      setSignals(prev => [...prev, data]);
      // Add signal marker to chart (simplified - would need proper marker implementation)
    });

    socket.on('market-data-update', (data: any) => {
      if (candlestickSeries.current && data.symbol === symbol && data.timeframe === timeframe) {
        const newBar: CandlestickData = {
          time: data.timestamp as Time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume,
        };
        candlestickSeries.current.update(newBar);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [setupId, symbol, timeframe]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {symbol} - {timeframe}
              </h1>
              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                {port && <span>Port: {port}</span>}
                {setupId && <span>Setup ID: {setupId}</span>}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="capitalize">{connectionStatus}</span>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {indicators.length > 0 && (
                <div>Indicators: {indicators.join(', ')}</div>
              )}
              {strategies.length > 0 && (
                <div>Strategies: {strategies.join(', ')}</div>
              )}
            </div>
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
              {signals.slice(-10).reverse().map((signal, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-md border ${
                    signal.signal_type === 'BUY'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {signal.signal_type} - {signal.strategy}
                      </div>
                      <div className="text-sm text-gray-600">
                        Price: ${signal.price.toFixed(2)}
                        {signal.confidence && ` | Confidence: ${(signal.confidence * 100).toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(signal.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

