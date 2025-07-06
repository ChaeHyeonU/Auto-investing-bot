import { EventEmitter } from 'events';
import { Portfolio, Position, Order, TradingStrategy, DailyRiskStats, RiskLimits } from '../../../src/types/index';
import logger from '../../utils/logger';

/**
 * Advanced Risk Management System
 * 
 * Why Comprehensive Risk Management?
 * - Protects capital from catastrophic losses
 * - Ensures long-term trading sustainability
 * - Manages correlation risk across positions
 * - Implements dynamic position sizing based on volatility
 * - Provides real-time risk monitoring and alerts
 * - Enforces regulatory compliance and best practices
 */
export class RiskManager extends EventEmitter {
  private portfolio: Portfolio;
  private activePositions: Map<string, Position> = new Map();
  private dailyStats: DailyRiskStats;
  private riskLimits: RiskLimits;
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  private volatilityData: Map<string, VolatilityData> = new Map();

  // Circuit breaker states
  private circuitBreakerActive: boolean = false;
  private lastCircuitBreakerReset: Date = new Date();
  private consecutiveLosses: number = 0;

  constructor(initialPortfolio?: Portfolio) {
    super();
    this.portfolio = initialPortfolio || {
      totalValue: 10000,
      totalPnL: 0,
      totalPnLPercentage: 0,
      availableBalance: 10000,
      positions: [],
      assets: []
    };
    this.riskLimits = this.initializeRiskLimits();
    this.dailyStats = this.initializeDailyStats();
    
    logger.info('Risk Manager initialized', {
      initialPortfolioValue: this.portfolio.totalValue,
      service: 'RiskManager'
    });
  }

  /**
   * Initialize risk limits
   */
  private initializeRiskLimits(): RiskLimits {
    return {
      maxPositionSize: 0.1, // 10% of portfolio
      maxDailyLoss: 0.02, // 2% daily loss limit
      maxOpenPositions: 10, // Maximum 10 open positions
      maxDrawdown: 0.1 // 10% maximum drawdown
    };
  }

  /**
   * Initialize daily statistics
   */
  private initializeDailyStats(): DailyRiskStats {
    return {
      date: new Date(),
      tradesCount: 0,
      totalVolume: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      maxDrawdown: 0
    };
  }

  /**
   * Validate trade before execution
   */
  public validateTrade(tradeRequest: TradeRequest): RiskValidationResult {
    const checks: RiskCheck[] = [
      this.checkPositionSizeLimit(tradeRequest),
      this.checkPortfolioHeatLimit(tradeRequest),
      this.checkDailyLossLimit(tradeRequest),
      this.checkCorrelationRisk(tradeRequest),
      this.checkVolatilityRisk(tradeRequest),
      this.checkCircuitBreaker(tradeRequest),
      this.checkDrawdownLimit(tradeRequest),
      this.checkLeverageLimit(tradeRequest)
    ];

    const failedChecks = checks.filter(check => !check.passed);
    const approved = failedChecks.length === 0;

    if (!approved) {
      logger.warn('Trade rejected by risk management', {
        symbol: tradeRequest.symbol,
        action: tradeRequest.action,
        failedChecks: failedChecks.map(c => c.reason),
        service: 'RiskManager'
      });

      this.emit('tradeRejected', { tradeRequest, failedChecks });
    }

    return {
      approved,
      adjustedQuantity: approved ? tradeRequest.quantity : 0,
      riskChecks: checks,
      riskScore: this.calculateRiskScore(tradeRequest),
      recommendedStopLoss: this.calculateRecommendedStopLoss(tradeRequest),
      recommendedPositionSize: this.calculateOptimalPositionSize(tradeRequest)
    };
  }

  /**
   * Check position size limit
   */
  private checkPositionSizeLimit(trade: TradeRequest): RiskCheck {
    const positionValue = trade.quantity * trade.price;
    const maxPositionValue = this.portfolio.totalValue * this.riskLimits.maxPositionSizePercent / 100;

    return {
      name: 'Position Size Limit',
      passed: positionValue <= maxPositionValue,
      reason: positionValue > maxPositionValue ? 
        `Position size ${positionValue} exceeds limit ${maxPositionValue}` : 'OK',
      severity: 'HIGH'
    };
  }

