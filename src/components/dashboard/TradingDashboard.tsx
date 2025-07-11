'use client';

import React, { useState, useEffect } from 'react';
import { Portfolio, TradingStrategy, Order, PriceUpdate } from '@/types';
import { MetricCard } from '@/components/common/Card';
import { DashboardLayout, DashboardGrid } from '@/components/layout/DashboardLayout';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';
import { TradingControls } from '@/components/trading/TradingControls';
import { PriceChart } from '@/components/charts/PriceChart';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { usePortfolio, useTradingStatus, useActiveStrategies, usePortfolioHistory } from '@/hooks/useApi';
import { useTradingWebSocket } from '@/hooks/useWebSocket';

/**
 * Main Trading Dashboard Component
 * 
 * Enhanced with proper API integration and real-time data.
 * Uses Cursor AI components and hooks for professional trading interface.
 */

interface TradingDashboardProps {
  className?: string;
}

export const TradingDashboard: React.FC<TradingDashboardProps> = ({ 
  className = '' 
}) => {
  // API Hooks for data fetching
  const { data: portfolio, loading: portfolioLoading, error: portfolioError, refetch: refetchPortfolio } = usePortfolio();
  const { data: tradingStatus, loading: statusLoading, refetch: refetchStatus } = useTradingStatus();
  const { data: strategies, loading: strategiesLoading, refetch: refetchStrategies } = useActiveStrategies();
  const { data: recentTrades, loading: tradesLoading, refetch: refetchTrades } = usePortfolioHistory(10);
  
  // Type-safe data with fallbacks
  const safePortfolio = portfolio as Portfolio | null;
  const safeTradingStatus = tradingStatus as any;
  const safeStrategies = strategies as TradingStrategy[] | null;
  const safeRecentTrades = recentTrades as Order[] | null;

  // WebSocket for real-time updates
  const { data: wsData, connected: isConnected, error: wsError, reconnect: wsReconnect } = useTradingWebSocket();
  
  // Log WebSocket connection status
  useEffect(() => {
    if (isConnected) {
      console.log('✅ Real-time WebSocket connected');
    } else if (wsError) {
      console.log('⚠️ WebSocket error:', wsError);
    }
  }, [isConnected, wsError]);

  // Local state for real-time updates
  const [livePortfolio, setLivePortfolio] = useState<Portfolio | null>(null);
  const [liveTrades, setLiveTrades] = useState<Order[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [showMarketOverview, setShowMarketOverview] = useState(false);

  // Initialize live data with API data
  useEffect(() => {
    if (safePortfolio) {
      setLivePortfolio(safePortfolio);
    }
  }, [safePortfolio]);

  useEffect(() => {
    if (safeRecentTrades) {
      setLiveTrades(safeRecentTrades);
    }
  }, [safeRecentTrades]);

  // Handle WebSocket updates
  useEffect(() => {
    if (wsData) {
      switch (wsData.type) {
        case 'priceUpdate':
          // Update price displays (handled by chart components)
          break;
        case 'tradeExecuted':
          // Add new trade to recent trades
          setLiveTrades(prev => [wsData.trade, ...prev.slice(0, 9)]);
          break;
        case 'portfolioUpdate':
          // Update portfolio values
          setLivePortfolio(wsData.portfolio);
          break;
        default:
          console.log('Unknown WebSocket message type:', wsData.type);
      }
    }
  }, [wsData]);

  // Current data for display
  const currentPortfolio = livePortfolio || safePortfolio;
  const currentTrades = liveTrades.length > 0 ? liveTrades : (safeRecentTrades || []);
  const portfolioPnL = currentPortfolio?.totalPnL || 0;
  const portfolioValue = currentPortfolio?.totalValue || 0;
  const portfolioPnLPercent = portfolioValue > 0 && portfolioPnL !== 0
    ? ((portfolioPnL / (portfolioValue - portfolioPnL)) * 100)
    : 0;

  // Loading state
  if (portfolioLoading || statusLoading) {
    return (
      <DashboardLayout 
        title="Auto Trading System" 
        subtitle="Loading..."
        isConnected={isConnected}
        className={className}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <div className="text-white text-xl">Loading Trading Dashboard...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (portfolioError) {
    return (
      <DashboardLayout 
        title="Auto Trading System" 
        subtitle="Error loading data"
        isConnected={isConnected}
        className={className}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-400 text-6xl mb-4">❌</div>
            <div className="text-white text-xl mb-2">Dashboard Error</div>
            <div className="text-gray-400">{portfolioError}</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Auto Trading System"
      subtitle="Real-time trading dashboard"
      isConnected={isConnected}
      className={className}
      headerActions={
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              refetchPortfolio();
              refetchStatus();
              refetchStrategies();
              refetchTrades();
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
            title="Refresh Data"
          >
            🔄
          </button>
          {wsError && (
            <button
              onClick={wsReconnect}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 transition-colors"
              title="Reconnect WebSocket"
            >
              🔌
            </button>
          )}
          <button
            onClick={() => setShowMarketOverview(!showMarketOverview)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showMarketOverview 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            {showMarketOverview ? 'Hide Market' : 'Show Market'}
          </button>
          <MetricCard
            label="Portfolio Value"
            value={`$${(currentPortfolio?.totalValue || 0).toLocaleString()}`}
            change={portfolioPnLPercent}
            trend={portfolioPnL >= 0 ? 'up' : 'down'}
            className="bg-transparent border-none"
          />
        </div>
      }
      sidebarContent={
        <TradingControls
          tradingStatus={safeTradingStatus}
          strategies={safeStrategies || []}
          strategiesLoading={strategiesLoading}
        />
      }
    >
      {showMarketOverview ? (
        /* Market Overview Layout */
        <DashboardGrid columns={1}>
          <MarketOverview
            selectedSymbol={selectedSymbol}
            onSymbolSelect={setSelectedSymbol}
          />
        </DashboardGrid>
      ) : (
        /* Trading Dashboard Layout */
        <DashboardGrid columns={3}>
          {/* Portfolio Overview */}
          <div className="lg:col-span-1">
            <PortfolioOverview
              portfolio={currentPortfolio}
              recentTrades={currentTrades}
              loading={tradesLoading}
            />
          </div>

          {/* Price Chart Area */}
          <div className="lg:col-span-2">
            <PriceChart
              symbol={selectedSymbol}
              timeframe="1h"
              showIndicators={true}
              showVolume={true}
              height={500}
              className="h-full"
            />
          </div>
        </DashboardGrid>
      )}
    </DashboardLayout>
  );
};

export default TradingDashboard;