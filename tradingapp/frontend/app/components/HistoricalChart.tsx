'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import DataframeViewer from './DataframeViewer';

interface ProcessedBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoricalChartProps {
  data: ProcessedBar[];
  symbol: string;
  timeframe: string;
}

export default function HistoricalChart({ data, symbol, timeframe }: HistoricalChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
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
      watermark: {
        color: 'rgba(11, 94, 29, 0.4)',
        visible: true,
        text: symbol,
        fontSize: 24,
        horzAlign: 'center',
        vertAlign: 'center',
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Create volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#64748b',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      visible: true,
    });

    volumeSeriesRef.current = volumeSeries;

    // Position volume series at the bottom
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Handle resize
    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 400,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, []);

  // Update watermark when symbol changes
  useEffect(() => {
    if (chartRef.current && symbol) {
      chartRef.current.applyOptions({
        watermark: {
          color: 'rgba(11, 94, 29, 0.4)',
          visible: true,
          text: symbol,
          fontSize: 24,
          horzAlign: 'center',
          vertAlign: 'center',
        },
      });
    }
  }, [symbol]);

  // Fullscreen functionality
  const toggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return;

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (fullscreenContainerRef.current.requestFullscreen) {
          await fullscreenContainerRef.current.requestFullscreen();
        } else if ((fullscreenContainerRef.current as any).webkitRequestFullscreen) {
          await (fullscreenContainerRef.current as any).webkitRequestFullscreen();
        } else if ((fullscreenContainerRef.current as any).msRequestFullscreen) {
          await (fullscreenContainerRef.current as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Resize chart when entering/exiting fullscreen
      if (chartRef.current && chartContainerRef.current) {
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: isCurrentlyFullscreen ? window.innerHeight - 100 : 400,
            });
          }
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Update chart data when data changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !data.length) return;

    // Convert data to TradingView format
    const candlestickData: CandlestickData[] = data.map(bar => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    const volumeData = data.map(bar => ({
      time: bar.time as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? '#26a69a' : '#ef5350',
    }));

    // Set data
    candlestickSeriesRef.current.setData(candlestickData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content to view
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div 
      ref={fullscreenContainerRef}
      className={`w-full h-full ${isFullscreen ? 'bg-white p-4' : ''}`}
    >
      {/* Fullscreen Controls */}
      <div className={`flex justify-between items-center ${isFullscreen ? 'mb-4' : 'mb-2'}`}>
        <div className="flex items-center gap-4">
          {data.length > 0 && (
            <div className="text-xs text-gray-500">
              Data points: {data.length} | Timeframe: {timeframe}
            </div>
          )}
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit Fullscreen
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              </svg>
              Fullscreen
            </>
          )}
        </button>
      </div>

      {/* Chart Container */}
      <div 
        ref={chartContainerRef} 
        className={`w-full ${isFullscreen ? 'h-full' : 'h-96'}`}
        style={{ 
          height: isFullscreen ? 'calc(100vh - 120px)' : '400px'
        }}
      />
      
      {/* Chart Legend - only show when not in fullscreen */}
      {data.length > 0 && !isFullscreen && (
        <div className="mt-2 text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              Bull Bars (Green)
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              Bear Bars (Red)
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 