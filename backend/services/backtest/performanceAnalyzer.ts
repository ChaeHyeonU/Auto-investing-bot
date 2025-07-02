import { 
  BacktestResult, 
  BacktestTrade, 
  EquityPoint, 
  StrategyPerformance 
} from '@/types';
import logger from '../../utils/logger';

/**
 * Performance Analyzer
 * 
 * Why Comprehensive Performance Analysis?
 * - Provides objective evaluation of strategy effectiveness
 * - Identifies risk-adjusted returns beyond simple profit/loss
 * - Helps compare strategies on equal footing
 * - Reveals hidden risks and drawdown patterns
 * - Guides strategy optimization and portfolio allocation
 */
export class PerformanceAnalyzer {
  
  /**
   * Analyze complete backtest results
   */
  public static analyzeBacktestResult(result: BacktestResult): PerformanceAnalysis {
    logger.info('Starting performance analysis', {
      totalTrades: result.totalTrades,
      totalReturn: result.totalReturnPercentage,
      service: 'PerformanceAnalyzer'
    });

    const analysis: PerformanceAnalysis = {
      // Basic metrics
      basicMetrics: this.calculateBasicMetrics(result),
      
      // Risk metrics
      riskMetrics: this.calculateRiskMetrics(result),
      
      // Trade analysis
      tradeAnalysis: this.analyzeTradePerformance(result.trades),
      
      // Drawdown analysis
      drawdownAnalysis: this.analyzeDrawdowns(result.equity),
      
      // Time-based analysis
      timeAnalysis: this.analyzeTimePatterns(result.trades),
      
      // Market exposure
      exposureAnalysis: this.analyzeMarketExposure(result.trades, result.equity),
      
      // Benchmark comparison
      benchmarkComparison: this.compareToBenchmark(result),
      
      // Strategy rating
      overallRating: this.calculateOverallRating(result)
    };

    logger.info('Performance analysis completed', {
      overallRating: analysis.overallRating.score,
      sharpeRatio: analysis.riskMetrics.sharpeRatio,
      maxDrawdown: analysis.riskMetrics.maxDrawdownPercentage,
      service: 'PerformanceAnalyzer'
    });

    return analysis;
  }

  /**
   * Calculate basic performance metrics
   */
  private static calculateBasicMetrics(result: BacktestResult): BasicMetrics {
    const durationDays = Math.ceil(
      (result.config.endDate.getTime() - result.config.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const annualizedReturn = this.calculateAnnualizedReturn(
      result.totalReturnPercentage, 
      durationDays
    );

    return {
      totalReturn: result.totalReturn,
      totalReturnPercentage: result.totalReturnPercentage,
      annualizedReturn,
      totalTrades: result.totalTrades,
      winRate: result.winRate,
      profitFactor: result.profitFactor,
      avgTradeReturn: result.totalTrades > 0 ? result.totalReturn / result.totalTrades : 0,
      tradingDays: durationDays,
      tradesPerDay: result.totalTrades / durationDays,
      finalBalance: result.finalBalance,
      initialBalance: result.config.initialBalance
    };
  }

  /**
   * Calculate risk-adjusted metrics
   */
  private static calculateRiskMetrics(result: BacktestResult): RiskMetrics {
    const returns = this.calculatePeriodicReturns(result.equity);
    const volatility = this.calculateVolatility(returns);
    const downsideVolatility = this.calculateDownsideVolatility(returns);
    
    return {
      sharpeRatio: result.sharpeRatio,
      sortinoRatio: this.calculateSortinoRatio(returns, downsideVolatility),
      calmarRatio: this.calculateCalmarRatio(result.totalReturnPercentage, result.maxDrawdownPercentage),
      maxDrawdown: result.maxDrawdown,
      maxDrawdownPercentage: result.maxDrawdownPercentage,
      volatility: volatility * 100, // Convert to percentage
      downsideVolatility: downsideVolatility * 100,
      var95: this.calculateVaR(returns, 0.95),
      var99: this.calculateVaR(returns, 0.99),
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns)
    };
  }

  /**
   * Analyze trade performance patterns
   */
  private static analyzeTradePerformance(trades: BacktestTrade[]): TradeAnalysis {
    const completedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    
    if (completedTrades.length === 0) {
      return this.createEmptyTradeAnalysis();
    }

    const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = completedTrades.filter(t => (t.pnl || 0) < 0);
    
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
    
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)) / losingTrades.length : 0;
    
