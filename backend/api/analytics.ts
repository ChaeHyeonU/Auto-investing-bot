import { Router, Request, Response, NextFunction } from 'express';
import { PerformanceMonitor, RiskManager } from '../services/trading';
import logger from '../utils/logger';

/**
 * Analytics API Routes
 * 
 * Provides RESTful endpoints for:
 * - Performance analytics and metrics
 * - Risk analysis and monitoring
 * - Trading statistics and insights
 * - Custom reports and visualizations
 * - Real-time analytics data
 */

export default function createAnalyticsRoutes(
  performanceMonitor: PerformanceMonitor,
  riskManager: RiskManager
): Router {
  const router = Router();

  /**
   * GET /api/analytics/dashboard
   * Get comprehensive dashboard analytics
   */
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const performanceReport = performanceMonitor.generatePerformanceReport();
      const riskReport = riskManager.generateRiskReport();
      const dailyMetrics = performanceMonitor.getDailyMetrics();

      const dashboardData = {
        overview: {
          portfolioValue: riskReport.portfolioValue,
          dailyPnL: dailyMetrics.realizedPnL,
          totalPnL: performanceReport.overallMetrics.totalPnL,
          performanceScore: performanceReport.performanceScore,
          riskLevel: calculateRiskLevel(riskReport)
        },
        performance: {
          winRate: performanceReport.overallMetrics.overallWinRate,
          totalTrades: performanceReport.overallMetrics.totalTrades,
          avgPnLPerTrade: performanceReport.overallMetrics.avgPnLPerTrade,
          sharpeRatio: performanceReport.riskMetrics.sharpeRatio,
          maxDrawdown: performanceReport.riskMetrics.maxDrawdown
        },
        risk: {
          portfolioHeat: riskReport.portfolioHeat,
          currentDrawdown: riskReport.currentDrawdown,
          circuitBreakerActive: riskReport.circuitBreakerActive,
          riskAlerts: riskReport.riskAlerts.length,
          dailyLossLimit: riskReport.riskLimits.maxDailyLoss
        },
        activity: {
          activePositions: riskReport.activePositions.length,
          dailyTrades: dailyMetrics.totalTrades,
          tradingVolume: dailyMetrics.totalVolume,
          largestWin: dailyMetrics.largestWin,
          largestLoss: dailyMetrics.largestLoss
        },
        alerts: performanceReport.alerts.slice(0, 5), // Last 5 alerts
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: dashboardData
      });

      logger.info('Dashboard analytics requested', {
        requestId: (req as any).requestId,
        performanceScore: performanceReport.performanceScore,
        riskLevel: dashboardData.overview.riskLevel,
        service: 'AnalyticsAPI'
      });

    } catch (error) {
      logger.error('Error getting dashboard analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
        service: 'AnalyticsAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/analytics/performance/summary
   * Get performance summary with key metrics
   */
  router.get('/performance/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = 'all' } = req.query;
      
      const performanceReport = performanceMonitor.generatePerformanceReport();
      const historicalData = performanceMonitor.getHistoricalPerformance(
        period === 'week' ? 7 : period === 'month' ? 30 : 365
      );

      const summary = {
        current: {
          totalReturn: performanceReport.overallMetrics.totalPnL,
          winRate: performanceReport.overallMetrics.overallWinRate,
          totalTrades: performanceReport.overallMetrics.totalTrades,
          avgPnLPerTrade: performanceReport.overallMetrics.avgPnLPerTrade,
          performanceScore: performanceReport.performanceScore
        },
        risk: {
          sharpeRatio: performanceReport.riskMetrics.sharpeRatio,
          sortinoRatio: performanceReport.riskMetrics.sortinoRatio,
          maxDrawdown: performanceReport.riskMetrics.maxDrawdown,
          volatility: performanceReport.riskMetrics.volatility,
          var95: performanceReport.riskMetrics.var95
        },
        trends: {
          equityCurve: historicalData.map(h => ({
            date: h.date,
            value: h.totalPnL
          })),
          drawdownCurve: historicalData.map(h => ({
            date: h.date,
            drawdown: h.maxDrawdown
          })),
          dailyReturns: historicalData.map(h => ({
            date: h.date,
            return: h.dailyPnL
          }))
        },
        benchmarks: {
          averageMonthlyReturn: calculateAverageMonthlyReturn(historicalData),
          bestMonth: getBestMonth(historicalData),
          worstMonth: getWorstMonth(historicalData),
          consecutiveWins: calculateConsecutiveWins(historicalData),
          consecutiveLosses: calculateConsecutiveLosses(historicalData)
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: summary,
        period
      });

      logger.info('Performance summary requested', {
        requestId: (req as any).requestId,
        period,
        performanceScore: summary.current.performanceScore,
        service: 'AnalyticsAPI'
      });

    } catch (error) {
      logger.error('Error getting performance summary', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'AnalyticsAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/analytics/risk/assessment
   * Get comprehensive risk assessment
   */
  router.get('/risk/assessment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const riskReport = riskManager.generateRiskReport();
      const performanceReport = performanceMonitor.generatePerformanceReport();

      const riskAssessment = {
        overall: {
          riskLevel: calculateRiskLevel(riskReport),
          riskScore: calculateRiskScore(riskReport, performanceReport),
          recommendation: generateRiskRecommendation(riskReport)
        },
        portfolio: {
          heat: riskReport.portfolioHeat,
          heatLimit: riskReport.riskLimits.maxPortfolioHeat,
          diversification: calculateDiversificationScore(riskReport.activePositions),
          concentration: calculateConcentrationRisk(riskReport.activePositions),
          leverage: riskReport.currentLeverage,
          leverageLimit: riskReport.riskLimits.maxLeverage
        },
        drawdown: {
          current: riskReport.currentDrawdown,
          maximum: performanceReport.riskMetrics.maxDrawdown,
          limit: riskReport.riskLimits.maxDrawdown,
          recoveryDays: calculateRecoveryDays(performanceReport),
          worstPeriod: getWorstDrawdownPeriod(performanceReport)
        },
        volatility: {
          daily: performanceReport.riskMetrics.volatility,
          annual: performanceReport.riskMetrics.volatility * Math.sqrt(252),
          ranking: classifyVolatility(performanceReport.riskMetrics.volatility),
          trend: calculateVolatilityTrend(performanceMonitor.getHistoricalPerformance(30))
        },
        alerts: {
          active: riskReport.riskAlerts,
          recent: riskReport.riskAlerts.filter(alert => 
            new Date().getTime() - new Date(riskReport.timestamp).getTime() < 24 * 60 * 60 * 1000
          ),
          severity: groupAlertsBySeverity(riskReport.riskAlerts)
        },
        limits: riskReport.riskLimits,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: riskAssessment
      });

      logger.info('Risk assessment requested', {
        requestId: (req as any).requestId,
        riskLevel: riskAssessment.overall.riskLevel,
        riskScore: riskAssessment.overall.riskScore,
        alertsCount: riskAssessment.alerts.active.length,
        service: 'AnalyticsAPI'
      });

    } catch (error) {
      logger.error('Error getting risk assessment', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'AnalyticsAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/analytics/trades/analysis
   * Get detailed trade analysis
   */
  router.get('/trades/analysis', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        timeframe = 'all',
        groupBy = 'day',
        symbol 
      } = req.query;

      const performanceReport = performanceMonitor.generatePerformanceReport();
      const dailyMetrics = performanceMonitor.getDailyMetrics();

      // Mock trade data - in production this would come from actual trade history
      const tradeAnalysis = {
        summary: {
          totalTrades: performanceReport.overallMetrics.totalTrades,
          winningTrades: dailyMetrics.winningTrades,
          losingTrades: dailyMetrics.losingTrades,
          winRate: performanceReport.overallMetrics.overallWinRate,
          avgTradeSize: dailyMetrics.totalVolume / Math.max(1, dailyMetrics.totalTrades),
          profitFactor: calculateProfitFactor(dailyMetrics)
        },
        distribution: {
          bySize: generateTradeSizeDistribution(),
          byDuration: generateTradeDurationDistribution(),
          byPnL: generatePnLDistribution(),
          byTimeOfDay: generateTimeOfDayDistribution(),
          byDayOfWeek: generateDayOfWeekDistribution()
        },
        patterns: {
          bestPerformingHours: getBestPerformingHours(),
          worstPerformingHours: getWorstPerformingHours(),
          seasonality: calculateSeasonality(),
          correlations: calculateTradeCorrelations()
        },
        metrics: {
          expectancy: calculateExpectancy(dailyMetrics),
          kelly: calculateKellyPercentage(dailyMetrics),
          ulcerIndex: calculateUlcerIndex(performanceReport),
          recoveryFactor: calculateRecoveryFactor(performanceReport),
          payoffRatio: calculatePayoffRatio(dailyMetrics)
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: tradeAnalysis,
        filters: { timeframe, groupBy, symbol }
      });

      logger.info('Trade analysis requested', {
        requestId: (req as any).requestId,
        timeframe,
        groupBy,
        symbol,
        totalTrades: tradeAnalysis.summary.totalTrades,
        service: 'AnalyticsAPI'
      });

    } catch (error) {
      logger.error('Error getting trade analysis', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'AnalyticsAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/analytics/strategies/comparison
   * Compare performance across different strategies
   */
  router.get('/strategies/comparison', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const performanceReport = performanceMonitor.generatePerformanceReport();

      const strategyComparison = {
        strategies: performanceReport.strategies.map(strategy => ({
          strategyId: strategy.strategyId,
          performance: {
            totalTrades: strategy.metrics.totalTrades,
            winRate: strategy.metrics.winRate,
            totalPnL: strategy.metrics.totalPnL,
            sharpeRatio: strategy.metrics.sharpeRatio,
            maxDrawdown: strategy.metrics.maxDrawdown,
            profitFactor: strategy.metrics.profitFactor,
            avgTrade: strategy.metrics.avgTrade
          },
          ranking: {
            byReturn: 0, // Would be calculated
            byWinRate: 0,
            bySharpe: 0,
            byDrawdown: 0
          },
          risk: {
            level: classifyStrategyRisk(strategy.metrics),
            score: calculateStrategyRiskScore(strategy.metrics),
            volatility: strategy.metrics.sharpeRatio > 0 ? 'low' : 'high'
          }
        })),
        rankings: {
          bestOverall: performanceReport.strategies[0]?.strategyId || null,
          mostConsistent: getMostConsistentStrategy(performanceReport.strategies),
          leastRisky: getLeastRiskyStrategy(performanceReport.strategies),
          mostProfitable: getMostProfitableStrategy(performanceReport.strategies)
        },
        correlations: calculateStrategyCorrelations(performanceReport.strategies),
        diversification: {
          score: calculateStrategyDiversification(performanceReport.strategies),
          recommendation: generateDiversificationRecommendation(performanceReport.strategies)
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: strategyComparison,
        count: strategyComparison.strategies.length
      });

      logger.info('Strategy comparison requested', {
        requestId: (req as any).requestId,
        strategiesCount: strategyComparison.strategies.length,
        service: 'AnalyticsAPI'
      });

    } catch (error) {
      logger.error('Error getting strategy comparison', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'AnalyticsAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/analytics/custom-report
   * Generate a custom analytics report
   */
  router.post('/custom-report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        reportType,
        dateRange,
        symbols,
        strategies,
        metrics,
        groupBy,
        format
      } = req.body;

      if (!reportType) {
        return res.status(400).json({
          success: false,
          error: 'reportType is required'
        });
      }

      // Generate custom report based on parameters
      const customReport = await generateCustomReport({
        reportType,
        dateRange: dateRange || { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
        symbols: symbols || [],
        strategies: strategies || [],
        metrics: metrics || ['return', 'winRate', 'sharpe', 'drawdown'],
        groupBy: groupBy || 'day',
        format: format || 'json'
      });

      res.json({
        success: true,
        data: customReport,
        reportId: `report-${Date.now()}`,
        timestamp: new Date().toISOString()
      });

      logger.info('Custom report generated', {
        requestId: (req as any).requestId,
        reportType,
        format,
        service: 'AnalyticsAPI'
      });

    } catch (error) {
      logger.error('Error generating custom report', {
        error: error.message,
        requestId: (req as any).requestId,
        service: 'AnalyticsAPI'
      });
      next(error);
    }
  });

  return router;

  // Helper functions
  function calculateRiskLevel(riskReport: any): string {
    const score = (riskReport.portfolioHeat / riskReport.riskLimits.maxPortfolioHeat) * 100;
    if (score < 30) return 'LOW';
    if (score < 70) return 'MEDIUM';
    return 'HIGH';
  }

  function calculateRiskScore(riskReport: any, performanceReport: any): number {
    // Simplified risk score calculation
    const heatScore = (riskReport.portfolioHeat / riskReport.riskLimits.maxPortfolioHeat) * 40;
    const drawdownScore = (riskReport.currentDrawdown / riskReport.riskLimits.maxDrawdown) * 30;
    const volatilityScore = Math.min(30, performanceReport.riskMetrics.volatility * 10);
    
    return Math.min(100, heatScore + drawdownScore + volatilityScore);
  }

  function generateRiskRecommendation(riskReport: any): string {
    if (riskReport.circuitBreakerActive) return 'CIRCUIT_BREAKER_ACTIVE';
    if (riskReport.portfolioHeat > riskReport.riskLimits.maxPortfolioHeat * 0.8) return 'REDUCE_EXPOSURE';
    if (riskReport.currentDrawdown > riskReport.riskLimits.maxDrawdown * 0.7) return 'REVIEW_STRATEGIES';
    return 'NORMAL_OPERATION';
  }

  function calculateDiversificationScore(positions: any[]): number {
    return Math.min(100, positions.length * 10);
  }

  function calculateConcentrationRisk(positions: any[]): number {
    if (positions.length === 0) return 0;
    const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.value), 0);
    const largestPosition = Math.max(...positions.map(pos => Math.abs(pos.value)));
    return (largestPosition / totalValue) * 100;
  }

  // Additional helper functions would be implemented here...
  function calculateRecoveryDays(performanceReport: any): number { return 0; }
  function getWorstDrawdownPeriod(performanceReport: any): any { return {}; }
  function classifyVolatility(volatility: number): string { return volatility > 0.02 ? 'HIGH' : 'LOW'; }
  function calculateVolatilityTrend(data: any[]): string { return 'STABLE'; }
  function groupAlertsBySeverity(alerts: any[]): any { return {}; }
  function calculateAverageMonthlyReturn(data: any[]): number { return 0; }
  function getBestMonth(data: any[]): any { return {}; }
  function getWorstMonth(data: any[]): any { return {}; }
  function calculateConsecutiveWins(data: any[]): number { return 0; }
  function calculateConsecutiveLosses(data: any[]): number { return 0; }
  function calculateProfitFactor(metrics: any): number { return 1; }
  function generateTradeSizeDistribution(): any[] { return []; }
  function generateTradeDurationDistribution(): any[] { return []; }
  function generatePnLDistribution(): any[] { return []; }
  function generateTimeOfDayDistribution(): any[] { return []; }
  function generateDayOfWeekDistribution(): any[] { return []; }
  function getBestPerformingHours(): any[] { return []; }
  function getWorstPerformingHours(): any[] { return []; }
  function calculateSeasonality(): any { return {}; }
  function calculateTradeCorrelations(): any { return {}; }
  function calculateExpectancy(metrics: any): number { return 0; }
  function calculateKellyPercentage(metrics: any): number { return 0; }
  function calculateUlcerIndex(report: any): number { return 0; }
  function calculateRecoveryFactor(report: any): number { return 0; }
  function calculatePayoffRatio(metrics: any): number { return 0; }
  function classifyStrategyRisk(metrics: any): string { return 'MEDIUM'; }
  function calculateStrategyRiskScore(metrics: any): number { return 50; }
  function getMostConsistentStrategy(strategies: any[]): string { return strategies[0]?.strategyId || ''; }
  function getLeastRiskyStrategy(strategies: any[]): string { return strategies[0]?.strategyId || ''; }
  function getMostProfitableStrategy(strategies: any[]): string { return strategies[0]?.strategyId || ''; }
  function calculateStrategyCorrelations(strategies: any[]): any { return {}; }
  function calculateStrategyDiversification(strategies: any[]): number { return 50; }
  function generateDiversificationRecommendation(strategies: any[]): string { return 'ADEQUATE'; }
  async function generateCustomReport(params: any): Promise<any> { return { type: params.reportType, data: [] }; }
}