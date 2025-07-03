import { NotionService } from './notionService';
import { TradingEngine, PerformanceMonitor } from './trading/index';
import { Trade } from '@/types';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Journal Integration Service
 * 
 * Automatically creates Notion journal entries for:
 * - Completed trades
 * - Daily summaries
 * - Performance milestones
 * - Risk events
 * 
 * This service acts as a bridge between the trading system
 * and the Notion journal for automated documentation.
 */
export class JournalIntegration extends EventEmitter {
  private notionService: NotionService;
  private tradingEngine: TradingEngine;
  private performanceMonitor: PerformanceMonitor;
  private isActive: boolean = false;
  private processedTrades: Set<string> = new Set();
  private lastDailySummaryDate: string | null = null;

  constructor(tradingEngine: TradingEngine, performanceMonitor: PerformanceMonitor) {
    super();
    this.notionService = new NotionService();
    this.tradingEngine = tradingEngine;
    this.performanceMonitor = performanceMonitor;
    
    logger.info('Journal Integration Service initialized', {
      service: 'JournalIntegration'
    });
  }

  /**
   * Start automatic journal integration
   */
  async start(): Promise<void> {
    try {
      // Test Notion connection first
      const isConnected = await this.notionService.testConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Notion API');
      }

      // Initialize trading journal if needed
      await this.notionService.initializeTradingJournal();

      // Setup event listeners
      this.setupEventListeners();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isActive = true;

      logger.info('Journal Integration Service started', {
        service: 'JournalIntegration'
      });

      this.emit('started');

    } catch (error) {
      logger.error('Failed to start Journal Integration Service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'JournalIntegration'
      });
      throw error;
    }
  }

  /**
   * Stop automatic journal integration
   */
  async stop(): Promise<void> {
    this.isActive = false;
    this.removeEventListeners();

    logger.info('Journal Integration Service stopped', {
      service: 'JournalIntegration'
    });

    this.emit('stopped');
  }

  /**
   * Setup event listeners for trading system
   */
  private setupEventListeners(): void {
    // Listen for completed trades
    this.tradingEngine.on('tradeCompleted', async (tradeData) => {
      await this.handleTradeCompleted(tradeData);
    });

    // Listen for position closures
    this.tradingEngine.on('positionClosed', async (positionData) => {
      await this.handlePositionClosed(positionData);
    });

    // Listen for significant events
    this.tradingEngine.on('emergencyStop', async (eventData) => {
      await this.handleEmergencyEvent(eventData);
    });

    this.performanceMonitor.on('milestoneReached', async (milestoneData) => {
      await this.handlePerformanceMilestone(milestoneData);
    });

    logger.info('Event listeners setup for journal integration', {
      service: 'JournalIntegration'
    });
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    this.tradingEngine.removeAllListeners('tradeCompleted');
    this.tradingEngine.removeAllListeners('positionClosed');
    this.tradingEngine.removeAllListeners('emergencyStop');
    this.performanceMonitor.removeAllListeners('milestoneReached');
  }

  /**
   * Handle completed trade
   */
  private async handleTradeCompleted(tradeData: any): Promise<void> {
    try {
      // Avoid duplicate processing
      if (this.processedTrades.has(tradeData.id)) {
        return;
      }

      // Convert to Trade format
      const trade: Trade = {
        id: tradeData.id,
        symbol: tradeData.symbol,
        side: tradeData.side,
        entryPrice: tradeData.entryPrice,
        exitPrice: tradeData.exitPrice,
        quantity: tradeData.quantity,
        pnl: tradeData.pnl,
        strategy: tradeData.strategy,
        status: 'CLOSED',
        entryTime: new Date(tradeData.entryTime),
        exitTime: new Date(tradeData.exitTime),
        stopLoss: tradeData.stopLoss,
        takeProfit: tradeData.takeProfit,
        commission: tradeData.commission,
        notes: `Automatically logged by trading system`
      };

      await this.notionService.createJournalEntry(trade);
      this.processedTrades.add(tradeData.id);

      logger.info('Trade automatically logged to Notion', {
        tradeId: trade.id,
        symbol: trade.symbol,
        pnl: trade.pnl,
        service: 'JournalIntegration'
      });

      this.emit('tradeLogged', trade);

    } catch (error) {
      logger.error('Failed to log trade to Notion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: tradeData.id,
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Handle position closure
   */
  private async handlePositionClosed(positionData: any): Promise<void> {
    try {
      // This might be redundant with tradeCompleted, but provides backup
      logger.info('Position closed, checking for journal entry', {
        positionId: positionData.id,
        symbol: positionData.symbol,
        service: 'JournalIntegration'
      });
    } catch (error) {
      logger.error('Failed to handle position closure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        positionId: positionData.id,
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Handle emergency events
   */
  private async handleEmergencyEvent(eventData: any): Promise<void> {
    try {
      // Create special emergency event entry
      const emergencyTrade: Trade = {
        id: `emergency-${Date.now()}`,
        symbol: 'SYSTEM_EVENT',
        side: 'BUY', // Placeholder
        entryPrice: 0,
        quantity: 0,
        strategy: 'Emergency Stop',
        status: 'CLOSED',
        entryTime: new Date(),
        notes: `Emergency event: ${eventData.reason || 'System emergency stop activated'}`
      };

      await this.notionService.createJournalEntry(emergencyTrade);

      logger.info('Emergency event logged to Notion', {
        eventReason: eventData.reason,
        service: 'JournalIntegration'
      });

    } catch (error) {
      logger.error('Failed to log emergency event to Notion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Handle performance milestones
   */
  private async handlePerformanceMilestone(milestoneData: any): Promise<void> {
    try {
      // Create milestone entry
      const milestoneTrade: Trade = {
        id: `milestone-${Date.now()}`,
        symbol: 'MILESTONE',
        side: 'BUY', // Placeholder
        entryPrice: 0,
        quantity: 0,
        strategy: 'Performance Milestone',
        status: 'CLOSED',
        entryTime: new Date(),
        notes: `Milestone achieved: ${milestoneData.description} - ${milestoneData.value}`
      };

      await this.notionService.createJournalEntry(milestoneTrade);

      logger.info('Performance milestone logged to Notion', {
        milestone: milestoneData.description,
        value: milestoneData.value,
        service: 'JournalIntegration'
      });

    } catch (error) {
      logger.error('Failed to log milestone to Notion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Start periodic tasks (daily summaries, etc.)
   */
  private startPeriodicTasks(): void {
    // Check for daily summary every hour
    setInterval(async () => {
      if (this.isActive) {
        await this.checkForDailySummary();
      }
    }, 60 * 60 * 1000); // Every hour

    // Cleanup processed trades weekly
    setInterval(() => {
      if (this.isActive) {
        this.cleanupProcessedTrades();
      }
    }, 7 * 24 * 60 * 60 * 1000); // Every week
  }

  /**
   * Check if daily summary should be created
   */
  private async checkForDailySummary(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const hour = now.getHours();

      // Only create summary after 6 PM local time and if not already created today
      if (hour >= 18 && this.lastDailySummaryDate !== today) {
        await this.createDailySummary();
        this.lastDailySummaryDate = today;
      }
    } catch (error) {
      logger.error('Failed to check for daily summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Create daily summary
   */
  private async createDailySummary(): Promise<void> {
    try {
      const dailyMetrics = this.performanceMonitor.getDailyMetrics();
      const performanceReport = this.performanceMonitor.generatePerformanceReport();

      const summary = {
        date: new Date(),
        totalTrades: dailyMetrics.totalTrades,
        winningTrades: dailyMetrics.winningTrades,
        losingTrades: dailyMetrics.losingTrades,
        totalPnL: dailyMetrics.realizedPnL,
        winRate: dailyMetrics.totalTrades > 0 ? (dailyMetrics.winningTrades / dailyMetrics.totalTrades) * 100 : 0,
        bestTrade: null, // Would need to implement trade tracking
        worstTrade: null, // Would need to implement trade tracking
        strategiesUsed: performanceReport.strategies.map(s => s.strategyId)
      };

      await this.notionService.createDailySummary(summary);

      logger.info('Daily summary automatically created', {
        date: summary.date.toISOString().split('T')[0],
        totalTrades: summary.totalTrades,
        totalPnL: summary.totalPnL,
        service: 'JournalIntegration'
      });

      this.emit('dailySummaryCreated', summary);

    } catch (error) {
      logger.error('Failed to create daily summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Cleanup old processed trades from memory
   */
  private cleanupProcessedTrades(): void {
    const maxSize = 1000; // Keep last 1000 processed trades
    if (this.processedTrades.size > maxSize) {
      const trades = Array.from(this.processedTrades);
      const toRemove = trades.slice(0, trades.length - maxSize);
      toRemove.forEach(tradeId => this.processedTrades.delete(tradeId));

      logger.info('Cleaned up processed trades from memory', {
        removed: toRemove.length,
        remaining: this.processedTrades.size,
        service: 'JournalIntegration'
      });
    }
  }

  /**
   * Manually log a trade to Notion
   */
  async logTrade(trade: Trade): Promise<void> {
    try {
      await this.notionService.createJournalEntry(trade);
      this.processedTrades.add(trade.id);

      logger.info('Trade manually logged to Notion', {
        tradeId: trade.id,
        symbol: trade.symbol,
        service: 'JournalIntegration'
      });

      this.emit('tradeLogged', trade);

    } catch (error) {
      logger.error('Failed to manually log trade', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        service: 'JournalIntegration'
      });
      throw error;
    }
  }

  /**
   * Check if integration is active
   */
  isIntegrationActive(): boolean {
    return this.isActive;
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats(): {
    isActive: boolean;
    processedTrades: number;
    lastDailySummary: string | null;
  } {
    return {
      isActive: this.isActive,
      processedTrades: this.processedTrades.size,
      lastDailySummary: this.lastDailySummaryDate
    };
  }
}