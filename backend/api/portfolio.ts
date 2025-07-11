import { Router, Request, Response, NextFunction } from 'express';
import { BinanceApiDirect } from '../services/binanceApiDirect';
import { PerformanceMonitor } from '../services/trading';
import logger from '../utils/logger';

/**
 * Portfolio API Routes
 * 
 * Provides RESTful endpoints for:
 * - Portfolio information and balances
 * - Account details and trading permissions
 * - Asset allocation and distribution
 * - Performance metrics and statistics
 * - Trade history and transaction logs
 */

export default function createPortfolioRoutes(
  binanceService: BinanceApiDirect,
  performanceMonitor: PerformanceMonitor
): Router {
  const router = Router();

  /**
   * GET /api/portfolio
   * Get comprehensive portfolio information
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountInfo = await binanceService.getAccountInfo();
      const performanceReport = performanceMonitor.generatePerformanceReport();

      const portfolioData = {
        account: {
          totalValue: accountInfo.totalValue,
          totalPnL: accountInfo.totalPnL,
          totalPnLPercentage: accountInfo.totalPnLPercentage,
          availableBalance: accountInfo.availableBalance
        },
        assets: accountInfo.assets.map(asset => ({
          asset: asset.asset,
          free: parseFloat(asset.free.toString()),
          locked: parseFloat(asset.locked.toString()),
          total: parseFloat(asset.total.toString()),
          usdValue: parseFloat(asset.total.toString()) // This would need price conversion
        })),
        positions: accountInfo.positions,
        performance: {
          dailyPnL: performanceReport.dailyMetrics.realizedPnL,
          totalTrades: performanceReport.overallMetrics.totalTrades,
          winRate: performanceReport.overallMetrics.overallWinRate,
          performanceScore: performanceReport.performanceScore
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: portfolioData
      });

      logger.info('Portfolio information requested', {
        requestId: (req as any).requestId,
        totalValue: accountInfo.totalValue,
        assetsCount: accountInfo.assets.length,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting portfolio information', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/balances
   * Get account balances for all assets
   */
  router.get('/balances', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountInfo = await binanceService.getAccountInfo();

      const balances = accountInfo.assets
        .filter(asset => parseFloat(asset.total.toString()) > 0)
        .map(asset => ({
          asset: asset.asset,
          free: parseFloat(asset.free.toString()),
          locked: parseFloat(asset.locked.toString()),
          total: parseFloat(asset.total.toString())
        }));

      res.json({
        success: true,
        data: balances,
        count: balances.length,
        timestamp: new Date().toISOString()
      });

      logger.info('Account balances requested', {
        requestId: (req as any).requestId,
        balancesCount: balances.length,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting account balances', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/performance
   * Get detailed performance metrics
   */
  router.get('/performance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = 30 } = req.query;
      
      const performanceReport = performanceMonitor.generatePerformanceReport();
      const historicalData = performanceMonitor.getHistoricalPerformance(Number(days));

      const performanceData = {
        current: {
          dailyMetrics: performanceReport.dailyMetrics,
          overallMetrics: performanceReport.overallMetrics,
          riskMetrics: performanceReport.riskMetrics,
          performanceScore: performanceReport.performanceScore
        },
        historical: historicalData.map(data => ({
          date: data.date,
          totalPnL: data.totalPnL,
          dailyPnL: data.dailyPnL,
          totalTrades: data.totalTrades,
          winRate: data.winRate,
          sharpeRatio: data.sharpeRatio,
          maxDrawdown: data.maxDrawdown
        })),
        strategies: performanceReport.strategies.map(strategy => ({
          strategyId: strategy.strategyId,
          metrics: {
            totalTrades: strategy.metrics.totalTrades,
            winRate: strategy.metrics.winRate,
            totalPnL: strategy.metrics.totalPnL,
            sharpeRatio: strategy.metrics.sharpeRatio,
            maxDrawdown: strategy.metrics.maxDrawdown
          }
        })),
        alerts: performanceReport.alerts,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: performanceData
      });

      logger.info('Performance metrics requested', {
        requestId: (req as any).requestId,
        days: Number(days),
        performanceScore: performanceReport.performanceScore,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting performance metrics', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/trades
   * Get trade history with filtering and pagination
   */
  router.get('/trades', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        symbol, 
        startTime, 
        endTime, 
        limit = 100, 
        offset = 0 
      } = req.query;

      // Build query parameters for Binance API
      const queryParams: any = {
        limit: Math.min(Number(limit), 1000)
      };

      if (symbol) queryParams.symbol = symbol;
      if (startTime) queryParams.startTime = Number(startTime);
      if (endTime) queryParams.endTime = Number(endTime);

      const trades = await binanceService.getTradeHistory(queryParams);

      // Apply offset for pagination (since Binance doesn't support offset)
      const paginatedTrades = trades.slice(Number(offset), Number(offset) + Number(limit));

      const formattedTrades = paginatedTrades.map((trade: any) => ({
        id: trade.id,
        symbol: trade.symbol,
        orderId: trade.orderId,
        side: trade.side,
        quantity: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        commission: parseFloat(trade.commission),
        commissionAsset: trade.commissionAsset,
        time: new Date(trade.time),
        isBuyer: trade.isBuyer,
        isMaker: trade.isMaker
      }));

      res.json({
        success: true,
        data: formattedTrades,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          count: formattedTrades.length,
          total: trades.length
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Trade history requested', {
        requestId: (req as any).requestId,
        symbol: symbol || 'all',
        tradesCount: formattedTrades.length,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting trade history', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/asset-allocation
   * Get asset allocation breakdown
   */
  router.get('/asset-allocation', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountInfo = await binanceService.getAccountInfo();

      // Calculate asset allocation
      const totalValue = accountInfo.totalValue;
      const allocation = accountInfo.assets
        .filter(asset => parseFloat(asset.total.toString()) > 0)
        .map(asset => {
          const value = parseFloat(asset.total.toString()); // This would need price conversion
          const percentage = (value / totalValue) * 100;
          
          return {
            asset: asset.asset,
            value,
            percentage: Math.round(percentage * 100) / 100,
            free: parseFloat(asset.free.toString()),
            locked: parseFloat(asset.locked.toString())
          };
        })
        .sort((a, b) => b.value - a.value);

      const allocationData = {
        totalValue,
        allocation,
        concentrationRisk: {
          topAssetPercentage: allocation[0]?.percentage || 0,
          top3AssetsPercentage: allocation.slice(0, 3).reduce((sum, asset) => sum + asset.percentage, 0),
          diversificationScore: Math.min(100, allocation.length * 10) // Simple diversification score
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: allocationData
      });

      logger.info('Asset allocation requested', {
        requestId: (req as any).requestId,
        totalValue,
        assetsCount: allocation.length,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting asset allocation', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/pnl-timeline
   * Get P&L timeline data for charting
   */
  router.get('/pnl-timeline', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = 30, interval = 'daily' } = req.query;

      const historicalData = performanceMonitor.getHistoricalPerformance(Number(days));

      const timelineData: TimelineData[] = historicalData.map(data => ({
        date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
        totalPnL: data.totalPnL,
        dailyPnL: data.dailyPnL,
        cumulativePnL: data.totalPnL, // This could be calculated cumulatively
        totalTrades: data.totalTrades,
        winRate: data.winRate
      }));

      // Group data by interval if needed
      let groupedData = timelineData;
      if (interval === 'weekly') {
        // Group by week logic here
        groupedData = groupDataByWeek(timelineData);
      } else if (interval === 'monthly') {
        // Group by month logic here
        groupedData = groupDataByMonth(timelineData);
      }

      res.json({
        success: true,
        data: {
          timeline: groupedData,
          summary: {
            totalPnL: timelineData.reduce((sum, item) => sum + item.totalPnL, 0),
            averageDailyPnL: timelineData.reduce((sum, item) => sum + item.dailyPnL, 0) / timelineData.length,
            bestDay: Math.max(...timelineData.map(item => item.dailyPnL)),
            worstDay: Math.min(...timelineData.map(item => item.dailyPnL)),
            totalTrades: timelineData.reduce((sum, item) => sum + item.totalTrades, 0)
          }
        },
        timestamp: new Date().toISOString()
      });

      logger.info('P&L timeline requested', {
        requestId: (req as any).requestId,
        days: Number(days),
        interval,
        dataPoints: groupedData.length,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting P&L timeline', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/history
   * Get portfolio history for performance tracking
   */
  router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit = 10, days = 30 } = req.query;
      
      const historicalData = performanceMonitor.getHistoricalPerformance(Number(days));
      const limitedData = historicalData.slice(0, Number(limit));

      const historyData = limitedData.map(data => ({
        date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
        totalValue: data.totalPnL || 0,
        dailyPnL: data.dailyPnL || 0,
        totalTrades: data.totalTrades || 0,
        winRate: data.winRate || 0,
        performance: {
          sharpeRatio: data.sharpeRatio || 0,
          maxDrawdown: data.maxDrawdown || 0
        }
      }));

      res.json({
        success: true,
        data: historyData,
        count: historyData.length,
        timestamp: new Date().toISOString()
      });

      logger.info('Portfolio history requested', {
        requestId: (req as any).requestId,
        limit: Number(limit),
        days: Number(days),
        dataPoints: historyData.length,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting portfolio history', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/portfolio/statistics
   * Get comprehensive portfolio statistics
   */
  router.get('/statistics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountInfo = await binanceService.getAccountInfo();
      const performanceReport = performanceMonitor.generatePerformanceReport();
      const dailyMetrics = performanceMonitor.getDailyMetrics();

      const statistics = {
        account: {
          totalValue: accountInfo.totalValue,
          totalPnL: accountInfo.totalPnL,
          totalPnLPercentage: accountInfo.totalPnLPercentage,
          availableBalance: accountInfo.availableBalance
        },
        trading: {
          totalTrades: performanceReport.overallMetrics.totalTrades,
          winningTrades: dailyMetrics.winningTrades,
          losingTrades: dailyMetrics.losingTrades,
          winRate: performanceReport.overallMetrics.overallWinRate,
          avgPnLPerTrade: performanceReport.overallMetrics.avgPnLPerTrade
        },
        risk: {
          sharpeRatio: performanceReport.riskMetrics.sharpeRatio,
          sortinoRatio: performanceReport.riskMetrics.sortinoRatio,
          maxDrawdown: performanceReport.riskMetrics.maxDrawdown,
          volatility: performanceReport.riskMetrics.volatility,
          var95: performanceReport.riskMetrics.var95
        },
        daily: {
          realizedPnL: dailyMetrics.realizedPnL,
          unrealizedPnL: dailyMetrics.unrealizedPnL,
          totalVolume: dailyMetrics.totalVolume,
          largestWin: dailyMetrics.largestWin,
          largestLoss: dailyMetrics.largestLoss
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: statistics
      });

      logger.info('Portfolio statistics requested', {
        requestId: (req as any).requestId,
        totalValue: accountInfo.totalValue,
        performanceScore: performanceReport.performanceScore,
        service: 'PortfolioAPI'
      });

    } catch (error) {
      logger.error('Error getting portfolio statistics', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'PortfolioAPI'
      });
      next(error);
    }
  });

  return router;
}

// Helper functions for data grouping
interface TimelineData {
  date: string;
  totalPnL: number;
  dailyPnL: number;
  cumulativePnL: number;
  totalTrades: number;
  winRate: number;
}

function groupDataByWeek(data: TimelineData[]): TimelineData[] {
  // Implementation for weekly grouping
  return data; // Placeholder
}

function groupDataByMonth(data: TimelineData[]): TimelineData[] {
  // Implementation for monthly grouping
  return data; // Placeholder
}