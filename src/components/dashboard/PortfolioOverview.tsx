'use client';

import React from 'react';
import { Portfolio, Order } from '@/types';
import { Card, MetricCard } from '@/components/common/Card';
import { DashboardSection } from '@/components/layout/DashboardLayout';

/**
 * Portfolio Overview Component
 * 
 * Displays comprehensive portfolio information including metrics,
 * recent trades, and performance indicators.
 * Use Cursor AI to enhance with charts and advanced visualizations.
 */

interface PortfolioOverviewProps {
  portfolio: Portfolio | null;
  recentTrades: Order[];
  loading?: boolean;
  className?: string;
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  portfolio,
  recentTrades,
  loading = false,
  className = '',
}) => {
  // Calculate portfolio metrics with safe values
  const portfolioValue = portfolio?.totalValue || 0;
  const portfolioPnL = portfolio?.totalPnL || 0;
  const portfolioPnLPercent = portfolioValue > 0 && portfolioPnL !== 0
    ? ((portfolioPnL / (portfolioValue - portfolioPnL)) * 100)
    : 0;

  const todaysPnL = portfolio?.dailyPnL || 0;
  const todaysPnLPercent = portfolioValue > 0 && todaysPnL !== 0
    ? ((todaysPnL / portfolioValue) * 100)
    : 0;

  return (
    <div className={className}>
      <DashboardSection title="Portfolio Overview">
        {/* Main Portfolio Metrics */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <MetricCard
            label="Total Portfolio Value"
            value={`$${portfolioValue.toLocaleString()}`}
            change={portfolioPnLPercent}
            trend={portfolioPnL >= 0 ? 'up' : 'down'}
            icon="💰"
          />
          
          <MetricCard
            label="Total P&L"
            value={`$${portfolioPnL.toLocaleString()}`}
            change={portfolioPnLPercent}
            changeType="percentage"
            trend={portfolioPnL >= 0 ? 'up' : 'down'}
            icon={portfolioPnL >= 0 ? '📈' : '📉'}
          />

          <MetricCard
            label="Today's P&L"
            value={`$${todaysPnL.toLocaleString()}`}
            change={todaysPnLPercent}
            changeType="percentage"
            trend={todaysPnL >= 0 ? 'up' : 'down'}
            icon={todaysPnL >= 0 ? '🟢' : '🔴'}
          />
          
          <MetricCard
            label="Available Balance"
            value={`$${(portfolio?.availableBalance || 0).toLocaleString()}`}
            icon="💳"
          />
        </div>

        {/* Portfolio Breakdown */}
        <Card title="Portfolio Breakdown" loading={loading}>
          {portfolio && (
            <div className="space-y-4">
              {/* Asset Allocation */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Asset Allocation</h4>
                <div className="space-y-2">
                  {(portfolio?.positions && Array.isArray(portfolio.positions) && portfolio.positions.length > 0) ? (
                    portfolio.positions.map((position, index) => (
                      <div key={position?.symbol || `position-${index}`} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                        <div className="flex items-center space-x-3">
                          <div className="text-sm font-medium text-white">{position?.symbol || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">
                            {(position?.quantity || 0).toFixed(6)} units
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">
                            ${((position?.quantity || 0) * (position?.avgPrice || 0)).toLocaleString()}
                          </div>
                          <div className={`text-xs ${(position?.unrealizedPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(position?.unrealizedPnL || 0) >= 0 ? '+' : ''}${(position?.unrealizedPnL || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-center py-4">
                      No positions
                    </div>
                  )}
                </div>
              </div>

              {/* Portfolio Statistics */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-slate-700 rounded">
                    <div className="text-lg font-bold text-white">
                      {portfolio.totalTrades || 0}
                    </div>
                    <div className="text-xs text-gray-400">Total Trades</div>
                  </div>
                  <div className="text-center p-3 bg-slate-700 rounded">
                    <div className="text-lg font-bold text-white">
                      {portfolio.winRate ? `${portfolio.winRate.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">Win Rate</div>
                  </div>
                  <div className="text-center p-3 bg-slate-700 rounded">
                    <div className="text-lg font-bold text-white">
                      {portfolio.maxDrawdown ? `${portfolio.maxDrawdown.toFixed(2)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">Max Drawdown</div>
                  </div>
                  <div className="text-center p-3 bg-slate-700 rounded">
                    <div className="text-lg font-bold text-white">
                      {portfolio.sharpeRatio ? portfolio.sharpeRatio.toFixed(2) : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">Sharpe Ratio</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Recent Trades */}
        <Card title="Recent Trades" subtitle={`Last ${recentTrades?.length || 0} trades`}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(recentTrades && Array.isArray(recentTrades) && recentTrades.length > 0) ? (
              recentTrades.map((trade, index) => (
                <div key={trade?.id || `trade-${index}`} className="p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-white">{trade.symbol}</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      trade.side === 'BUY' 
                        ? 'bg-green-600/20 text-green-400' 
                        : 'bg-red-600/20 text-red-400'
                    }`}>
                      {trade.side}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Quantity</div>
                      <div className="text-white">{trade.quantity}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Price</div>
                      <div className="text-white">${trade.avgPrice?.toFixed(4) || 'N/A'}</div>
                    </div>
                  </div>
                  
                  {trade.pnl && (
                    <div className="mt-2 text-right">
                      <span className={`text-sm font-medium ${
                        trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        P&L: {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mt-2">
                    {trade.timestamp ? new Date(trade.timestamp).toLocaleString() : 'N/A'}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-center py-8">
                <div className="text-4xl mb-2">📊</div>
                <div>No recent trades</div>
                <div className="text-xs mt-1">Trades will appear here when executed</div>
              </div>
            )}
          </div>
        </Card>
      </DashboardSection>
    </div>
  );
};

export default PortfolioOverview;