    const tradePnLs = completedTrades.map(t => t.pnl || 0);
    const largestWin = Math.max(...tradePnLs);
    const largestLoss = Math.min(...tradePnLs);
    
    // Calculate consecutive wins/losses
    const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateConsecutiveStats(completedTrades);
    
    // Calculate trade duration statistics
    const durations = completedTrades
      .filter(t => t.exitDate)
      .map(t => {
        const entryTime = t.entryDate.getTime();
        const exitTime = t.exitDate!.getTime();
        return (exitTime - entryTime) / (1000 * 60 * 60); // Duration in hours
      });
    
    const avgTradeDuration = durations.length > 0 ? 
      durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    return {
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / completedTrades.length) * 100,
      avgWin,
      avgLoss,
      avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
      largestWin,
      largestLoss,
      profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
      expectancy: this.calculateExpectancy(winningTrades, losingTrades, completedTrades.length),
      maxConsecutiveWins,
      maxConsecutiveLosses,
      avgTradeDuration,
      bestTradingDay: this.findBestTradingDay(completedTrades),
      worstTradingDay: this.findWorstTradingDay(completedTrades)
    };
  }

  /**
   * Analyze drawdown patterns
   */
  private static analyzeDrawdowns(equityHistory: EquityPoint[]): DrawdownAnalysis {
    if (equityHistory.length < 2) {
      return {
        maxDrawdown: 0,
        maxDrawdownPercentage: 0,
        maxDrawdownDuration: 0,
        avgDrawdown: 0,
        drawdownPeriods: 0,
        recoveryFactor: 0,
        ulcerIndex: 0
      };
    }

    const drawdowns = this.calculateDrawdownPeriods(equityHistory);
    const maxDrawdown = Math.max(...drawdowns.map(d => d.maxDrawdown));
    const maxDrawdownPct = Math.max(...drawdowns.map(d => d.maxDrawdownPercentage));
    const maxDuration = Math.max(...drawdowns.map(d => d.duration));
    const avgDrawdown = drawdowns.reduce((sum, d) => sum + d.maxDrawdown, 0) / drawdowns.length;
    
    // Calculate Ulcer Index (measure of downside risk)
    const ulcerIndex = this.calculateUlcerIndex(equityHistory);
    
    // Recovery factor (total return / max drawdown)
    const totalReturn = equityHistory[equityHistory.length - 1].equity - equityHistory[0].equity;
    const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

    return {
      maxDrawdown,
      maxDrawdownPercentage: maxDrawdownPct,
      maxDrawdownDuration: maxDuration,
      avgDrawdown,
      drawdownPeriods: drawdowns.length,
      recoveryFactor,
      ulcerIndex
    };
  }

  /**
   * Analyze time-based trading patterns
   */
  private static analyzeTimePatterns(trades: BacktestTrade[]): TimeAnalysis {
    const completedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    
    if (completedTrades.length === 0) {
      return {
        monthlyReturns: {},
        dayOfWeekPerformance: {},
        hourlyPerformance: {},
        seasonalPatterns: {},
        bestMonth: '',
        worstMonth: '',
        bestDayOfWeek: '',
        worstDayOfWeek: ''
      };
    }

    // Group trades by various time periods
    const monthlyReturns = this.groupTradesByMonth(completedTrades);
    const dayOfWeekPerformance = this.groupTradesByDayOfWeek(completedTrades);
    const hourlyPerformance = this.groupTradesByHour(completedTrades);
    const seasonalPatterns = this.groupTradesBySeason(completedTrades);

    return {
      monthlyReturns,
      dayOfWeekPerformance,
      hourlyPerformance,
      seasonalPatterns,
      bestMonth: this.findBestPeriod(monthlyReturns),
      worstMonth: this.findWorstPeriod(monthlyReturns),
      bestDayOfWeek: this.findBestPeriod(dayOfWeekPerformance),
      worstDayOfWeek: this.findWorstPeriod(dayOfWeekPerformance)
    };
  }

  /**
   * Analyze market exposure and position sizing
   */
  private static analyzeMarketExposure(trades: BacktestTrade[], equityHistory: EquityPoint[]): ExposureAnalysis {
    const totalPeriods = equityHistory.length;
    const periodsInMarket = this.calculatePeriodsInMarket(trades, equityHistory);
    const marketExposure = totalPeriods > 0 ? (periodsInMarket / totalPeriods) * 100 : 0;

    const positionSizes = trades
      .filter(t => t.status === 'CLOSED')
      .map(t => t.quantity * t.entryPrice);
    
    const avgPositionSize = positionSizes.length > 0 ? 
      positionSizes.reduce((sum, size) => sum + size, 0) / positionSizes.length : 0;
    
    const maxPositionSize = positionSizes.length > 0 ? Math.max(...positionSizes) : 0;
    const minPositionSize = positionSizes.length > 0 ? Math.min(...positionSizes) : 0;

    return {
      marketExposure,
      avgPositionSize,
      maxPositionSize,
      minPositionSize,
      positionSizeStdDev: this.calculateStandardDeviation(positionSizes),
      longShortRatio: this.calculateLongShortRatio(trades),
      avgHoldingPeriod: this.calculateAvgHoldingPeriod(trades)
    };
  }

  /**
   * Compare strategy performance to benchmark (buy and hold)
   */
  private static compareToBenchmark(result: BacktestResult): BenchmarkComparison {
    // Simplified benchmark comparison (buy and hold)
    // In a real implementation, you'd fetch actual benchmark data
    const benchmarkReturn = 15; // Assume 15% annual return for crypto market
    const annualizedReturn = this.calculateAnnualizedReturn(
      result.totalReturnPercentage,
      Math.ceil((result.config.endDate.getTime() - result.config.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      benchmarkReturn,
      strategyReturn: annualizedReturn,
      alpha: annualizedReturn - benchmarkReturn,
      beta: 1.0, // Simplified - would calculate actual beta with market data
      informationRatio: (annualizedReturn - benchmarkReturn) / 10, // Simplified
      trackingError: 10, // Simplified
      outperformancePeriods: 0, // Would calculate based on rolling periods
      underperformancePeriods: 0
    };
  }

  /**
   * Calculate overall strategy rating
   */
  private static calculateOverallRating(result: BacktestResult): OverallRating {
    const metrics = this.calculateBasicMetrics(result);
    const riskMetrics = this.calculateRiskMetrics(result);
    
    // Scoring system (0-100)
    let score = 0;
    const weights = {
      returns: 0.25,
      risk: 0.25,
      consistency: 0.25,
      efficiency: 0.25
    };

    // Returns score (0-30 points)
    const returnsScore = Math.min(30, Math.max(0, metrics.annualizedReturn / 2));
    score += returnsScore * weights.returns;

    // Risk score (0-30 points, inverse relationship with drawdown)
    const riskScore = Math.max(0, 30 - riskMetrics.maxDrawdownPercentage);
    score += riskScore * weights.risk;

    // Consistency score (based on win rate and Sharpe ratio)
    const consistencyScore = (result.winRate / 100 * 15) + (Math.min(3, Math.max(0, riskMetrics.sharpeRatio)) / 3 * 15);
    score += consistencyScore * weights.consistency;

    // Efficiency score (profit factor and trade frequency)
    const efficiencyScore = Math.min(30, Math.max(0, (result.profitFactor - 1) * 10)) + 
                           Math.min(10, metrics.tradesPerDay * 2);
    score += efficiencyScore * weights.efficiency;

    // Determine rating category
    let rating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'VERY_POOR';
    if (score >= 80) rating = 'EXCELLENT';
    else if (score >= 65) rating = 'GOOD';
    else if (score >= 50) rating = 'AVERAGE';
    else if (score >= 35) rating = 'POOR';
    else rating = 'VERY_POOR';

    return {
      score: Math.round(score),
      rating,
      strengths: this.identifyStrengths(result),
      weaknesses: this.identifyWeaknesses(result),
      recommendations: this.generateRecommendations(result)
    };
  }

  // Helper methods for calculations

  private static calculateAnnualizedReturn(totalReturnPct: number, days: number): number {
    if (days <= 0) return 0;
    const years = days / 365.25;
    return ((Math.pow(1 + totalReturnPct / 100, 1 / years) - 1) * 100);
  }

  private static calculatePeriodicReturns(equityHistory: EquityPoint[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityHistory.length; i++) {
      const prevEquity = equityHistory[i - 1].equity;
      const currentEquity = equityHistory[i].equity;
      if (prevEquity > 0) {
        returns.push((currentEquity - prevEquity) / prevEquity);
      }
    }
    return returns;
  }

  private static calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  }

  private static calculateDownsideVolatility(returns: number[]): number {
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length < 2) return 0;
    const variance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
    return Math.sqrt(variance);
  }

  private static calculateSortinoRatio(returns: number[], downsideVol: number): number {
    if (downsideVol === 0) return 0;
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const riskFreeRate = 0.02 / 252; // Daily risk-free rate
    return (meanReturn - riskFreeRate) / downsideVol;
  }

  private static calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    if (maxDrawdown === 0) return annualizedReturn > 0 ? Infinity : 0;
    return annualizedReturn / maxDrawdown;
  }

  private static calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  private static calculateSkewness(returns: number[]): number {
    if (returns.length < 3) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    
    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    return skewness;
  }

  private static calculateKurtosis(returns: number[]): number {
    if (returns.length < 4) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    
    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length;
    return kurtosis - 3; // Excess kurtosis
  }

  private static identifyStrengths(result: BacktestResult): string[] {
    const strengths: string[] = [];
    
    if (result.totalReturnPercentage > 20) strengths.push('High returns');
    if (result.winRate > 60) strengths.push('High win rate');
    if (result.maxDrawdownPercentage < 10) strengths.push('Low drawdown');
    if (result.sharpeRatio > 1.5) strengths.push('Excellent risk-adjusted returns');
    if (result.profitFactor > 2) strengths.push('Strong profit factor');
    
    return strengths;
  }

  private static identifyWeaknesses(result: BacktestResult): string[] {
    const weaknesses: string[] = [];
    
    if (result.totalReturnPercentage < 5) weaknesses.push('Low returns');
    if (result.winRate < 40) weaknesses.push('Low win rate');
    if (result.maxDrawdownPercentage > 25) weaknesses.push('High drawdown');
    if (result.sharpeRatio < 0.5) weaknesses.push('Poor risk-adjusted returns');
    if (result.profitFactor < 1.2) weaknesses.push('Weak profit factor');
    if (result.totalTrades < 10) weaknesses.push('Insufficient trading frequency');
    
    return weaknesses;
  }

  private static generateRecommendations(result: BacktestResult): string[] {
    const recommendations: string[] = [];
    
    if (result.maxDrawdownPercentage > 20) {
      recommendations.push('Consider tighter risk management and position sizing');
    }
    if (result.winRate < 45) {
      recommendations.push('Review entry criteria to improve signal quality');
    }
    if (result.profitFactor < 1.5) {
      recommendations.push('Optimize profit targets and stop losses');
    }
    if (result.totalTrades < 20) {
      recommendations.push('Consider adjusting parameters for more trading opportunities');
    }
    
    return recommendations;
  }

  // Additional helper methods would be implemented here...
  private static createEmptyTradeAnalysis(): TradeAnalysis {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinLossRatio: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      avgTradeDuration: 0,
      bestTradingDay: new Date(),
      worstTradingDay: new Date()
    };
  }

  private static calculateConsecutiveStats(trades: BacktestTrade[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
    let maxWins = 0, maxLosses = 0, currentWins = 0, currentLosses = 0;
    
    for (const trade of trades) {
      if ((trade.pnl || 0) > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }
    
    return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
  }

  private static calculateProfitFactor(winningTrades: BacktestTrade[], losingTrades: BacktestTrade[]): number {
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  }

  private static calculateExpectancy(winningTrades: BacktestTrade[], losingTrades: BacktestTrade[], totalTrades: number): number {
    const winRate = winningTrades.length / totalTrades;
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length : 0;
    
    return (winRate * avgWin) + ((1 - winRate) * avgLoss);
  }

  private static calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  // More helper methods would be implemented for complete functionality...
  private static findBestTradingDay(trades: BacktestTrade[]): Date { return new Date(); }
  private static findWorstTradingDay(trades: BacktestTrade[]): Date { return new Date(); }
  private static groupTradesByMonth(trades: BacktestTrade[]): { [key: string]: number } { return {}; }
  private static groupTradesByDayOfWeek(trades: BacktestTrade[]): { [key: string]: number } { return {}; }
  private static groupTradesByHour(trades: BacktestTrade[]): { [key: string]: number } { return {}; }
  private static groupTradesBySeason(trades: BacktestTrade[]): { [key: string]: number } { return {}; }
  private static findBestPeriod(periods: { [key: string]: number }): string { return ''; }
  private static findWorstPeriod(periods: { [key: string]: number }): string { return ''; }
  private static calculatePeriodsInMarket(trades: BacktestTrade[], equity: EquityPoint[]): number { return 0; }
  private static calculateLongShortRatio(trades: BacktestTrade[]): number { return 1; }
  private static calculateAvgHoldingPeriod(trades: BacktestTrade[]): number { return 0; }
  private static calculateDrawdownPeriods(equity: EquityPoint[]): Array<{ maxDrawdown: number; maxDrawdownPercentage: number; duration: number }> { return []; }
  private static calculateUlcerIndex(equity: EquityPoint[]): number { return 0; }
}

// Type definitions for analysis results
export interface PerformanceAnalysis {
  basicMetrics: BasicMetrics;
  riskMetrics: RiskMetrics;
  tradeAnalysis: TradeAnalysis;
  drawdownAnalysis: DrawdownAnalysis;
  timeAnalysis: TimeAnalysis;
  exposureAnalysis: ExposureAnalysis;
  benchmarkComparison: BenchmarkComparison;
  overallRating: OverallRating;
}

export interface BasicMetrics {
  totalReturn: number;
  totalReturnPercentage: number;
  annualizedReturn: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgTradeReturn: number;
  tradingDays: number;
  tradesPerDay: number;
  finalBalance: number;
  initialBalance: number;
}

export interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  volatility: number;
  downsideVolatility: number;
  var95: number;
  var99: number;
  skewness: number;
  kurtosis: number;
}

