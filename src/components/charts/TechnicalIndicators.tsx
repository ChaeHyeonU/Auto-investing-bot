'use client';

import React from 'react';
import { Card } from '@/components/common/Card';

/**
 * Technical Indicators Display Component
 * 
 * Shows calculated technical indicators in a clean format.
 * Supports RSI, MACD, Bollinger Bands, and moving averages.
 */

interface IndicatorValue {
  value: number;
  timestamp: Date;
  signal?: 'BUY' | 'SELL' | 'NEUTRAL';
}

interface TechnicalIndicatorsProps {
  rsi?: IndicatorValue;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
    crossover?: 'BULLISH' | 'BEARISH' | 'NONE';
  };
  movingAverages?: {
    sma20: number;
    sma50: number;
    ema20: number;
    ema50: number;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
    position: 'UPPER' | 'MIDDLE' | 'LOWER' | 'NORMAL';
  };
  volume?: {
    current: number;
    average: number;
    trend: 'HIGH' | 'LOW' | 'NORMAL';
  };
  className?: string;
}

export const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({
  rsi,
  macd,
  movingAverages,
  bollingerBands,
  volume,
  className = '',
}) => {
  const getRsiSignal = (value?: number): string => {
    if (!value) return 'N/A';
    if (value > 70) return 'Overbought';
    if (value < 30) return 'Oversold';
    return 'Neutral';
  };

  const getRsiColor = (value?: number): string => {
    if (!value) return 'text-gray-400';
    if (value > 70) return 'text-red-400';
    if (value < 30) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getMacdSignal = (macdData?: any): string => {
    if (!macdData) return 'N/A';
    if (macdData.crossover === 'BULLISH') return 'Bullish';
    if (macdData.crossover === 'BEARISH') return 'Bearish';
    return macdData.macd > macdData.signal ? 'Above Signal' : 'Below Signal';
  };

  const getMacdColor = (macdData?: any): string => {
    if (!macdData) return 'text-gray-400';
    if (macdData.crossover === 'BULLISH') return 'text-green-400';
    if (macdData.crossover === 'BEARISH') return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* RSI Indicator */}
      {rsi && (
        <Card title="RSI (14)" className="bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-white">
                {rsi.value.toFixed(1)}
              </div>
              <div className={`text-sm ${getRsiColor(rsi.value)}`}>
                {getRsiSignal(rsi.value)}
              </div>
            </div>
            <div className="w-24 h-16 relative">
              {/* RSI Visual Gauge */}
              <div className="absolute inset-0 bg-slate-700 rounded">
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded"></div>
                <div 
                  className="absolute bottom-0 w-1 h-full bg-white rounded-full transition-all duration-300"
                  style={{ left: `${rsi.value}%` }}
                ></div>
                {/* RSI level markers */}
                <div className="absolute bottom-0 left-[30%] w-px h-2 bg-green-400"></div>
                <div className="absolute bottom-0 left-[70%] w-px h-2 bg-red-400"></div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* MACD Indicator */}
      {macd && (
        <Card title="MACD" className="bg-slate-800">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-white">
                  {macd.macd.toFixed(4)}
                </div>
                <div className={`text-sm ${getMacdColor(macd)}`}>
                  {getMacdSignal(macd)}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-gray-400">Signal: {macd.signal.toFixed(4)}</div>
                <div className="text-gray-400">Histogram: {macd.histogram.toFixed(4)}</div>
              </div>
            </div>
            
            {/* MACD Histogram Visualization */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded ${
                    macd.histogram > 0 ? 'bg-green-400' : 'bg-red-400'
                  }`}
                  style={{ 
                    height: `${Math.abs(macd.histogram) * 100 + 4}px`,
                    opacity: 0.7 
                  }}
                ></div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Moving Averages */}
      {movingAverages && (
        <Card title="Moving Averages" className="bg-slate-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">SMA 20</div>
              <div className="text-lg font-bold text-white">
                ${movingAverages.sma20.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">SMA 50</div>
              <div className="text-lg font-bold text-white">
                ${movingAverages.sma50.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">EMA 20</div>
              <div className="text-lg font-bold text-white">
                ${movingAverages.ema20.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">EMA 50</div>
              <div className="text-lg font-bold text-white">
                ${movingAverages.ema50.toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* MA Trend Indicator */}
          <div className="mt-3 pt-3 border-t border-slate-600">
            <div className="text-sm text-gray-400 mb-1">Trend Signal</div>
            <div className={`text-sm font-medium ${
              movingAverages.sma20 > movingAverages.sma50 ? 'text-green-400' : 'text-red-400'
            }`}>
              {movingAverages.sma20 > movingAverages.sma50 ? '📈 Bullish' : '📉 Bearish'}
            </div>
          </div>
        </Card>
      )}

      {/* Bollinger Bands */}
      {bollingerBands && (
        <Card title="Bollinger Bands" className="bg-slate-800">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <div className="text-gray-400">Upper</div>
                <div className="text-white font-medium">
                  ${bollingerBands.upper.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Middle</div>
                <div className="text-white font-medium">
                  ${bollingerBands.middle.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Lower</div>
                <div className="text-white font-medium">
                  ${bollingerBands.lower.toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Position Indicator */}
            <div className="pt-2 border-t border-slate-600">
              <div className="text-sm text-gray-400 mb-1">Position</div>
              <div className={`text-sm font-medium ${
                bollingerBands.position === 'UPPER' ? 'text-red-400' :
                bollingerBands.position === 'LOWER' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {bollingerBands.position === 'UPPER' && '🔴 Near Upper Band'}
                {bollingerBands.position === 'LOWER' && '🟢 Near Lower Band'}
                {bollingerBands.position === 'MIDDLE' && '🟡 Near Middle'}
                {bollingerBands.position === 'NORMAL' && '⚪ Normal Range'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Volume Analysis */}
      {volume && (
        <Card title="Volume Analysis" className="bg-slate-800">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-white">
                  {volume.current.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Current Volume</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">
                  Avg: {volume.average.toLocaleString()}
                </div>
                <div className={`text-sm font-medium ${
                  volume.trend === 'HIGH' ? 'text-green-400' :
                  volume.trend === 'LOW' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {volume.trend === 'HIGH' && '📈 High Volume'}
                  {volume.trend === 'LOW' && '📉 Low Volume'}
                  {volume.trend === 'NORMAL' && '➡️ Normal Volume'}
                </div>
              </div>
            </div>
            
            {/* Volume Bar */}
            <div className="relative w-full h-2 bg-slate-700 rounded">
              <div 
                className={`absolute left-0 top-0 h-full rounded transition-all duration-300 ${
                  volume.trend === 'HIGH' ? 'bg-green-400' :
                  volume.trend === 'LOW' ? 'bg-red-400' : 'bg-yellow-400'
                }`}
                style={{ 
                  width: `${Math.min(100, (volume.current / volume.average) * 50)}%` 
                }}
              ></div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TechnicalIndicators;