  /**
   * Check portfolio heat limit (total risk exposure)
   */
  private checkPortfolioHeatLimit(trade: TradeRequest): RiskCheck {
    const currentHeat = this.calculatePortfolioHeat();
    const additionalHeat = this.calculateTradeHeat(trade);
    const totalHeat = currentHeat + additionalHeat;

    return {
      name: 'Portfolio Heat Limit',
      passed: totalHeat <= this.riskLimits.maxPortfolioHeat,
      reason: totalHeat > this.riskLimits.maxPortfolioHeat ? 
        `Portfolio heat ${totalHeat.toFixed(2)}% exceeds limit ${this.riskLimits.maxPortfolioHeat}%` : 'OK',
      severity: 'MEDIUM'
    };
  }

  /**
   * Check daily loss limit
   */
  private checkDailyLossLimit(trade: TradeRequest): RiskCheck {
    const potentialLoss = trade.quantity * trade.price * 0.05; // Assume 5% potential loss
    const totalPotentialLoss = this.dailyStats.realizedPnL + potentialLoss;

    return {
      name: 'Daily Loss Limit',
      passed: Math.abs(totalPotentialLoss) <= this.riskLimits.maxDailyLoss,
      reason: Math.abs(totalPotentialLoss) > this.riskLimits.maxDailyLoss ? 
        `Potential daily loss ${totalPotentialLoss} exceeds limit ${this.riskLimits.maxDailyLoss}` : 'OK',
      severity: 'HIGH'
    };
  }

  /**
   * Check correlation risk between positions
   */
  private checkCorrelationRisk(trade: TradeRequest): RiskCheck {
    const correlationRisk = this.calculateCorrelationRisk(trade.symbol);
    
    return {
      name: 'Correlation Risk',
      passed: correlationRisk <= this.riskLimits.maxCorrelationRisk,
      reason: correlationRisk > this.riskLimits.maxCorrelationRisk ? 
        `Correlation risk ${correlationRisk.toFixed(2)} exceeds limit ${this.riskLimits.maxCorrelationRisk}` : 'OK',
      severity: 'MEDIUM'
    };
  }

  /**
   * Check volatility risk
   */
  private checkVolatilityRisk(trade: TradeRequest): RiskCheck {
    const volatilityData = this.volatilityData.get(trade.symbol);
    if (!volatilityData) {
      return {
        name: 'Volatility Risk',
        passed: true,
        reason: 'No volatility data available',
        severity: 'LOW'
      };
    }

    const isHighVolatility = volatilityData.dailyVolatility > this.riskLimits.maxVolatilityThreshold;
    
    return {
      name: 'Volatility Risk',
      passed: !isHighVolatility || trade.quantity <= this.calculateVolatilityAdjustedSize(trade),
      reason: isHighVolatility ? 
        `High volatility detected: ${volatilityData.dailyVolatility.toFixed(2)}%` : 'OK',
      severity: 'MEDIUM'
    };
  }

  /**
   * Check circuit breaker
   */
  private checkCircuitBreaker(trade: TradeRequest): RiskCheck {
    return {
      name: 'Circuit Breaker',
      passed: !this.circuitBreakerActive,
      reason: this.circuitBreakerActive ? 'Circuit breaker active due to consecutive losses' : 'OK',
      severity: 'HIGH'
    };
  }

  /**
   * Check drawdown limit
   */
  private checkDrawdownLimit(trade: TradeRequest): RiskCheck {
    const currentDrawdown = this.calculateCurrentDrawdown();
    
    return {
      name: 'Drawdown Limit',
      passed: currentDrawdown <= this.riskLimits.maxDrawdown,
      reason: currentDrawdown > this.riskLimits.maxDrawdown ? 
        `Current drawdown ${currentDrawdown.toFixed(2)}% exceeds limit ${this.riskLimits.maxDrawdown}%` : 'OK',
      severity: 'HIGH'
    };
  }

  /**
   * Check leverage limit
   */
  private checkLeverageLimit(trade: TradeRequest): RiskCheck {
    const currentLeverage = this.calculateCurrentLeverage();
    
    return {
      name: 'Leverage Limit',
      passed: currentLeverage <= this.riskLimits.maxLeverage,
      reason: currentLeverage > this.riskLimits.maxLeverage ? 
        `Current leverage ${currentLeverage.toFixed(2)}x exceeds limit ${this.riskLimits.maxLeverage}x` : 'OK',
      severity: 'MEDIUM'
    };
  }