export interface TradeAnalysis {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  expectancy: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDuration: number;
  bestTradingDay: Date;
  worstTradingDay: Date;
}

export interface DrawdownAnalysis {
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  maxDrawdownDuration: number;
  avgDrawdown: number;
  drawdownPeriods: number;
  recoveryFactor: number;
  ulcerIndex: number;
}

export interface TimeAnalysis {
  monthlyReturns: { [month: string]: number };
  dayOfWeekPerformance: { [day: string]: number };
  hourlyPerformance: { [hour: string]: number };
  seasonalPatterns: { [season: string]: number };
  bestMonth: string;
  worstMonth: string;
  bestDayOfWeek: string;
  worstDayOfWeek: string;
}

export interface ExposureAnalysis {
  marketExposure: number;
  avgPositionSize: number;
  maxPositionSize: number;
  minPositionSize: number;
  positionSizeStdDev: number;
  longShortRatio: number;
  avgHoldingPeriod: number;
}

export interface BenchmarkComparison {
  benchmarkReturn: number;
  strategyReturn: number;
  alpha: number;
  beta: number;
  informationRatio: number;
  trackingError: number;
  outperformancePeriods: number;
  underperformancePeriods: number;
}

export interface OverallRating {
  score: number; // 0-100
  rating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'VERY_POOR';
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}