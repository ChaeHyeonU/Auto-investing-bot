import { EventEmitter } from 'events';
import { Portfolio, Position, Order, TradingStrategy } from '../../../src/types';
import logger from '../../utils/logger';
import config from '../../config/config';
import { DailyMetrics, AlertThresholds } from '../../../src/types/index';

/**
 * Performance Monitoring Service
 * 
 * Why Performance Monitoring?
 * - Real-time tracking of trading performance
 * - Early detection of strategy degradation
 * - Comprehensive metrics for decision making
 * - Alert system for abnormal performance
 * - Historical performance analysis
 * - Risk-adjusted return calculations
 */
export class PerformanceMonitor extends EventEmitter {
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private dailyMetrics: DailyMetrics;
  private historicalData: HistoricalPerformance[] = [];
  private alertThresholds: AlertThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor() {
    super();
    this.alertThresholds = this.initializeAlertThresholds();
    this.dailyMetrics = this.initializeDailyMetrics();
    
    logger.info('Performance Monitor initialized', { 
      service: 'PerformanceMonitor' 
    });
  }

  /**
   * Initialize alert thresholds
   */
  private initializeAlertThresholds(): AlertThresholds {
    return {
      maxDrawdown: 10, // 10%
      minWinRate: 40, // 40%
      dailyLossLimit: 5, // 5%
      minProfitFactor: 1.5,
      maxDailyLoss: 5,
      minSharpeRatio: 0.5
    };
  }