  /**
   * Calculate optimal position size based on Kelly Criterion and volatility
   */
  public calculateOptimalPositionSize(trade: TradeRequest): number {
    const strategy = this.getStrategyForSymbol(trade.symbol);
    if (!strategy) return trade.quantity;

    // Kelly Criterion calculation
    const winRate = strategy.performance.winRate / 100;
    const avgWin = strategy.performance.totalReturn / Math.max(1, strategy.performance.winningTrades);
    const avgLoss = Math.abs(strategy.performance.totalReturn / Math.max(1, strategy.performance.losingTrades));
    
    const kellyFraction = winRate - ((1 - winRate) / (avgWin / avgLoss));
    
    // Volatility adjustment
    const volatilityData = this.volatilityData.get(trade.symbol);
    const volatilityAdjustment = volatilityData ? 
      Math.max(0.5, 1 - (volatilityData.dailyVolatility / 100)) : 1;
    
    // Conservative Kelly (use 25% of full Kelly)
    const conservativeKelly = Math.max(0.01, Math.min(0.1, kellyFraction * 0.25));
    
    const optimalSize = (this.portfolio.totalValue * conservativeKelly * volatilityAdjustment) / trade.price;
    
    return Math.min(optimalSize, trade.quantity);
  }

  /**
   * Calculate recommended stop loss
   */
  private calculateRecommendedStopLoss(trade: TradeRequest): number {
    const volatilityData = this.volatilityData.get(trade.symbol);
    
    if (volatilityData) {
      // ATR-based stop loss (2x ATR)
      const atrStopLoss = volatilityData.atr * 2;
      return trade.action === 'BUY' ? 
        trade.price - atrStopLoss : 
        trade.price + atrStopLoss;
    }
    
    // Fallback to percentage-based stop loss
    const stopLossPercent = 0.02; // 2%
    return trade.action === 'BUY' ? 
      trade.price * (1 - stopLossPercent) : 
      trade.price * (1 + stopLossPercent);
  }

  /**
   * Update position after trade execution
   */
  public updatePosition(order: Order): void {
    const existingPosition = this.activePositions.get(order.symbol);
    
    if (existingPosition) {
      // Update existing position
      this.updateExistingPosition(existingPosition, order);
    } else {
      // Create new position
      const newPosition: Position = {
        symbol: order.symbol,
        quantity: order.executedQty,
        averagePrice: order.avgPrice || order.price || 0,
        avgPrice: order.avgPrice || order.price || 0,
        currentPrice: order.avgPrice || order.price || 0,
        pnl: 0,
        unrealizedPnL: 0,
        pnlPercentage: 0,
        value: order.executedQty * (order.avgPrice || order.price || 0),
        side: order.side === 'BUY' ? 'LONG' : 'SHORT'
      };
      
      this.activePositions.set(order.symbol, newPosition);
    }

    this.updateDailyStats(order);
    this.checkRiskThresholds();
  }

  /**
   * Close position and update risk metrics
   */
  public closePosition(symbol: string, closingOrder: Order): void {
    const position = this.activePositions.get(symbol);
    if (!position) return;

    // Calculate final P&L
    const finalPnL = position.pnl;
    
    // Update daily stats
    this.dailyStats.realizedPnL += finalPnL;
    this.dailyStats.tradesCount++;
    
    if (finalPnL > 0) {
      this.dailyStats.winningTrades++;
      this.consecutiveLosses = 0;
    } else {
      this.dailyStats.losingTrades++;
      this.consecutiveLosses++;
      
      // Check for circuit breaker activation
      if (this.consecutiveLosses >= this.riskLimits.maxConsecutiveLosses) {
        this.activateCircuitBreaker();
      }
    }

    // Remove position
    this.activePositions.delete(symbol);
    
    this.emit('positionClosed', { symbol, finalPnL, position });
    
    logger.info('Position closed by risk manager', {
      symbol,
      finalPnL,
      consecutiveLosses: this.consecutiveLosses,
      service: 'RiskManager'
    });
  }

