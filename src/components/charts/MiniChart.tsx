'use client';

import React, { useState, useEffect } from 'react';

/**
 * Mini Chart Component
 * 
 * Lightweight price chart for quick price visualization.
 * Uses SVG for simple candlestick and line chart rendering.
 */

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
  className?: string;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  width = 300,
  height = 150,
  color = '#10B981',
  showGrid = true,
  className = '',
}) => {
  if (!data || data.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-800 rounded ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-400 text-sm">No data</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path for line chart
  const pathData = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate points for area fill
  const areaPath = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className={`relative ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {showGrid && (
          <g className="opacity-20">
            {/* Horizontal grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={`h-${ratio}`}
                x1={0}
                y1={height * ratio}
                x2={width}
                y2={height * ratio}
                stroke="#64748B"
                strokeWidth={0.5}
              />
            ))}
            {/* Vertical grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={`v-${ratio}`}
                x1={width * ratio}
                y1={0}
                x2={width * ratio}
                y2={height}
                stroke="#64748B"
                strokeWidth={0.5}
              />
            ))}
          </g>
        )}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#gradient-${color.replace('#', '')})`}
          opacity={0.1}
        />

        {/* Price line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((value, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((value - min) / range) * height;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={2}
              fill={color}
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient
            id={`gradient-${color.replace('#', '')}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Value labels */}
      <div className="absolute top-0 left-0 text-xs text-gray-400">
        ${max.toFixed(2)}
      </div>
      <div className="absolute bottom-0 left-0 text-xs text-gray-400">
        ${min.toFixed(2)}
      </div>
    </div>
  );
};

/**
 * Candlestick Mini Chart
 */
interface CandlestickData {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MiniCandlestickChartProps {
  data: CandlestickData[];
  width?: number;
  height?: number;
  className?: string;
}

export const MiniCandlestickChart: React.FC<MiniCandlestickChartProps> = ({
  data,
  width = 300,
  height = 150,
  className = '',
}) => {
  if (!data || data.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-800 rounded ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-400 text-sm">No data</span>
      </div>
    );
  }

  const allValues = data.flatMap(d => [d.open, d.high, d.low, d.close]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const candleWidth = Math.max(2, (width / data.length) - 1);

  return (
    <div className={`relative ${className}`}>
      <svg width={width} height={height}>
        {data.map((candle, index) => {
          const x = (index / (data.length - 1)) * (width - candleWidth) + candleWidth / 2;
          const openY = height - ((candle.open - min) / range) * height;
          const closeY = height - ((candle.close - min) / range) * height;
          const highY = height - ((candle.high - min) / range) * height;
          const lowY = height - ((candle.low - min) / range) * height;
          
          const isUp = candle.close > candle.open;
          const bodyHeight = Math.abs(closeY - openY);
          const bodyY = Math.min(openY, closeY);

          return (
            <g key={index}>
              {/* Wick */}
              <line
                x1={x}
                y1={highY}
                x2={x}
                y2={lowY}
                stroke={isUp ? '#10B981' : '#EF4444'}
                strokeWidth={1}
              />
              
              {/* Body */}
              <rect
                x={x - candleWidth / 2}
                y={bodyY}
                width={candleWidth}
                height={Math.max(1, bodyHeight)}
                fill={isUp ? '#10B981' : '#EF4444'}
                opacity={0.8}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * Price Sparkline Component
 */
interface SparklineProps {
  prices: number[];
  width?: number;
  height?: number;
  showChange?: boolean;
  className?: string;
}

export const PriceSparkline: React.FC<SparklineProps> = ({
  prices,
  width = 100,
  height = 30,
  showChange = true,
  className = '',
}) => {
  if (!prices || prices.length === 0) return null;

  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[0];
  const change = currentPrice - previousPrice;
  const isPositive = change >= 0;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <MiniChart
        data={prices}
        width={width}
        height={height}
        color={isPositive ? '#10B981' : '#EF4444'}
        showGrid={false}
      />
      {showChange && (
        <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}
        </span>
      )}
    </div>
  );
};

export default MiniChart;