  /**
   * Initialize daily metrics
   */
  private initializeDailyMetrics(): DailyMetrics {
    return {
      date: new Date(),
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalVolume: 0,
      largestWin: 0,
      largestLoss: 0,
      largestUnrealizedGain: 0,
      largestUnrealizedLoss: 0,
      totalPositionValue: 0
    };
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already running', { 
        service: 'PerformanceMonitor' 
      });
      return;
    }

    this.isMonitoring = true;
    
    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.performPerformanceCheck();
    }, 10000);

    logger.info('Performance monitoring started', { 
      service: 'PerformanceMonitor' 
    });
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Performance monitoring stopped', { 
      service: 'PerformanceMonitor' 
    });
  }

  /**
   * Track trade execution
   */
  public trackTrade(order: Order, strategy: TradingStrategy): void {
    const strategyId = strategy.id;
    let metrics = this.performanceMetrics.get(strategyId);

    if (!metrics) {
      metrics = this.initializeMetrics(strategy);
      this.performanceMetrics.set(strategyId, metrics);
    }

    // Update trade metrics
    metrics.totalTrades++;
    metrics.totalVolume += order.executedQty * (order.avgPrice || order.price || 0);
    
    // Calculate trade P&L (simplified - in real implementation would track full trade lifecycle)
    const tradePnL = this.calculateTradePnL(order);
    metrics.totalPnL += tradePnL;
    
    if (tradePnL > 0) {
      metrics.winningTrades++;
      metrics.totalWinAmount += tradePnL;
      metrics.largestWin = Math.max(metrics.largestWin, tradePnL);
    } else {
      metrics.losingTrades++;
      metrics.totalLossAmount += Math.abs(tradePnL);
      metrics.largestLoss = Math.max(metrics.largestLoss, Math.abs(tradePnL));
    }

    // Update derived metrics
    this.updateDerivedMetrics(metrics);
    
    // Update daily metrics
    this.updateDailyMetrics(order, tradePnL);
    
    // Check for alerts
    this.checkPerformanceAlerts(metrics, strategy);

    logger.info('Trade tracked by performance monitor', {
      strategyId,
      symbol: order.symbol,
      pnl: tradePnL,
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      service: 'PerformanceMonitor'
    });
  }

  /**
   * Update position performance
   */
  public updatePositionPerformance(position: Position): void {
    // Update unrealized P&L metrics
    this.dailyMetrics.unrealizedPnL += position.pnl;
    this.dailyMetrics.totalPositionValue += position.value;
    
    // Update largest unrealized gain/loss
    if (position.pnl > 0) {
      this.dailyMetrics.largestUnrealizedGain = Math.max(
        this.dailyMetrics.largestUnrealizedGain, 
        position.pnl
      );
    } else {
      this.dailyMetrics.largestUnrealizedLoss = Math.max(
        this.dailyMetrics.largestUnrealizedLoss, 
        Math.abs(position.pnl)
      );
    }

    // Emit performance update
    this.emit('positionPerformanceUpdate', {
      symbol: position.symbol,
      pnl: position.pnl,
      pnlPercentage: position.pnlPercentage
    });
  }

  /**
   * Generate comprehensive performance report
   */
  public generatePerformanceReport(): PerformanceReport {
    const strategies = Array.from(this.performanceMetrics.entries()).map(([id, metrics]) => ({
      strategyId: id,
      metrics
    }));

    const overallMetrics = this.calculateOverallMetrics();
    const riskMetrics = this.calculateRiskMetrics();
    const alerts = this.generatePerformanceAlerts();

    return {
      timestamp: new Date(),
      dailyMetrics: this.dailyMetrics,
      overallMetrics,
      riskMetrics,
      strategies,
      alerts,
      performanceScore: this.calculatePerformanceScore(overallMetrics, riskMetrics)
    };
  }

  /**
   * Get strategy performance
   */
  public getStrategyPerformance(strategyId: string): PerformanceMetrics | null {
    return this.performanceMetrics.get(strategyId) || null;
  }

  /**
   * Get daily metrics
   */
  public getDailyMetrics(): DailyMetrics {
    return this.dailyMetrics;
  }

  /**
   * Get historical performance
   */
  public getHistoricalPerformance(days: number = 30): HistoricalPerformance[] {
    return this.historicalData.slice(-days);
  }

  /**
   * Calculate drawdown
   */
  public calculateDrawdown(equity: number[]): DrawdownMetrics {
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let peak = equity[0] || 0;
    let drawdownStart = 0;
    let drawdownEnd = 0;
    let longestDrawdownDays = 0;
    let currentDrawdownDays = 0;

    for (let i = 1; i < equity.length; i++) {
      if (equity[i] > peak) {
        peak = equity[i];
        currentDrawdown = 0;
        currentDrawdownDays = 0;
      } else {
        currentDrawdown = (peak - equity[i]) / peak;
        currentDrawdownDays++;
        
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
          drawdownStart = i - currentDrawdownDays;
          drawdownEnd = i;
        }
        
        longestDrawdownDays = Math.max(longestDrawdownDays, currentDrawdownDays);
      }
    }

    return {
      maxDrawdown: maxDrawdown * 100,
      currentDrawdown: currentDrawdown * 100,
      drawdownStart,
      drawdownEnd,
      longestDrawdownDays
    };
  }

  /**
   * Perform regular performance check
   */
  private performPerformanceCheck(): void {
    try {
      // Update all metrics
      for (const [strategyId, metrics] of this.performanceMetrics) {
        this.updateDerivedMetrics(metrics);
      }

      // Check for performance alerts
      this.checkOverallPerformanceAlerts();
      
      // Store historical data (daily)
      this.storeHistoricalData();
      
      // Emit performance update event
      this.emit('performanceUpdate', this.generatePerformanceReport());
      
    } catch (error) {
      logger.error('Error during performance check', { 
        error, 
        service: 'PerformanceMonitor' 
      });
    }
  }

  /**
   * Initialize performance metrics for strategy
   */
  private initializeMetrics(strategy: TradingStrategy): PerformanceMetrics {
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      totalWinAmount: 0,
      totalLossAmount: 0,
      totalVolume: 0,
      largestWin: 0,
      largestLoss: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgTrade: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      recoveryFactor: 0,
      expectancy: 0,
      startTime: new Date(),
      lastUpdateTime: new Date()
    };
  }

  /**
   * Update derived metrics
   */
  private updateDerivedMetrics(metrics: PerformanceMetrics): void {
    if (metrics.totalTrades === 0) return;

    // Win rate
    metrics.winRate = (metrics.winningTrades / metrics.totalTrades) * 100;

    // Profit factor
    metrics.profitFactor = metrics.totalLossAmount > 0 ? 
      metrics.totalWinAmount / metrics.totalLossAmount : 0;

    // Average win/loss
    metrics.avgWin = metrics.winningTrades > 0 ? 
      metrics.totalWinAmount / metrics.winningTrades : 0;
    metrics.avgLoss = metrics.losingTrades > 0 ? 
      metrics.totalLossAmount / metrics.losingTrades : 0;

    // Average trade
    metrics.avgTrade = metrics.totalPnL / metrics.totalTrades;

    // Expectancy
    const winProb = metrics.winRate / 100;
    const lossProb = 1 - winProb;
    metrics.expectancy = (winProb * metrics.avgWin) - (lossProb * metrics.avgLoss);

    // Update timestamp
    metrics.lastUpdateTime = new Date();
  }

  /**
   * Calculate trade P&L (simplified)
   */
  private calculateTradePnL(order: Order): number {
    // This is a simplified calculation
    // In real implementation, would track full trade lifecycle
    const executedValue = order.executedQty * (order.avgPrice || order.price || 0);
    const commission = executedValue * 0.001; // 0.1% commission
    
    // For demonstration, assuming a small random P&L
    const randomPnL = (Math.random() - 0.5) * executedValue * 0.02; // +/- 1% random
    
    return randomPnL - commission;
  }

  /**
   * Update daily metrics
   */
  private updateDailyMetrics(order: Order, tradePnL: number): void {
    this.dailyMetrics.totalTrades++;
    this.dailyMetrics.realizedPnL += tradePnL;
    this.dailyMetrics.totalVolume += order.executedQty * (order.avgPrice || order.price || 0);
    
    if (tradePnL > 0) {
      this.dailyMetrics.winningTrades++;
      this.dailyMetrics.largestWin = Math.max(this.dailyMetrics.largestWin, tradePnL);
    } else {
      this.dailyMetrics.losingTrades++;
      this.dailyMetrics.largestLoss = Math.max(this.dailyMetrics.largestLoss, Math.abs(tradePnL));
    }

    // Update win rate
    this.dailyMetrics.winRate = (this.dailyMetrics.winningTrades / this.dailyMetrics.totalTrades) * 100;
  }

  /**
   * Check performance alerts for specific strategy
   */
  private checkPerformanceAlerts(metrics: PerformanceMetrics, strategy: TradingStrategy): void {
    const alerts: PerformanceAlert[] = [];

    // Win rate alert
    if (metrics.totalTrades >= 10 && metrics.winRate < this.alertThresholds.minWinRate) {
      alerts.push({
        type: 'LOW_WIN_RATE',
        severity: 'MEDIUM',
        strategyId: strategy.id,
        message: `Win rate ${metrics.winRate.toFixed(1)}% below threshold`,
        value: metrics.winRate,
        threshold: this.alertThresholds.minWinRate
      });
    }

    // Profit factor alert
    if (metrics.totalTrades >= 10 && this.alertThresholds.minProfitFactor && metrics.profitFactor < this.alertThresholds.minProfitFactor) {
      alerts.push({
        type: 'LOW_PROFIT_FACTOR',
        severity: 'HIGH',
        strategyId: strategy.id,
        message: `Profit factor ${metrics.profitFactor.toFixed(2)} below threshold`,
        value: metrics.profitFactor,
        threshold: this.alertThresholds.minProfitFactor
      });
    }

    // Drawdown alert
    if (metrics.maxDrawdown > this.alertThresholds.maxDrawdown) {
      alerts.push({
        type: 'HIGH_DRAWDOWN',
        severity: 'HIGH',
        strategyId: strategy.id,
        message: `Max drawdown ${metrics.maxDrawdown.toFixed(2)}% exceeds threshold`,
        value: metrics.maxDrawdown,
        threshold: this.alertThresholds.maxDrawdown
      });
    }

    if (alerts.length > 0) {
      this.emit('performanceAlert', alerts);
    }
  }

  /**
   * Check overall performance alerts
   */
  private checkOverallPerformanceAlerts(): void {
    const alerts: PerformanceAlert[] = [];

    // Daily P&L alert
    if (this.dailyMetrics.realizedPnL < -this.alertThresholds.dailyLossLimit) {
      alerts.push({
        type: 'HIGH_DAILY_LOSS',
        severity: 'HIGH',
        strategyId: 'OVERALL',
        message: `Daily loss ${this.dailyMetrics.realizedPnL.toFixed(2)} exceeds threshold`,
        value: Math.abs(this.dailyMetrics.realizedPnL),
        threshold: this.alertThresholds.dailyLossLimit
      });
    }

    // Daily win rate alert
    if (this.dailyMetrics.totalTrades >= 5 && this.dailyMetrics.winRate < this.alertThresholds.minWinRate) {
      alerts.push({
        type: 'LOW_DAILY_WIN_RATE',
        severity: 'MEDIUM',
        strategyId: 'OVERALL',
        message: `Daily win rate ${this.dailyMetrics.winRate.toFixed(1)}% below threshold`,
        value: this.dailyMetrics.winRate,
        threshold: this.alertThresholds.minWinRate
      });
    }

    if (alerts.length > 0) {
      this.emit('performanceAlert', alerts);
    }
  }

  /**
   * Generate performance alerts
   */
  private generatePerformanceAlerts(): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];

    // Check each strategy
    for (const [strategyId, metrics] of this.performanceMetrics) {
      if (metrics.totalTrades >= 10) {
        if (metrics.winRate < this.alertThresholds.minWinRate) {
          alerts.push({
            type: 'LOW_WIN_RATE',
            severity: 'MEDIUM',
            strategyId,
            message: `Strategy ${metrics.strategyName} win rate is low`,
            value: metrics.winRate,
            threshold: this.alertThresholds.minWinRate
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Calculate overall metrics
   */
  private calculateOverallMetrics(): OverallMetrics {
    let totalTrades = 0;
    let totalPnL = 0;
    let totalWinningTrades = 0;
    let totalVolume = 0;

    for (const metrics of this.performanceMetrics.values()) {
      totalTrades += metrics.totalTrades;
      totalPnL += metrics.totalPnL;
      totalWinningTrades += metrics.winningTrades;
      totalVolume += metrics.totalVolume;
    }

    const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;

    return {
      totalTrades,
      totalPnL,
      totalVolume,
      overallWinRate,
      activeStrategies: this.performanceMetrics.size,
      avgPnLPerTrade: totalTrades > 0 ? totalPnL / totalTrades : 0
    };
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(): RiskMetrics {
    const overallMetrics = this.calculateOverallMetrics();
    
    return {
      sharpeRatio: this.calculateSharpeRatio(),
      sortinoRatio: this.calculateSortinoRatio(),
      maxDrawdown: this.calculateMaxDrawdown(),
      volatility: this.calculateVolatility(),
      var95: this.calculateVaR(0.95),
      var99: this.calculateVaR(0.99)
    };
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(overall: OverallMetrics, risk: RiskMetrics): number {
    let score = 50; // Base score

    // Return component (30 points)
    if (overall.totalPnL > 0) {
      score += Math.min(30, (overall.totalPnL / 1000) * 10);
    } else {
      score += Math.max(-30, (overall.totalPnL / 1000) * 10);
    }

    // Win rate component (20 points)
    score += (overall.overallWinRate / 100) * 20;

    // Risk component (20 points)
    if (risk.sharpeRatio > 1) {
      score += Math.min(20, risk.sharpeRatio * 10);
    } else {
      score += risk.sharpeRatio * 10;
    }

    // Drawdown penalty (-30 points max)
    score -= Math.min(30, risk.maxDrawdown / 2);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Store historical data
   */
  private storeHistoricalData(): void {
    const now = new Date();
    const today = now.toDateString();
    
    // Only store once per day
    if (this.historicalData.length > 0 && 
        this.historicalData[this.historicalData.length - 1].date.toDateString() === today) {
      return;
    }

    const overallMetrics = this.calculateOverallMetrics();
    const riskMetrics = this.calculateRiskMetrics();

    this.historicalData.push({
      date: now,
      totalPnL: overallMetrics.totalPnL,
      totalTrades: overallMetrics.totalTrades,
      winRate: overallMetrics.overallWinRate,
      sharpeRatio: riskMetrics.sharpeRatio,
      maxDrawdown: riskMetrics.maxDrawdown,
      dailyPnL: this.dailyMetrics.realizedPnL
    });

    // Keep only last 365 days
    if (this.historicalData.length > 365) {
      this.historicalData = this.historicalData.slice(-365);
    }
  }


  // Risk calculation methods (simplified implementations)
  private calculateSharpeRatio(): number {
    // Simplified Sharpe ratio calculation
    const returns = this.historicalData.map(h => h.dailyPnL);
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateSortinoRatio(): number {
    // Simplified Sortino ratio calculation
    const returns = this.historicalData.map(h => h.dailyPnL);
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return avgReturn > 0 ? 10 : 0;

    const downwardStdDev = Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length);
    
    return downwardStdDev > 0 ? avgReturn / downwardStdDev : 0;
  }

  private calculateMaxDrawdown(): number {
    const equity = this.historicalData.map(h => h.totalPnL);
    if (equity.length < 2) return 0;

    return this.calculateDrawdown(equity).maxDrawdown;
  }

  private calculateVolatility(): number {
    const returns = this.historicalData.map(h => h.dailyPnL);
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateVaR(confidence: number): number {
    const returns = this.historicalData.map(h => h.dailyPnL).sort((a, b) => a - b);
    if (returns.length === 0) return 0;

    const index = Math.floor((1 - confidence) * returns.length);
    return Math.abs(returns[index] || 0);
  }

  // Public getters
  public isMonitoringActive(): boolean { return this.isMonitoring; }
  public getAlertThresholds(): AlertThresholds { return this.alertThresholds; }
}

// Type definitions
interface PerformanceMetrics {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  totalWinAmount: number;
  totalLossAmount: number;
  totalVolume: number;
  largestWin: number;
  largestLoss: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  expectancy: number;
  startTime: Date;
  lastUpdateTime: Date;
}



interface OverallMetrics {
  totalTrades: number;
  totalPnL: number;
  totalVolume: number;
  overallWinRate: number;
  activeStrategies: number;
  avgPnLPerTrade: number;
}

interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  var95: number;
  var99: number;
}

interface PerformanceAlert {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  strategyId: string;
  message: string;
  value: number;
  threshold: number;
}



interface DrawdownMetrics {
  maxDrawdown: number;
  currentDrawdown: number;
  drawdownStart: number;
  drawdownEnd: number;
  longestDrawdownDays: number;
}

interface HistoricalPerformance {
  date: Date;
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  dailyPnL: number;
}

interface PerformanceReport {
  timestamp: Date;
  dailyMetrics: DailyMetrics;
  overallMetrics: OverallMetrics;
  riskMetrics: RiskMetrics;
  strategies: Array<{
    strategyId: string;
    metrics: PerformanceMetrics;
  }>;
  alerts: PerformanceAlert[];
  performanceScore: number;
}