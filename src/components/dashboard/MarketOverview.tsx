'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/common/Card';
import { PriceSparkline } from '@/components/charts/MiniChart';
import { TechnicalIndicators } from '@/components/charts/TechnicalIndicators';

/**
 * Market Overview Component
 * 
 * Displays market data for multiple cryptocurrency pairs,
 * technical indicators, and market sentiment.
 */

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap?: number;
  priceHistory: number[];
  indicators?: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
}

interface MarketOverviewProps {
  selectedSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  className?: string;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  selectedSymbol = 'BTCUSDT',
  onSymbolSelect,
  className = '',
}) => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'price' | 'change' | 'volume'>('change');

  // Mock market data generator
  const generateMockMarketData = (): MarketData[] => {
    const symbols = [
      { symbol: 'BTCUSDT', name: 'Bitcoin' },
      { symbol: 'ETHUSDT', name: 'Ethereum' },
      { symbol: 'BNBUSDT', name: 'BNB' },
      { symbol: 'ADAUSDT', name: 'Cardano' },
      { symbol: 'SOLUSDT', name: 'Solana' },
      { symbol: 'XRPUSDT', name: 'XRP' },
      { symbol: 'DOTUSDT', name: 'Polkadot' },
      { symbol: 'AVAXUSDT', name: 'Avalanche' },
    ];

    return symbols.map(({ symbol, name }) => {
      const basePrice = symbol === 'BTCUSDT' ? 45000 : 
                       symbol === 'ETHUSDT' ? 2800 :
                       Math.random() * 1000 + 10;
      
      const change24h = (Math.random() - 0.5) * basePrice * 0.1;
      const changePercent24h = (change24h / basePrice) * 100;
      
      // Generate price history (24 hours of data)
      const priceHistory: number[] = [];
      let currentPrice = basePrice - change24h;
      
      for (let i = 0; i < 24; i++) {
        const hourlyChange = (Math.random() - 0.5) * 0.02; // 2% max hourly change
        currentPrice = currentPrice * (1 + hourlyChange);
        priceHistory.push(currentPrice);
      }

      return {
        symbol,
        name,
        price: basePrice,
        change24h,
        changePercent24h,
        volume24h: Math.random() * 1000000000 + 100000000,
        marketCap: basePrice * (Math.random() * 100000000 + 10000000),
        priceHistory,
        indicators: {
          rsi: Math.random() * 100,
          macd: {
            macd: (Math.random() - 0.5) * 100,
            signal: (Math.random() - 0.5) * 100,
            histogram: (Math.random() - 0.5) * 50,
          },
          trend: Math.random() > 0.6 ? 'BULLISH' : Math.random() > 0.3 ? 'BEARISH' : 'NEUTRAL',
        },
      };
    });
  };

  // Load market data
  useEffect(() => {
    const loadMarketData = async () => {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        const data = generateMockMarketData();
        setMarketData(data);
        setLoading(false);
      }, 1000);
    };

    loadMarketData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sort market data
  const sortedMarketData = [...marketData].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return b.price - a.price;
      case 'change':
        return b.changePercent24h - a.changePercent24h;
      case 'volume':
        return b.volume24h - a.volume24h;
      default:
        return 0;
    }
  });

  // Market statistics
  const gainers = marketData.filter(m => m.changePercent24h > 0).length;
  const losers = marketData.filter(m => m.changePercent24h < 0).length;
  const avgChange = marketData.reduce((sum, m) => sum + m.changePercent24h, 0) / marketData.length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Market Summary */}
      <Card title="Market Summary">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-slate-700 rounded">
            <div className="text-2xl font-bold text-green-400">{gainers}</div>
            <div className="text-sm text-gray-400">Gainers</div>
          </div>
          <div className="text-center p-3 bg-slate-700 rounded">
            <div className="text-2xl font-bold text-red-400">{losers}</div>
            <div className="text-sm text-gray-400">Losers</div>
          </div>
          <div className="text-center p-3 bg-slate-700 rounded">
            <div className={`text-2xl font-bold ${avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {avgChange.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">Avg Change</div>
          </div>
        </div>
      </Card>

      {/* Market Data Table */}
      <Card 
        title="Top Cryptocurrencies" 
        subtitle="Real-time prices and performance"
        loading={loading}
        headerAction={
          <div className="flex space-x-2">
            {(['price', 'change', 'volume'] as const).map((sort) => (
              <button
                key={sort}
                onClick={() => setSortBy(sort)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  sortBy === sort
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {sort.charAt(0).toUpperCase() + sort.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-2">
          {sortedMarketData.map((asset) => (
            <div
              key={asset.symbol}
              onClick={() => onSymbolSelect?.(asset.symbol)}
              className={`p-4 rounded-lg transition-all cursor-pointer hover:bg-slate-700 ${
                selectedSymbol === asset.symbol 
                  ? 'bg-blue-600/20 border border-blue-600/40' 
                  : 'bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Asset Info */}
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="font-medium text-white">{asset.name}</div>
                    <div className="text-sm text-gray-400">{asset.symbol}</div>
                  </div>
                  
                  {/* Technical Indicator Badge */}
                  {asset.indicators && (
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      asset.indicators.trend === 'BULLISH' ? 'bg-green-600/20 text-green-400' :
                      asset.indicators.trend === 'BEARISH' ? 'bg-red-600/20 text-red-400' :
                      'bg-yellow-600/20 text-yellow-400'
                    }`}>
                      {asset.indicators.trend}
                    </div>
                  )}
                </div>

                {/* Price and Chart */}
                <div className="flex items-center space-x-6">
                  {/* Sparkline */}
                  <PriceSparkline
                    prices={asset.priceHistory}
                    width={80}
                    height={30}
                    showChange={false}
                  />
                  
                  {/* Price Data */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      ${asset.price.toLocaleString()}
                    </div>
                    <div className={`text-sm font-medium ${
                      asset.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="text-right text-sm text-gray-400">
                    <div>Vol: ${(asset.volume24h / 1000000).toFixed(1)}M</div>
                    {asset.indicators && (
                      <div>RSI: {asset.indicators.rsi.toFixed(0)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Selected Asset Details */}
      {selectedSymbol && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={`${selectedSymbol} Technical Analysis`}>
            {(() => {
              const selectedAsset = marketData.find(a => a.symbol === selectedSymbol);
              if (!selectedAsset?.indicators) return <div>Loading indicators...</div>;

              return (
                <TechnicalIndicators
                  rsi={{
                    value: selectedAsset.indicators.rsi,
                    timestamp: new Date(),
                  }}
                  macd={{
                    ...selectedAsset.indicators.macd,
                    crossover: selectedAsset.indicators.macd.macd > selectedAsset.indicators.macd.signal ? 'BULLISH' : 'BEARISH',
                  }}
                  movingAverages={{
                    sma20: selectedAsset.price * 0.98,
                    sma50: selectedAsset.price * 0.95,
                    ema20: selectedAsset.price * 0.99,
                    ema50: selectedAsset.price * 0.96,
                  }}
                />
              );
            })()}
          </Card>

          <Card title="Market Statistics">
            {(() => {
              const selectedAsset = marketData.find(a => a.symbol === selectedSymbol);
              if (!selectedAsset) return <div>Loading...</div>;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">24h High</div>
                      <div className="text-lg font-bold text-white">
                        ${(selectedAsset.price * 1.05).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">24h Low</div>
                      <div className="text-lg font-bold text-white">
                        ${(selectedAsset.price * 0.95).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Market Cap</div>
                      <div className="text-lg font-bold text-white">
                        ${selectedAsset.marketCap ? (selectedAsset.marketCap / 1000000000).toFixed(1) + 'B' : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">24h Volume</div>
                      <div className="text-lg font-bold text-white">
                        ${(selectedAsset.volume24h / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
};

export default MarketOverview;