  /**
   * Activate circuit breaker
   */
  private activateCircuitBreaker(): void {
    this.circuitBreakerActive = true;
    this.lastCircuitBreakerReset = new Date();
    
    this.emit('circuitBreakerActivated', {
      consecutiveLosses: this.consecutiveLosses,
      dailyPnL: this.dailyStats.realizedPnL
    });
    
    logger.warn('Circuit breaker activated', {
      consecutiveLosses: this.consecutiveLosses,
      dailyPnL: this.dailyStats.realizedPnL,
      service: 'RiskManager'
    });

    // Schedule automatic reset (e.g., after 1 hour)
    setTimeout(() => {
      this.resetCircuitBreaker();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(): void {
    this.circuitBreakerActive = false;
    this.consecutiveLosses = 0;
    this.lastCircuitBreakerReset = new Date();
    
    this.emit('circuitBreakerReset');
    
    logger.info('Circuit breaker reset', { service: 'RiskManager' });
  }

  /**
   * Update volatility data for symbol
   */
  public updateVolatilityData(symbol: string, prices: number[]): void {
    if (prices.length < 2) return;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100; // Convert to percentage

    // Calculate ATR (simplified)
    const atr = prices.reduce((sum, price, index) => {
      if (index === 0) return sum;
      return sum + Math.abs(price - prices[index - 1]);
    }, 0) / (prices.length - 1);

    this.volatilityData.set(symbol, {
      dailyVolatility: volatility,
      atr,
      lastUpdated: new Date()
    });
  }

  /**
   * Generate risk report
   */
  public generateRiskReport(): RiskReport {
    const portfolioHeat = this.calculatePortfolioHeat();
    const currentDrawdown = this.calculateCurrentDrawdown();
    const currentLeverage = this.calculateCurrentLeverage();
    
    return {
      timestamp: new Date(),
      portfolioValue: this.portfolio.totalValue,
      portfolioHeat,
      currentDrawdown,
      currentLeverage,
      dailyPnL: this.dailyStats.realizedPnL,
      dailyStats: this.dailyStats,
      activePositions: Array.from(this.activePositions.values()),
      riskLimits: this.riskLimits,
      circuitBreakerActive: this.circuitBreakerActive,
      consecutiveLosses: this.consecutiveLosses,
      riskAlerts: this.generateRiskAlerts()
    };
  }

  /**
   * Generate risk alerts
   */
  private generateRiskAlerts(): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    
    // Portfolio heat alert
    const portfolioHeat = this.calculatePortfolioHeat();
    if (portfolioHeat > this.riskLimits.maxPortfolioHeat * 0.8) {
      alerts.push({
        type: 'PORTFOLIO_HEAT',
        severity: 'MEDIUM',
        message: `Portfolio heat at ${portfolioHeat.toFixed(1)}%, approaching limit`,
        value: portfolioHeat,
        limit: this.riskLimits.maxPortfolioHeat
      });
    }

    // Drawdown alert
    const currentDrawdown = this.calculateCurrentDrawdown();
    if (currentDrawdown > this.riskLimits.maxDrawdown * 0.7) {
      alerts.push({
        type: 'DRAWDOWN',
        severity: 'HIGH',
        message: `Drawdown at ${currentDrawdown.toFixed(1)}%, approaching limit`,
        value: currentDrawdown,
        limit: this.riskLimits.maxDrawdown
      });
    }

    // Daily loss alert
    if (this.dailyStats.realizedPnL < -this.riskLimits.maxDailyLoss * 0.8) {
      alerts.push({
        type: 'DAILY_LOSS',
        severity: 'HIGH',
        message: `Daily loss at ${this.dailyStats.realizedPnL.toFixed(2)}, approaching limit`,
        value: Math.abs(this.dailyStats.realizedPnL),
        limit: this.riskLimits.maxDailyLoss
      });
    }

    return alerts;
  }

  // Helper methods and calculations

  private calculatePortfolioHeat(): number {
    let totalHeat = 0;
    
    for (const position of this.activePositions.values()) {
      const positionHeat = Math.abs(position.value) / this.portfolio.totalValue * 100;
      totalHeat += positionHeat;
    }
    
    return totalHeat;
  }

  private calculateTradeHeat(trade: TradeRequest): number {
    const tradeValue = trade.quantity * trade.price;
    return (tradeValue / this.portfolio.totalValue) * 100;
  }

  private calculateCorrelationRisk(symbol: string): number {
    // Simplified correlation calculation
    // In production, this would use actual price correlation data
    const symbolCorrelations = this.correlationMatrix.get(symbol);
    if (!symbolCorrelations) return 0;

    let totalCorrelationRisk = 0;
    let positionCount = 0;

    for (const position of this.activePositions.values()) {
      const correlation = symbolCorrelations.get(position.symbol) || 0;
      totalCorrelationRisk += Math.abs(correlation) * (position.value / this.portfolio.totalValue);
      positionCount++;
    }

    return positionCount > 0 ? totalCorrelationRisk / positionCount : 0;
  }

  private calculateVolatilityAdjustedSize(trade: TradeRequest): number {
    const volatilityData = this.volatilityData.get(trade.symbol);
    if (!volatilityData) return trade.quantity;

    const volatilityAdjustment = Math.max(0.1, 1 - (volatilityData.dailyVolatility / 100));
    return trade.quantity * volatilityAdjustment;
  }

  private calculateCurrentDrawdown(): number {
    const peakValue = Math.max(this.portfolio.totalValue, this.dailyStats.startOfDayBalance);
    return ((peakValue - this.portfolio.totalValue) / peakValue) * 100;
  }

  private calculateCurrentLeverage(): number {
    let totalPositionValue = 0;
    
    for (const position of this.activePositions.values()) {
      totalPositionValue += Math.abs(position.value);
    }
    
    return totalPositionValue / this.portfolio.totalValue;
  }

  private calculateRiskScore(trade: TradeRequest): number {
    // Calculate a composite risk score (0-100)
    let score = 0;
    
    // Position size component (0-25 points)
    const positionSizeRisk = (trade.quantity * trade.price) / this.portfolio.totalValue;
    score += Math.min(25, positionSizeRisk * 100);
    
    // Volatility component (0-25 points)
    const volatilityData = this.volatilityData.get(trade.symbol);
    if (volatilityData) {
      score += Math.min(25, volatilityData.dailyVolatility);
    }
    
    // Correlation component (0-25 points)
    const correlationRisk = this.calculateCorrelationRisk(trade.symbol);
    score += Math.min(25, correlationRisk * 100);
    
    // Portfolio heat component (0-25 points)
    const portfolioHeat = this.calculatePortfolioHeat();
    score += Math.min(25, portfolioHeat / 4);
    
    return Math.min(100, score);
  }

  private updateExistingPosition(position: Position, order: Order): void {
    // Update position based on order (averaging, partial close, etc.)
    if (order.side === 'BUY' && position.side === 'LONG') {
      // Adding to long position
      const totalValue = (position.quantity * position.averagePrice) + (order.executedQty * (order.avgPrice || order.price || 0));
      const totalQuantity = position.quantity + order.executedQty;
      position.averagePrice = totalValue / totalQuantity;
      position.quantity = totalQuantity;
    }
    // Add more position update logic as needed
  }

  private updateDailyStats(order: Order): void {
    // Update daily trading statistics
    this.dailyStats.tradesCount++;
    
    const tradeValue = order.executedQty * (order.avgPrice || order.price || 0);
    this.dailyStats.avgTradeSize = 
      (this.dailyStats.avgTradeSize * (this.dailyStats.tradesCount - 1) + tradeValue) / 
      this.dailyStats.tradesCount;
  }

  private checkRiskThresholds(): void {
    const report = this.generateRiskReport();
    
    if (report.riskAlerts.length > 0) {
      this.emit('riskAlert', report.riskAlerts);
    }
  }

  private getStrategyForSymbol(symbol: string): TradingStrategy | null {
    // This would be injected or retrieved from a strategy registry
    return null;
  }

  // Public getters
  public getPortfolioHeat(): number { return this.calculatePortfolioHeat(); }
  public getDailyStats(): DailyRiskStats { return this.dailyStats; }
  public getRiskLimits(): RiskLimits { return this.riskLimits; }
  public isCircuitBreakerActive(): boolean { return this.circuitBreakerActive; }
}

// Type definitions
interface TradeRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT';
  strategy: string;
}

interface RiskValidationResult {
  approved: boolean;
  adjustedQuantity: number;
  riskChecks: RiskCheck[];
  riskScore: number;
  recommendedStopLoss: number;
  recommendedPositionSize: number;
}

interface RiskCheck {
  name: string;
  passed: boolean;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}



interface VolatilityData {
  dailyVolatility: number;
  atr: number;
  lastUpdated: Date;
}

interface RiskReport {
  timestamp: Date;
  portfolioValue: number;
  portfolioHeat: number;
  currentDrawdown: number;
  currentLeverage: number;
  dailyPnL: number;
  dailyStats: DailyRiskStats;
  activePositions: Position[];
  riskLimits: RiskLimits;
  circuitBreakerActive: boolean;
  consecutiveLosses: number;
  riskAlerts: RiskAlert[];
}

interface RiskAlert {
  type: 'PORTFOLIO_HEAT' | 'DRAWDOWN' | 'DAILY_LOSS' | 'LEVERAGE' | 'CORRELATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  value: number;
  limit: number;
}