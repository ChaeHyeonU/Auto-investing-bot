'use client';

import React, { useState } from 'react';
import { TradingStrategy } from '@/types';
import { Card, StatusCard } from '@/components/common/Card';
import { useTradingActions, useStrategyActions } from '@/hooks/useApi';

/**
 * Trading Controls Component
 * 
 * Provides interface for controlling trading operations including
 * start/stop trading, strategy management, and emergency controls.
 * Use Cursor AI to enhance with advanced controls and confirmations.
 */

interface TradingControlsProps {
  tradingStatus: any;
  strategies: TradingStrategy[];
  strategiesLoading?: boolean;
  className?: string;
}

export const TradingControls: React.FC<TradingControlsProps> = ({
  tradingStatus,
  strategies,
  strategiesLoading = false,
  className = '',
}) => {
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  
  // Trading action hooks
  const { 
    startTrading, 
    stopTrading, 
    emergencyStop, 
    loading: actionLoading, 
    error: actionError 
  } = useTradingActions();

  // Strategy action hooks
  const {
    activateStrategy,
    deactivateStrategy,
    loading: strategyActionLoading
  } = useStrategyActions();

  // Handle trading actions
  const handleStartTrading = async () => {
    await startTrading();
  };

  const handleStopTrading = async () => {
    await stopTrading();
  };

  const handleEmergencyStop = async () => {
    if (showEmergencyConfirm) {
      await emergencyStop();
      setShowEmergencyConfirm(false);
    } else {
      setShowEmergencyConfirm(true);
      // Auto-hide confirmation after 5 seconds
      setTimeout(() => setShowEmergencyConfirm(false), 5000);
    }
  };

  const handleStrategyToggle = async (strategyId: string, isActive: boolean) => {
    if (isActive) {
      await deactivateStrategy(strategyId);
    } else {
      await activateStrategy(strategyId);
    }
  };

  const isTrading = tradingStatus?.isActive || false;
  const isLoading = actionLoading || strategyActionLoading;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Display */}
      {actionError && (
        <div className="bg-red-600/10 border border-red-600/20 p-3 rounded-lg">
          <div className="text-red-400 text-sm">
            Error: {actionError}
          </div>
        </div>
      )}

      {/* Trading Status */}
      <StatusCard
        title="Trading Engine"
        status={isTrading ? 'online' : 'offline'}
        description={isTrading ? 'Trading is active' : 'Trading is stopped'}
        lastUpdate={tradingStatus?.lastUpdate ? new Date(tradingStatus.lastUpdate) : undefined}
      />

      {/* Main Trading Controls */}
      <Card title="Trading Controls">
        <div className="space-y-3">
          <button 
            onClick={handleStartTrading}
            disabled={isLoading || isTrading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {isLoading && actionLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>▶️</span>
                <span>Start Trading</span>
              </>
            )}
          </button>

          <button 
            onClick={handleStopTrading}
            disabled={isLoading || !isTrading}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {isLoading && actionLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Stopping...</span>
              </>
            ) : (
              <>
                <span>⏸️</span>
                <span>Stop Trading</span>
              </>
            )}
          </button>

          <button 
            onClick={handleEmergencyStop}
            disabled={isLoading}
            className={`w-full ${
              showEmergencyConfirm 
                ? 'bg-red-800 hover:bg-red-900 animate-pulse' 
                : 'bg-red-600 hover:bg-red-700'
            } disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2`}
          >
            {isLoading && actionLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Emergency Stop...</span>
              </>
            ) : (
              <>
                <span>🛑</span>
                <span>
                  {showEmergencyConfirm ? 'Confirm Emergency Stop' : 'Emergency Stop'}
                </span>
              </>
            )}
          </button>

          {showEmergencyConfirm && (
            <div className="text-xs text-red-400 text-center animate-fade-in">
              Click again to confirm emergency stop
            </div>
          )}
        </div>
      </Card>

      {/* Trading Statistics */}
      {tradingStatus && (
        <Card title="Trading Statistics">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-slate-700 rounded">
              <div className="text-lg font-bold text-white">
                {tradingStatus.totalTrades || 0}
              </div>
              <div className="text-xs text-gray-400">Total Trades</div>
            </div>
            <div className="text-center p-3 bg-slate-700 rounded">
              <div className="text-lg font-bold text-white">
                {tradingStatus.uptime || '0h 0m'}
              </div>
              <div className="text-xs text-gray-400">Uptime</div>
            </div>
            <div className="text-center p-3 bg-slate-700 rounded">
              <div className={`text-lg font-bold ${
                (tradingStatus.todaysPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${(tradingStatus.todaysPnL || 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Today's P&L</div>
            </div>
            <div className="text-center p-3 bg-slate-700 rounded">
              <div className="text-lg font-bold text-white">
                {tradingStatus.activeOrders || 0}
              </div>
              <div className="text-xs text-gray-400">Active Orders</div>
            </div>
          </div>
        </Card>
      )}

      {/* Active Strategies */}
      <Card title="Active Strategies" subtitle="Manage trading strategies" loading={strategiesLoading}>
        <div className="space-y-3">
          {strategies && strategies.length > 0 ? (
            strategies.map((strategy) => (
              <div key={strategy.id} className="p-4 bg-slate-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-white">{strategy.name}</div>
                    <div className="text-sm text-gray-400">{strategy.description}</div>
                  </div>
                  <button
                    onClick={() => handleStrategyToggle(strategy.id, strategy.isActive)}
                    disabled={isLoading}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      strategy.isActive
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {strategy.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                
                {strategy.performance && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-gray-400">Win Rate</div>
                      <div className="font-medium text-white">
                        {strategy.performance.winRate?.toFixed(1) || 'N/A'}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Trades</div>
                      <div className="font-medium text-white">
                        {strategy.performance.totalTrades || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">P&L</div>
                      <div className={`font-medium ${
                        (strategy.performance.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${(strategy.performance.totalPnL || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-center py-8">
              <div className="text-4xl mb-2">⚙️</div>
              <div>No strategies configured</div>
              <div className="text-xs mt-1">Add strategies to start automated trading</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TradingControls;