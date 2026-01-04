'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, SeriesMarker, HistogramData } from 'lightweight-charts';
import { io, Socket } from 'socket.io-client';
import OrderDialog from '../../../components/OrderDialog';
import OrderHistory from '../../../components/OrderHistory';
import BackToHome from '../../../components/BackToHome';
import { getApiUrl } from '../../../utils/apiConfig';

interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  // Technical Indicators
  sma_20?: number;
  sma_50?: number;
  ema_12?: number;
  ema_26?: number;
  rsi?: number;
  macd?: number;
  macd_signal?: number;
  macd_histogram?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
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
  const indicatorSeries = useRef<Map<string, ISeriesApi<'Line' | 'Histogram' | 'Area'>>>(new Map());
  const rsiSeries = useRef<ISeriesApi<'Area'> | null>(null);
  const macdHistogramSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeries = useRef<ISeriesApi<'Line'> | null>(null);
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

  // Add indicator overlays to chart
  const addIndicatorOverlays = useCallback((data: CandlestickData[], selectedIndicators: string[]) => {
    if (!chart.current) return;

    // Remove existing indicator series
    indicatorSeries.current.forEach((series) => {
      chart.current?.removeSeries(series);
    });
    indicatorSeries.current.clear();
    
    // Remove specialized series if they exist
    if (rsiSeries.current) {
      chart.current.removeSeries(rsiSeries.current);
      rsiSeries.current = null;
    }
    if (macdHistogramSeries.current) {
      chart.current.removeSeries(macdHistogramSeries.current);
      macdHistogramSeries.current = null;
    }
    if (macdLineSeries.current) {
      chart.current.removeSeries(macdLineSeries.current);
      macdLineSeries.current = null;
    }
    if (macdSignalSeries.current) {
      chart.current.removeSeries(macdSignalSeries.current);
      macdSignalSeries.current = null;
    }
    if (bbUpperSeries.current) {
      chart.current.removeSeries(bbUpperSeries.current);
      bbUpperSeries.current = null;
    }
    if (bbMiddleSeries.current) {
      chart.current.removeSeries(bbMiddleSeries.current);
      bbMiddleSeries.current = null;
    }
    if (bbLowerSeries.current) {
      chart.current.removeSeries(bbLowerSeries.current);
      bbLowerSeries.current = null;
    }

    selectedIndicators.forEach((indicatorKey) => {
      try {
        if (indicatorKey.startsWith('sma_') || indicatorKey.startsWith('ema_')) {
          // SMA/EMA lines on main chart
          const indicatorData = data
            .filter(bar => (bar as any)[indicatorKey] !== undefined && !isNaN((bar as any)[indicatorKey]))
            .map(bar => ({
              time: bar.time,
              value: (bar as any)[indicatorKey] as number,
            }));

          if (indicatorData.length > 0) {
            const color = indicatorKey === 'sma_20' ? '#2563eb' :
                         indicatorKey === 'sma_50' ? '#dc2626' :
                         indicatorKey === 'ema_12' ? '#059669' :
                         indicatorKey === 'ema_26' ? '#ea580c' : '#666666';

            const series = chart.current!.addLineSeries({
              color: color,
              lineWidth: 2,
              title: indicatorKey.toUpperCase().replace('_', ' '),
              priceScaleId: 'right',
            });
            series.setData(indicatorData);
            indicatorSeries.current.set(indicatorKey, series);
          }
        } else if (indicatorKey === 'rsi') {
          // RSI in separate panel
          const rsiData = data
            .filter(bar => bar.rsi !== undefined && !isNaN(bar.rsi))
            .map(bar => ({
              time: bar.time,
              value: bar.rsi!,
            }));

          if (rsiData.length > 0) {
            rsiSeries.current = chart.current!.addAreaSeries({
              priceScaleId: 'rsi-scale',
              lineColor: '#9333ea',
              topColor: 'rgba(147, 51, 234, 0.2)',
              bottomColor: 'rgba(147, 51, 234, 0.05)',
              lineWidth: 2,
              title: 'RSI',
            });
            rsiSeries.current.priceScale().applyOptions({
              scaleMargins: { top: 0.7, bottom: 0 },
              autoScale: false,
              borderColor: '#cccccc',
            });
            rsiSeries.current.setData(rsiData);
          }
        } else if (indicatorKey === 'macd') {
          // MACD in separate panel with histogram
          const macdLineData = data
            .filter(bar => bar.macd !== undefined && !isNaN(bar.macd))
            .map(bar => ({ time: bar.time, value: bar.macd! }));

          const macdSignalData = data
            .filter(bar => bar.macd_signal !== undefined && !isNaN(bar.macd_signal))
            .map(bar => ({ time: bar.time, value: bar.macd_signal! }));

          const macdHistogramData = data
            .filter(bar => bar.macd_histogram !== undefined && !isNaN(bar.macd_histogram))
            .map(bar => ({
              time: bar.time,
              value: bar.macd_histogram!,
              color: bar.macd_histogram! >= 0 ? '#4CAF50' : '#F44336',
            }));

          if (macdLineData.length > 0) {
            macdLineSeries.current = chart.current!.addLineSeries({
              priceScaleId: 'macd-scale',
              color: '#2196F3',
              lineWidth: 1,
              title: 'MACD',
            });
            macdLineSeries.current.priceScale().applyOptions({
              scaleMargins: { top: 0.7, bottom: 0 },
              borderColor: '#cccccc',
            });
            macdLineSeries.current.setData(macdLineData);
          }

          if (macdSignalData.length > 0) {
            macdSignalSeries.current = chart.current!.addLineSeries({
              priceScaleId: 'macd-scale',
              color: '#FF6D00',
              lineWidth: 1,
              title: 'MACD Signal',
            });
            macdSignalSeries.current.setData(macdSignalData);
          }

          if (macdHistogramData.length > 0) {
            macdHistogramSeries.current = chart.current!.addHistogramSeries({
              priceScaleId: 'macd-scale',
              title: 'MACD Histogram',
            });
            macdHistogramSeries.current.setData(macdHistogramData);
          }
        } else if (indicatorKey === 'bollinger' || indicatorKey === 'bb') {
          // Bollinger Bands on main chart
          const bbUpperData = data
            .filter(bar => bar.bb_upper !== undefined && !isNaN(bar.bb_upper))
            .map(bar => ({ time: bar.time, value: bar.bb_upper! }));

          const bbMiddleData = data
            .filter(bar => bar.bb_middle !== undefined && !isNaN(bar.bb_middle))
            .map(bar => ({ time: bar.time, value: bar.bb_middle! }));

          const bbLowerData = data
            .filter(bar => bar.bb_lower !== undefined && !isNaN(bar.bb_lower))
            .map(bar => ({ time: bar.time, value: bar.bb_lower! }));

          if (bbUpperData.length > 0) {
            bbUpperSeries.current = chart.current!.addLineSeries({
              color: '#FFC107',
              lineWidth: 1,
              lineStyle: 0, // Solid
              title: 'BB Upper',
              priceScaleId: 'right',
            });
            bbUpperSeries.current.setData(bbUpperData);
          }

          if (bbMiddleData.length > 0) {
            bbMiddleSeries.current = chart.current!.addLineSeries({
              color: '#9E9E9E',
              lineWidth: 1,
              lineStyle: 1, // Dotted
              title: 'BB Middle',
              priceScaleId: 'right',
            });
            bbMiddleSeries.current.setData(bbMiddleData);
          }

          if (bbLowerData.length > 0) {
            bbLowerSeries.current = chart.current!.addLineSeries({
              color: '#FFC107',
              lineWidth: 1,
              lineStyle: 0, // Solid
              title: 'BB Lower',
              priceScaleId: 'right',
            });
            bbLowerSeries.current.setData(bbLowerData);
          }
        }
      } catch (error) {
        console.error(`Error adding indicator ${indicatorKey}:`, error);
      }
    });
  }, []);

  // Fetch strategy signals
  const fetchStrategySignals = useCallback(async () => {
    if (!setupId) return;

    try {
      // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();
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

  // Fetch historical data
  useEffect(() => {
    const fetchData = async () => {
      if (!symbol || !timeframe) return;

      setIsLoading(true);
      setError(null);

      try {
        // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();
        if (!backendUrl) {
          throw new Error('API URL not configured');
        }

        // Build query with indicators if needed
        let queryUrl = `${backendUrl}/api/market-data/history?symbol=${symbol}&timeframe=${timeframe}&period=3M`;
        if (indicators.length > 0) {
          queryUrl += `&indicators=${indicators.join(',')}`;
        }

        const response = await fetch(queryUrl, {
          headers: {
            'X-Data-Query-Enabled': 'true'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const data = await response.json();
        const bars = data.bars || [];

        if (bars.length === 0) {
          setError('No data available for this symbol and timeframe');
          return;
        }

        const formattedData: CandlestickData[] = bars.map((bar: any) => {
          const timestamp = bar.time || bar.timestamp;
          const timeValue = typeof timestamp === 'number' 
            ? (timestamp > 1000000000000 ? Math.floor(timestamp / 1000) : timestamp) as Time
            : (typeof timestamp === 'string' ? Math.floor(new Date(timestamp).getTime() / 1000) as Time : timestamp);

          return {
            time: timeValue,
            open: Number(bar.open),
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
            volume: bar.volume ? Number(bar.volume) : undefined,
            // Add indicator values
            sma_20: bar.sma_20 !== undefined && !isNaN(bar.sma_20) ? Number(bar.sma_20) : undefined,
            sma_50: bar.sma_50 !== undefined && !isNaN(bar.sma_50) ? Number(bar.sma_50) : undefined,
            ema_12: bar.ema_12 !== undefined && !isNaN(bar.ema_12) ? Number(bar.ema_12) : undefined,
            ema_26: bar.ema_26 !== undefined && !isNaN(bar.ema_26) ? Number(bar.ema_26) : undefined,
            rsi: bar.rsi !== undefined && !isNaN(bar.rsi) ? Number(bar.rsi) : undefined,
            macd: bar.macd !== undefined && !isNaN(bar.macd) ? Number(bar.macd) : undefined,
            macd_signal: bar.macd_signal !== undefined && !isNaN(bar.macd_signal) ? Number(bar.macd_signal) : undefined,
            macd_histogram: bar.macd_histogram !== undefined && !isNaN(bar.macd_histogram) ? Number(bar.macd_histogram) : undefined,
            bb_upper: bar.bb_upper !== undefined && !isNaN(bar.bb_upper) ? Number(bar.bb_upper) : undefined,
            bb_middle: bar.bb_middle !== undefined && !isNaN(bar.bb_middle) ? Number(bar.bb_middle) : undefined,
            bb_lower: bar.bb_lower !== undefined && !isNaN(bar.bb_lower) ? Number(bar.bb_lower) : undefined,
          };
        }).filter((bar: CandlestickData) => bar && !isNaN(bar.open) && !isNaN(bar.high) && !isNaN(bar.low) && !isNaN(bar.close));

        setChartData(formattedData);

        if (candlestickSeries.current && formattedData.length > 0) {
          candlestickSeries.current.setData(formattedData);
        }

        if (volumeSeries.current && formattedData.length > 0) {
          const volumeData: HistogramData[] = formattedData
            .filter(d => d.volume !== undefined)
            .map(d => ({
              time: d.time,
              value: d.volume!,
              color: d.close >= d.open ? '#26a69a80' : '#ef535080',
            }));
          volumeSeries.current.setData(volumeData);
        }

        // Add indicator overlays
        if (indicators.length > 0) {
          addIndicatorOverlays(formattedData, indicators);
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
  }, [symbol, timeframe, indicators, setupId, addIndicatorOverlays, fetchStrategySignals]);

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

        // Build tooltip text with indicator values if available
        let tooltipText = `${signal.strategy || signal.strategy_name || 'Strategy'}: ${signal.signal_type}\nPrice: $${signal.price.toFixed(2)}`;
        
        if (signal.confidence) {
          tooltipText += `\nConfidence: ${(signal.confidence * 100).toFixed(1)}%`;
        }
        
        // Add indicator values if available
        if (signal.indicator_values && typeof signal.indicator_values === 'object') {
          const indicatorValues = signal.indicator_values as Record<string, any>;
          const indicatorKeys = Object.keys(indicatorValues).filter(key => 
            indicatorValues[key] !== null && indicatorValues[key] !== undefined
          );
          
          if (indicatorKeys.length > 0) {
            tooltipText += '\n\nIndicators:';
            indicatorKeys.slice(0, 5).forEach(key => {
              const value = indicatorValues[key];
              if (typeof value === 'number') {
                tooltipText += `\n${key.toUpperCase().replace(/_/g, ' ')}: ${value.toFixed(2)}`;
              }
            });
            if (indicatorKeys.length > 5) {
              tooltipText += `\n... and ${indicatorKeys.length - 5} more`;
            }
          }
        }

        return {
          time: signalTime,
          position: signal.signal_type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: signal.signal_type === 'BUY' ? '#4CAF50' : '#F44336',
          shape: signal.signal_type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: tooltipText,
          size: 1.5,
        };
      });

    candlestickSeries.current.setMarkers(markers);
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (!setupId) return;

    // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();
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
          volume: data.volume,
          sma_20: data.sma_20,
          sma_50: data.sma_50,
          ema_12: data.ema_12,
          ema_26: data.ema_26,
          rsi: data.rsi,
          macd: data.macd,
          macd_signal: data.macd_signal,
          macd_histogram: data.macd_histogram,
          bb_upper: data.bb_upper,
          bb_middle: data.bb_middle,
          bb_lower: data.bb_lower,
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

        // Update indicator series with new data
        if (newBar.sma_20 !== undefined && indicatorSeries.current.has('sma_20')) {
          indicatorSeries.current.get('sma_20')?.update({ time: newBar.time, value: newBar.sma_20 });
        }
        if (newBar.sma_50 !== undefined && indicatorSeries.current.has('sma_50')) {
          indicatorSeries.current.get('sma_50')?.update({ time: newBar.time, value: newBar.sma_50 });
        }
        if (newBar.ema_12 !== undefined && indicatorSeries.current.has('ema_12')) {
          indicatorSeries.current.get('ema_12')?.update({ time: newBar.time, value: newBar.ema_12 });
        }
        if (newBar.ema_26 !== undefined && indicatorSeries.current.has('ema_26')) {
          indicatorSeries.current.get('ema_26')?.update({ time: newBar.time, value: newBar.ema_26 });
        }
        if (newBar.rsi !== undefined && rsiSeries.current) {
          rsiSeries.current.update({ time: newBar.time, value: newBar.rsi });
        }
        if (newBar.macd !== undefined && macdLineSeries.current) {
          macdLineSeries.current.update({ time: newBar.time, value: newBar.macd });
        }
        if (newBar.macd_signal !== undefined && macdSignalSeries.current) {
          macdSignalSeries.current.update({ time: newBar.time, value: newBar.macd_signal });
        }
        if (newBar.macd_histogram !== undefined && macdHistogramSeries.current) {
          macdHistogramSeries.current.update({
            time: newBar.time,
            value: newBar.macd_histogram,
            color: newBar.macd_histogram >= 0 ? '#4CAF50' : '#F44336',
          });
        }
        if (newBar.bb_upper !== undefined && bbUpperSeries.current) {
          bbUpperSeries.current.update({ time: newBar.time, value: newBar.bb_upper });
        }
        if (newBar.bb_middle !== undefined && bbMiddleSeries.current) {
          bbMiddleSeries.current.update({ time: newBar.time, value: newBar.bb_middle });
        }
        if (newBar.bb_lower !== undefined && bbLowerSeries.current) {
          bbLowerSeries.current.update({ time: newBar.time, value: newBar.bb_lower });
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
  }, [setupId, symbol, timeframe, port, updateChartMarkers, indicators]);

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
        // Use dynamic API URL that auto-detects correct backend address
      const backendUrl = getApiUrl();
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
        signal={selectedSignal && (selectedSignal.signal_type === 'BUY' || selectedSignal.signal_type === 'SELL') ? {
          signal_type: selectedSignal.signal_type as 'BUY' | 'SELL',
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

