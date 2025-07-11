import { Router, Request, Response, NextFunction } from 'express';
import { BacktestEngine } from '../services/backtest/backtestEngine';
import { StrategyFactory } from '../services/backtest/strategyFactory';
import { PerformanceAnalyzer } from '../services/backtest/performanceAnalyzer';
import { BinanceApiDirect } from '../services/binanceApiDirect';
import logger from '../utils/logger';

/**
 * Backtest API Routes
 * 
 * Provides RESTful endpoints for:
 * - Running backtests with different strategies
 * - Managing backtest jobs and results
 * - Comparing strategy performance
 * - Downloading historical data
 * - Optimizing strategy parameters
 */

export default function createBacktestRoutes(binanceService: BinanceApiDirect): Router {
  const router = Router();
  // BacktestEngine will be created with config when needed
  const strategyFactory = new StrategyFactory();
  const performanceAnalyzer = new PerformanceAnalyzer();

  // Store active backtest jobs
  interface BacktestJob {
    jobId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime: Date;
    completedAt?: Date;
    duration: number;
    strategyId: string;
    symbol: string;
    timeframe: string;
    startDate: string;
    endDate: string;
    initialBalance?: number;
    parameters?: any;
    result?: any;
    error?: string;
    promise?: Promise<any>;
  }
  
  const activeJobs = new Map<string, BacktestJob>();

  /**
   * POST /api/backtest/run
   * Run a new backtest
   */
  router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        strategyId,
        symbol,
        timeframe,
        startDate,
        endDate,
        initialBalance,
        parameters,
        riskManagement
      } = req.body;

      // Validate required fields
      if (!strategyId || !symbol || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'strategyId, symbol, startDate, and endDate are required'
        });
      }

      // Generate job ID
      const jobId = `backtest-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Create backtest configuration
      const config = {
        jobId,
        strategyId,
        symbol,
        timeframe: timeframe || '1h',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        initialBalance: initialBalance || 10000,
        parameters: parameters || {},
        riskManagement: riskManagement || {}
      };

      // Start backtest asynchronously
      const backtestPromise = runBacktest(config);
      activeJobs.set(jobId, {
        jobId,
        status: 'running',
        startTime: new Date(),
        duration: 0,
        strategyId,
        symbol,
        timeframe,
        startDate,
        endDate,
        initialBalance,
        parameters,
        promise: backtestPromise
      });

      // Return job ID immediately
      res.status(202).json({
        success: true,
        message: 'Backtest started successfully',
        data: {
          jobId,
          status: 'running',
          estimatedDuration: '2-5 minutes',
          config: {
            strategyId,
            symbol,
            timeframe: config.timeframe,
            startDate: config.startDate,
            endDate: config.endDate,
            initialBalance: config.initialBalance
          }
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Backtest started', {
        requestId: (req as any).requestId,
        jobId,
        strategyId,
        symbol,
        timeframe: config.timeframe,
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error starting backtest', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/backtest/status/:jobId
   * Get backtest job status
   */
  router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Backtest job not found'
        });
      }

      const status: any = {
        jobId,
        status: job.status,
        startTime: job.startTime,
        duration: Date.now() - job.startTime.getTime(),
        config: {
          strategyId: job.strategyId,
          symbol: job.symbol,
          timeframe: job.timeframe,
          startDate: job.startDate,
          endDate: job.endDate
        }
      };

      // Check if job is completed
      if (job.status === 'running') {
        try {
          const result = await Promise.race([
            job.promise,
            new Promise(resolve => setTimeout(() => resolve(null), 100))
          ]);
          
          if (result) {
            job.status = 'completed';
            job.result = result;
            job.completedAt = new Date();
          }
        } catch (error) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.completedAt = new Date();
        }
      }

      if (job.status === 'completed') {
        status['completedAt'] = job.completedAt;
        status['result'] = {
          summary: job.result.summary,
          performance: job.result.performance
        };
      } else if (job.status === 'failed') {
        status['error'] = job.error;
        status['completedAt'] = job.completedAt;
      }

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

      logger.info('Backtest status requested', {
        requestId: (req as any).requestId,
        jobId,
        status: job.status,
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error getting backtest status', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        jobId: req.params.jobId,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/backtest/result/:jobId
   * Get complete backtest results
   */
  router.get('/result/:jobId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const { includeTransactions = false } = req.query;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Backtest job not found'
        });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: `Backtest is ${job.status}. Results are only available for completed backtests.`
        });
      }

      const result = {
        jobId,
        config: {
          strategyId: job.strategyId,
          symbol: job.symbol,
          timeframe: job.timeframe,
          startDate: job.startDate,
          endDate: job.endDate,
          initialBalance: job.initialBalance,
          parameters: job.parameters
        },
        execution: {
          startTime: job.startTime,
          completedAt: job.completedAt,
          duration: job.completedAt ? job.completedAt.getTime() - job.startTime.getTime() : 0
        },
        results: job.result,
        ...(includeTransactions === 'true' && { transactions: job.result.transactions })
      };

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

      logger.info('Backtest results requested', {
        requestId: (req as any).requestId,
        jobId,
        includeTransactions: includeTransactions === 'true',
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error getting backtest results', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        jobId: req.params.jobId,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/backtest/jobs
   * Get all backtest jobs
   */
  router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, limit = 50 } = req.query;

      let jobs = Array.from(activeJobs.values());

      // Filter by status if provided
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }

      // Limit results
      jobs = jobs.slice(0, Number(limit));

      const jobsList = jobs.map(job => ({
        jobId: job.jobId,
        strategyId: job.strategyId,
        symbol: job.symbol,
        timeframe: job.timeframe,
        status: job.status,
        startTime: job.startTime,
        completedAt: job.completedAt,
        duration: job.completedAt ? job.completedAt.getTime() - job.startTime.getTime() : null,
        performance: job.result ? {
          totalReturn: job.result.summary.totalReturn,
          winRate: job.result.summary.winRate,
          maxDrawdown: job.result.summary.maxDrawdown,
          sharpeRatio: job.result.performance.sharpeRatio
        } : null
      }));

      res.json({
        success: true,
        data: jobsList,
        count: jobsList.length,
        filters: { status, limit: Number(limit) },
        timestamp: new Date().toISOString()
      });

      logger.info('Backtest jobs list requested', {
        requestId: (req as any).requestId,
        status,
        jobsCount: jobsList.length,
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error getting backtest jobs', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  /**
   * DELETE /api/backtest/job/:jobId
   * Cancel or delete a backtest job
   */
  router.delete('/job/:jobId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Job ID is required'
        });
      }

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Backtest job not found'
        });
      }

      const wasRunning = job.status === 'running';
      activeJobs.delete(jobId);

      res.json({
        success: true,
        message: wasRunning ? 'Backtest job cancelled successfully' : 'Backtest job deleted successfully',
        data: { jobId, wasRunning },
        timestamp: new Date().toISOString()
      });

      logger.info('Backtest job deleted', {
        requestId: (req as any).requestId,
        jobId,
        wasRunning,
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error deleting backtest job', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        jobId: req.params.jobId,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  /**
   * POST /api/backtest/compare
   * Compare multiple backtest results
   */
  router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobIds } = req.body;

      if (!jobIds || !Array.isArray(jobIds) || jobIds.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 job IDs are required for comparison'
        });
      }

      const comparisons = [];
      const validJobs = [];

      for (const jobId of jobIds) {
        const job = activeJobs.get(jobId);
        if (job && job.status === 'completed') {
          validJobs.push(job);
        }
      }

      if (validJobs.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 completed backtests are required for comparison'
        });
      }

      // Generate comparison data
      const comparison = {
        jobs: validJobs.map(job => ({
          jobId: job.jobId,
          strategyId: job.strategyId,
          symbol: job.symbol,
          timeframe: job.timeframe,
          performance: {
            totalReturn: job.result.summary.totalReturn,
            winRate: job.result.summary.winRate,
            maxDrawdown: job.result.summary.maxDrawdown,
            sharpeRatio: job.result.performance.sharpeRatio,
            sortinoRatio: job.result.performance.sortinoRatio,
            totalTrades: job.result.summary.totalTrades,
            profitFactor: job.result.summary.profitFactor
          }
        })),
        ranking: {
          byReturn: validJobs.sort((a, b) => b.result.summary.totalReturn - a.result.summary.totalReturn).map(j => j.jobId),
          bySharpe: validJobs.sort((a, b) => b.result.performance.sharpeRatio - a.result.performance.sharpeRatio).map(j => j.jobId),
          byDrawdown: validJobs.sort((a, b) => a.result.summary.maxDrawdown - b.result.summary.maxDrawdown).map(j => j.jobId)
        },
        bestOverall: validJobs.reduce((best, current) => {
          const bestScore = calculateOverallScore(best.result);
          const currentScore = calculateOverallScore(current.result);
          return currentScore > bestScore ? current : best;
        }).jobId
      };

      res.json({
        success: true,
        data: comparison,
        timestamp: new Date().toISOString()
      });

      logger.info('Backtest comparison generated', {
        requestId: (req as any).requestId,
        jobIds,
        validJobsCount: validJobs.length,
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error comparing backtests', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  /**
   * GET /api/backtest/historical-data/:symbol
   * Download historical data for backtesting
   */
  router.get('/historical-data/:symbol', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { symbol } = req.params;
      const { 
        timeframe = '1h', 
        startDate, 
        endDate, 
        limit = 1000 
      } = req.query;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      const symbolParam = symbol as string;
      const intervalParam = timeframe as string;
      const limitParam = Math.min(Number(limit), 1000);
      const startTime = startDate ? new Date(startDate as string).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
      const endTime = endDate ? new Date(endDate as string).getTime() : Date.now();

      const historicalData = await binanceService.getHistoricalKlines(
        symbolParam, 
        intervalParam, 
        startTime, 
        endTime, 
        limitParam
      );

      const formattedData = historicalData.map((candle: any) => ({
        timestamp: new Date(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          startDate: formattedData[0]?.timestamp,
          endDate: formattedData[formattedData.length - 1]?.timestamp,
          candlesCount: formattedData.length,
          candles: formattedData
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Historical data requested', {
        requestId: (req as any).requestId,
        symbol,
        timeframe,
        candlesCount: formattedData.length,
        service: 'BacktestAPI'
      });

    } catch (error) {
      logger.error('Error getting historical data', {
        error: error instanceof Error ? error.message : String(error),
        requestId: (req as any).requestId,
        symbol: req.params.symbol,
        service: 'BacktestAPI'
      });
      next(error);
    }
  });

  return router;

  // Helper function to run backtest
  async function runBacktest(config: any): Promise<any> {
    try {
      // Get historical data
      const historicalData = await binanceService.getHistoricalKlines(
        config.symbol,
        config.timeframe,
        config.startDate.getTime(),
        config.endDate.getTime(),
        1000
      );

      // Create backtest engine with config
      const backtestEngine = new BacktestEngine(config);

      // Create strategy instance
      const strategy = await strategyFactory.create(config.strategyId, config.parameters);
      if (config.riskManagement) {
        strategy.riskManagement = { ...strategy.riskManagement, ...config.riskManagement };
      }

      // Run backtest
      const results = await backtestEngine.run(
        strategy,
        historicalData
      );

      // Analyze performance
      const performance = await performanceAnalyzer.analyze(results);

      return {
        summary: {
          totalReturn: performance.totalReturn,
          winRate: performance.winRate,
          totalTrades: performance.totalTrades,
          maxDrawdown: performance.maxDrawdown,
          profitFactor: performance.profitFactor
        },
        performance,
        equity: results.equityCurve || [],
        drawdown: results.drawdownCurve || [],
        transactions: results.trades || []
      };

    } catch (error) {
      logger.error('Backtest execution failed', {
        error: error instanceof Error ? error.message : String(error),
        jobId: config.jobId,
        service: 'BacktestAPI'
      });
      throw error;
    }
  }

  // Helper function to calculate overall score
  function calculateOverallScore(result: any): number {
    const { totalReturn, winRate, maxDrawdown } = result.summary;
    const { sharpeRatio } = result.performance;
    
    // Simple scoring formula (can be improved)
    return (totalReturn * 0.3) + (winRate * 0.2) + (sharpeRatio * 0.3) - (maxDrawdown * 0.2);
  }
}