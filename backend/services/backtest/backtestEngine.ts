import { 
  BacktestConfig, 
  BacktestResult, 
  BacktestTrade, 
  EquityPoint, 
  CandlestickData, 
  TradingStrategy,
  Order,
  Position
} from '@/types';
import { IndicatorManager } from '../indicators/indicatorManager';
import logger from '../../utils/logger';

/**
 * Backtesting Engine
 * 
 * Why This Architecture?
 * - Realistic simulation of trading conditions with slippage and commissions
 * - Event-driven processing that mirrors real trading
 * - Comprehensive risk management and position sizing
 * - Detailed trade tracking and performance analytics
 * - Supports multiple strategies and timeframes
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private indicatorManager: IndicatorManager;
  private portfolio: {
    cash: number;
    positions: Map<string, Position>;
    equity: number;
    peakEquity: number;
    drawdown: number;
    maxDrawdown: number;
  };
  private trades: BacktestTrade[] = [];
  private equityHistory: EquityPoint[] = [];
  private currentCandle: CandlestickData | null = null;
  private candleIndex: number = 0;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.indicatorManager = new IndicatorManager(config.symbol);
    
    // Initialize portfolio
    this.portfolio = {
      cash: config.initialBalance,
      positions: new Map(),
      equity: config.initialBalance,
      peakEquity: config.initialBalance,
      drawdown: 0,
      maxDrawdown: 0
    };

    logger.info('Backtest engine initialized', {
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      initialBalance: config.initialBalance,
      service: 'BacktestEngine'
    });
  }

  /**
   * Run the complete backtest
   */
  public async runBacktest(
    historicalData: CandlestickData[],
    strategy: TradingStrategy
  ): Promise<BacktestResult> {
    logger.info('Starting backtest execution', {
      symbol: this.config.symbol,
      dataPoints: historicalData.length,
      strategy: strategy.name,
      service: 'BacktestEngine'
    });

    // Validate data
    if (historicalData.length === 0) {
      throw new Error('No historical data provided for backtesting');
    }

    // Filter data by date range
    const filteredData = this.filterDataByDateRange(historicalData);
    
    if (filteredData.length < 50) {
      throw new Error('Insufficient data for backtesting (minimum 50 candles required)');
    }

    // Reset state
    this.resetBacktestState();

    // Process each candle
    for (let i = 0; i < filteredData.length; i++) {
      this.candleIndex = i;
      this.currentCandle = filteredData[i];
      
      // Add data to indicators
      this.indicatorManager.addCandlestickData(this.currentCandle);
      
      // Skip first few candles to allow indicators to initialize
      if (i < 50) continue;

      // Process trading logic
      await this.processTradingLogic(strategy);
      
      // Update portfolio metrics
      this.updatePortfolioMetrics();
      
      // Record equity point
      this.recordEquityPoint();
    }

    // Generate final result
    const result = this.generateBacktestResult();
    
    logger.info('Backtest completed', {
      totalTrades: result.totalTrades,
      finalBalance: result.finalBalance,
      totalReturn: result.totalReturnPercentage,
      maxDrawdown: result.maxDrawdownPercentage,
      service: 'BacktestEngine'
    });

    return result;
  }

  /**
   * Process trading logic for current candle
   */
  private async processTradingLogic(strategy: TradingStrategy): Promise<void> {
    if (!this.currentCandle) return;

    // Get aggregated signal from indicators
    const signalResult = this.indicatorManager.getAggregatedSignal();
    
    // Check if signal meets strategy requirements
    const shouldTrade = this.evaluateStrategy(strategy, signalResult);
    
    if (!shouldTrade.trade) return;

    const currentPrice = this.getCurrentPrice();
    const position = this.portfolio.positions.get(this.config.symbol);
    
    if (shouldTrade.action === 'BUY' && !position) {
      // Open long position
      await this.openPosition('LONG', currentPrice, shouldTrade.confidence);
    } else if (shouldTrade.action === 'SELL' && !position) {
      // Open short position (if strategy allows)
      await this.openPosition('SHORT', currentPrice, shouldTrade.confidence);
    } else if (position) {
      // Check if we should close existing position
      const shouldClose = this.shouldClosePosition(position, signalResult, strategy);
      if (shouldClose) {
        await this.closePosition(position, currentPrice, shouldClose.reason);
      }
    }
  }

  /**
   * Evaluate strategy against current market conditions
   */
  private evaluateStrategy(
    strategy: TradingStrategy, 
    signalResult: any
  ): { trade: boolean; action: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
    
    // Check minimum confidence threshold
    if (signalResult.confidence < 60) {
      return { trade: false, action: 'HOLD', confidence: signalResult.confidence };
    }

    // Check if signal aligns with strategy rules
    const alignsWithStrategy = this.checkStrategyAlignment(strategy, signalResult);
    if (!alignsWithStrategy) {
      return { trade: false, action: 'HOLD', confidence: signalResult.confidence };
    }

    // Risk management checks
    const riskCheck = this.performRiskChecks(signalResult.signal);
    if (!riskCheck.passed) {
      return { trade: false, action: 'HOLD', confidence: signalResult.confidence };
    }

    return {
      trade: true,
      action: signalResult.signal,
      confidence: signalResult.confidence
    };
  }

  /**
   * Check if signals align with strategy requirements
   */
  private checkStrategyAlignment(strategy: TradingStrategy, signalResult: any): boolean {
    // Check required indicators
    for (const indicatorConfig of strategy.indicators) {
      const indicatorSignal = signalResult.breakdown[indicatorConfig.name];
      if (!indicatorSignal) continue;

      // Check if indicator signal aligns with overall signal
      if (indicatorSignal.signal !== signalResult.signal && indicatorSignal.strength > 70) {
        return false; // Strong conflicting signal
      }
    }

    // Check strategy rules
    for (const rule of strategy.rules) {
      if (rule.confidence > signalResult.confidence) {
        return false; // Signal doesn't meet rule confidence requirement
      }
    }

    return true;
  }

  /**
   * Perform risk management checks
   */
  private performRiskChecks(signal: 'BUY' | 'SELL'): { passed: boolean; reason?: string } {
    // Check maximum drawdown
    if (this.portfolio.drawdown > this.config.initialBalance * 0.2) { // 20% max drawdown
      return { passed: false, reason: 'Maximum drawdown exceeded' };
    }

    // Check available cash for new positions
    const requiredCash = this.calculateRequiredCash(signal);
    if (requiredCash > this.portfolio.cash) {
      return { passed: false, reason: 'Insufficient cash' };
    }

    // Check maximum position size
    const positionCount = this.portfolio.positions.size;
    if (positionCount >= 5) { // Maximum 5 concurrent positions
      return { passed: false, reason: 'Maximum positions limit reached' };
    }

    return { passed: true };
  }

  /**
   * Open a new position
   */
  private async openPosition(
    side: 'LONG' | 'SHORT', 
    price: number, 
    confidence: number
  ): Promise<void> {
    const positionSize = this.calculatePositionSize(price, confidence);
    const totalCost = positionSize * price;
    const commission = totalCost * this.config.commission;
    const slippage = this.calculateSlippage(price, positionSize);
    
    const effectivePrice = side === 'LONG' ? price + slippage : price - slippage;
    const totalCostWithFees = totalCost + commission;

    if (totalCostWithFees > this.portfolio.cash) {
      logger.warn('Insufficient cash for position', {
        required: totalCostWithFees,
        available: this.portfolio.cash,
        service: 'BacktestEngine'
      });
      return;
    }

    // Create position
    const position: Position = {
      symbol: this.config.symbol,
      quantity: positionSize,
      averagePrice: effectivePrice,
      currentPrice: effectivePrice,
      pnl: 0,
      pnlPercentage: 0,
      value: positionSize * effectivePrice,
      side
    };

    // Create trade record
    const trade: BacktestTrade = {
      id: `${this.config.symbol}_${Date.now()}_${this.candleIndex}`,
      entryDate: new Date(this.currentCandle!.openTime),
      symbol: this.config.symbol,
      side: side === 'LONG' ? 'BUY' : 'SELL',
      entryPrice: effectivePrice,
      quantity: positionSize,
      commission,
      reason: `Strategy signal with ${confidence.toFixed(1)}% confidence`,
      status: 'OPEN'
    };

    // Update portfolio
    this.portfolio.positions.set(this.config.symbol, position);
    this.portfolio.cash -= totalCostWithFees;
    this.trades.push(trade);

    logger.debug('Position opened', {
      symbol: this.config.symbol,
      side,
      quantity: positionSize,
      price: effectivePrice,
      confidence,
      service: 'BacktestEngine'
    });
  }

  /**
   * Close existing position
   */
  private async closePosition(
    position: Position, 
    price: number, 
    reason: string
  ): Promise<void> {
    const slippage = this.calculateSlippage(price, position.quantity);
    const effectivePrice = position.side === 'LONG' ? price - slippage : price + slippage;
    
    const proceeds = position.quantity * effectivePrice;
    const commission = proceeds * this.config.commission;
    const netProceeds = proceeds - commission;

    // Calculate P&L
    let pnl: number;
    if (position.side === 'LONG') {
      pnl = (effectivePrice - position.averagePrice) * position.quantity - commission;
    } else {
      pnl = (position.averagePrice - effectivePrice) * position.quantity - commission;
    }

    // Find and update trade record
    const openTrade = this.trades.find(t => t.status === 'OPEN' && t.symbol === this.config.symbol);
    if (openTrade) {
      openTrade.exitDate = new Date(this.currentCandle!.closeTime);
      openTrade.exitPrice = effectivePrice;
      openTrade.pnl = pnl;
      openTrade.pnlPercentage = (pnl / (position.averagePrice * position.quantity)) * 100;
      openTrade.status = 'CLOSED';
    }

    // Update portfolio
    this.portfolio.cash += netProceeds;
    this.portfolio.positions.delete(this.config.symbol);

    logger.debug('Position closed', {
      symbol: this.config.symbol,
      exitPrice: effectivePrice,
      pnl,
      reason,
      service: 'BacktestEngine'
    });
  }

  /**
   * Check if position should be closed
   */
  private shouldClosePosition(
    position: Position, 
    signalResult: any, 
    strategy: TradingStrategy
  ): { close: boolean; reason: string } | null {
    const currentPrice = this.getCurrentPrice();
    
    // Update position current price and P&L
    position.currentPrice = currentPrice;
    if (position.side === 'LONG') {
      position.pnl = (currentPrice - position.averagePrice) * position.quantity;
    } else {
      position.pnl = (position.averagePrice - currentPrice) * position.quantity;
    }
    position.pnlPercentage = (position.pnl / (position.averagePrice * position.quantity)) * 100;

    // Check stop loss
    const stopLossPercentage = strategy.riskManagement.stopLossPercentage;
    if (position.pnlPercentage <= -stopLossPercentage) {
      return { close: true, reason: `Stop loss triggered at ${position.pnlPercentage.toFixed(2)}%` };
    }

    // Check take profit
    const takeProfitPercentage = strategy.riskManagement.takeProfitPercentage;
    if (position.pnlPercentage >= takeProfitPercentage) {
      return { close: true, reason: `Take profit triggered at ${position.pnlPercentage.toFixed(2)}%` };
    }

    // Check signal reversal
    const isOppositeSignal = (
      (position.side === 'LONG' && signalResult.signal === 'SELL') ||
      (position.side === 'SHORT' && signalResult.signal === 'BUY')
    );
    
    if (isOppositeSignal && signalResult.confidence > 70) {
      return { close: true, reason: `Signal reversal with ${signalResult.confidence.toFixed(1)}% confidence` };
    }

    return null;
  }

  /**
   * Calculate position size based on risk management rules
   */
  private calculatePositionSize(price: number, confidence: number): number {
    const riskAmount = this.portfolio.equity * 0.02; // Risk 2% per trade
    const stopLossPercentage = 0.05; // 5% stop loss
    const stopLossAmount = price * stopLossPercentage;
    
    // Position size based on risk
    let positionSize = riskAmount / stopLossAmount;
    
    // Adjust based on confidence
    const confidenceMultiplier = Math.min(1.5, confidence / 100);
    positionSize *= confidenceMultiplier;
    
    // Maximum position size (10% of portfolio)
    const maxPositionValue = this.portfolio.equity * 0.1;
    const maxPositionSize = maxPositionValue / price;
    
    positionSize = Math.min(positionSize, maxPositionSize);
    
    // Ensure we can afford the position
    const maxAffordableSize = this.portfolio.cash / price * 0.95; // Leave 5% buffer
    positionSize = Math.min(positionSize, maxAffordableSize);
    
    return Math.floor(positionSize * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate slippage based on order size and market conditions
   */
  private calculateSlippage(price: number, quantity: number): number {
    // Simple slippage model - in reality this would be more sophisticated
    const baseSlippage = this.config.slippage || 0.001; // 0.1% base slippage
    const sizeImpact = Math.min(0.002, quantity / 10000 * 0.001); // Size impact
    
    return price * (baseSlippage + sizeImpact);
  }

  /**
   * Calculate required cash for new position
   */
  private calculateRequiredCash(signal: 'BUY' | 'SELL'): number {
    const price = this.getCurrentPrice();
    const estimatedPositionSize = this.calculatePositionSize(price, 70);
    return estimatedPositionSize * price * 1.1; // 10% buffer
  }

  /**
   * Update portfolio metrics
   */
  private updatePortfolioMetrics(): void {
    // Calculate total equity
    let totalPositionValue = 0;
    const currentPrice = this.getCurrentPrice();
    
    for (const position of this.portfolio.positions.values()) {
      position.currentPrice = currentPrice;
      if (position.side === 'LONG') {
        position.pnl = (currentPrice - position.averagePrice) * position.quantity;
      } else {
        position.pnl = (position.averagePrice - currentPrice) * position.quantity;
      }
      position.value = position.quantity * currentPrice;
      totalPositionValue += position.value;
    }
    
    this.portfolio.equity = this.portfolio.cash + totalPositionValue;
    
    // Update peak equity and drawdown
    if (this.portfolio.equity > this.portfolio.peakEquity) {
      this.portfolio.peakEquity = this.portfolio.equity;
    }
    
    this.portfolio.drawdown = this.portfolio.peakEquity - this.portfolio.equity;
    this.portfolio.maxDrawdown = Math.max(this.portfolio.maxDrawdown, this.portfolio.drawdown);
  }

  /**
   * Record equity point for performance tracking
   */
  private recordEquityPoint(): void {
    if (!this.currentCandle) return;
    
    const equityPoint: EquityPoint = {
      timestamp: new Date(this.currentCandle.closeTime),
      equity: this.portfolio.equity,
      drawdown: this.portfolio.drawdown
    };
    
    this.equityHistory.push(equityPoint);
  }

  /**
   * Get current price with slight randomization for more realistic simulation
   */
  private getCurrentPrice(): number {
    if (!this.currentCandle) return 0;
    
    // Use a weighted average of OHLC for more realistic price
    const { open, high, low, close } = this.currentCandle;
    return (open + high + low + close * 2) / 5; // Weight close price more heavily
  }

  /**
   * Filter historical data by date range
   */
  private filterDataByDateRange(data: CandlestickData[]): CandlestickData[] {
    return data.filter(candle => {
      const candleDate = new Date(candle.openTime);
      return candleDate >= this.config.startDate && candleDate <= this.config.endDate;
    });
  }

  /**
   * Reset backtest state
   */
  private resetBacktestState(): void {
    this.portfolio = {
      cash: this.config.initialBalance,
      positions: new Map(),
      equity: this.config.initialBalance,
      peakEquity: this.config.initialBalance,
      drawdown: 0,
      maxDrawdown: 0
    };
    
    this.trades = [];
    this.equityHistory = [];
    this.currentCandle = null;
    this.candleIndex = 0;
    this.indicatorManager.reset();
  }

  /**
   * Generate final backtest result
   */
  private generateBacktestResult(): BacktestResult {
    const totalReturn = this.portfolio.equity - this.config.initialBalance;
    const totalReturnPercentage = (totalReturn / this.config.initialBalance) * 100;
    
    const completedTrades = this.trades.filter(t => t.status === 'CLOSED');
    const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
    const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
    
    const grossProfit = completedTrades
      .filter(t => (t.pnl || 0) > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    const grossLoss = Math.abs(completedTrades
      .filter(t => (t.pnl || 0) < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    // Calculate Sharpe ratio
    const returns = this.calculateReturns();
    const sharpeRatio = this.calculateSharpeRatio(returns);
    
    const maxDrawdownPercentage = (this.portfolio.maxDrawdown / this.config.initialBalance) * 100;

    return {
      id: `backtest_${this.config.symbol}_${Date.now()}`,
      config: this.config,
      finalBalance: this.portfolio.equity,
      totalReturn,
      totalReturnPercentage,
      maxDrawdown: this.portfolio.maxDrawdown,
      maxDrawdownPercentage,
      totalTrades: completedTrades.length,
      winRate,
      profitFactor,
      sharpeRatio,
      trades: this.trades,
      equity: this.equityHistory,
      createdAt: new Date()
    };
  }

  /**
   * Calculate periodic returns for performance metrics
   */
  private calculateReturns(): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < this.equityHistory.length; i++) {
      const prevEquity = this.equityHistory[i - 1].equity;
      const currentEquity = this.equityHistory[i].equity;
      const returnPct = (currentEquity - prevEquity) / prevEquity;
      returns.push(returnPct);
    }
    
    return returns;
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const standardDeviation = Math.sqrt(variance);
    
    if (standardDeviation === 0) return 0;
    
    // Assuming risk-free rate of 2% annually, convert to period rate
    const riskFreeRate = 0.02 / 252; // Daily risk-free rate
    return (meanReturn - riskFreeRate) / standardDeviation;
  }
}