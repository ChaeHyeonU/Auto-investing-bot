import { Client } from '@notionhq/client';
import config from '../config/config';
import logger from '../utils/logger';
import { AIService } from './ai/aiService';
import { Trade, TradingJournalEntry, NotionPage } from '../../src/types';

/**
 * Notion API Service
 * 
 * Provides automated trading journal functionality:
 * - Creates trading journal entries in Notion
 * - AI-powered trade analysis and reasoning
 * - Rich formatting with performance metrics
 * - Automated documentation of trading decisions
 */
export class NotionService {
  private notion: Client;
  private aiService: AIService;
  private databaseId: string;

  constructor() {
    this.notion = new Client({
      auth: config.notion.apiKey,
    });
    this.aiService = new AIService();
    this.databaseId = config.notion.databaseId;
    
    logger.info('Notion Service initialized', {
      hasApiKey: !!config.notion.apiKey,
      hasDatabaseId: !!config.notion.databaseId,
      service: 'NotionService'
    });
  }

  /**
   * Initialize trading journal database in Notion
   */
  async initializeTradingJournal(): Promise<void> {
    try {
      if (!this.databaseId) {
        throw new Error('Notion database ID not configured');
      }

      // Verify database access
      await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      logger.info('Trading journal database verified', {
        databaseId: this.databaseId,
        service: 'NotionService'
      });

    } catch (error) {
      logger.error('Failed to initialize trading journal', {
        error: error instanceof Error ? error.message : 'Unknown error',
        databaseId: this.databaseId,
        service: 'NotionService'
      });
      throw error;
    }
  }

  /**
   * Create a new trading journal entry
   */
  async createJournalEntry(trade: Trade): Promise<NotionPage> {
    try {
      // Generate AI analysis of the trade
      const aiAnalysis = await this.generateTradeAnalysis(trade);

      // Create the page in Notion
      const response = await this.notion.pages.create({
        parent: {
          database_id: this.databaseId,
        },
        properties: {
          'Trade ID': {
            title: [
              {
                text: {
                  content: trade.id,
                },
              },
            ],
          },
          'Symbol': {
            rich_text: [
              {
                text: {
                  content: trade.symbol,
                },
              },
            ],
          },
          'Side': {
            select: {
              name: trade.side,
            },
          },
          'Entry Price': {
            number: trade.entryPrice,
          },
          'Exit Price': {
            number: trade.exitPrice || 0,
          },
          'Quantity': {
            number: trade.quantity,
          },
          'PnL': {
            number: trade.pnl || 0,
          },
          'Strategy': {
            rich_text: [
              {
                text: {
                  content: trade.strategy || 'Unknown',
                },
              },
            ],
          },
          'Status': {
            select: {
              name: trade.status,
            },
          },
          'Entry Time': {
            date: {
              start: trade.entryTime.toISOString(),
            },
          },
          ...(trade.exitTime ? {
            'Exit Time': {
              date: {
                start: trade.exitTime.toISOString(),
              },
            }
          } : {}),
          'AI Score': {
            number: aiAnalysis.score,
          },
          'Risk Level': {
            select: {
              name: aiAnalysis.riskAssessment,
            },
          },
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [
                {
                  text: {
                    content: `Trading Journal Entry - ${trade.symbol} ${trade.side}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'divider',
            divider: {},
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  text: {
                    content: '📊 Trade Summary',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Symbol: ${trade.symbol}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Side: ${trade.side}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Entry Price: $${trade.entryPrice.toFixed(4)}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Quantity: ${trade.quantity}`,
                  },
                },
              ],
            },
          },
          ...(trade.exitPrice ? [{
            object: 'block' as const,
            type: 'bulleted_list_item' as const,
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Exit Price: $${trade.exitPrice.toFixed(4)}`,
                  },
                },
              ],
            },
          }] : []),
          ...(trade.pnl !== undefined ? [{
            object: 'block' as const,
            type: 'bulleted_list_item' as const,
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `P&L: ${trade.pnl > 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${((trade.pnl / (trade.entryPrice * trade.quantity)) * 100).toFixed(2)}%)`,
                  },
                },
              ],
            },
          }] : []),
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  text: {
                    content: '🤖 AI Analysis',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: aiAnalysis.analysis,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [
                {
                  text: {
                    content: 'Trade Reasoning',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: aiAnalysis.reasoning,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [
                {
                  text: {
                    content: 'Lessons Learned',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: aiAnalysis.lessonsLearned,
                  },
                },
              ],
            },
          },
          ...(aiAnalysis.recommendations.length > 0 ? [
            {
              object: 'block' as const,
              type: 'heading_3' as const,
              heading_3: {
                rich_text: [
                  {
                    text: {
                      content: 'Recommendations',
                    },
                  },
                ],
              },
            },
            ...aiAnalysis.recommendations.map(rec => ({
              object: 'block' as const,
              type: 'bulleted_list_item' as const,
              bulleted_list_item: {
                rich_text: [
                  {
                    text: {
                      content: rec,
                    },
                  },
                ],
              },
            }))
          ] : []),
          {
            object: 'block',
            type: 'divider',
            divider: {},
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: `Generated automatically by Auto Trading System on ${new Date().toISOString()}`,
                  },
                  annotations: {
                    italic: true,
                  },
                },
              ],
            },
          },
        ],
      });

      logger.info('Trading journal entry created', {
        tradeId: trade.id,
        notionPageId: response.id,
        symbol: trade.symbol,
        side: trade.side,
        pnl: trade.pnl,
        aiScore: aiAnalysis.score,
        service: 'NotionService'
      });

      return response as unknown as NotionPage;

    } catch (error) {
      logger.error('Failed to create journal entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        service: 'NotionService'
      });
      throw error;
    }
  }

  /**
   * Generate AI-powered analysis of a trade
   */
  private async generateTradeAnalysis(trade: Trade): Promise<{
    analysis: string;
    reasoning: string;
    lessonsLearned: string;
    recommendations: string[];
    score: number;
    riskAssessment: string;
  }> {
    try {
      const prompt = `
Analyze this trading trade and provide detailed insights:

Trade Details:
- Symbol: ${trade.symbol}
- Side: ${trade.side}
- Entry Price: $${trade.entryPrice}
- Exit Price: $${trade.exitPrice || 'Still Open'}
- Quantity: ${trade.quantity}
- P&L: ${trade.pnl ? `$${trade.pnl.toFixed(2)}` : 'Unrealized'}
- Strategy: ${trade.strategy || 'Unknown'}
- Status: ${trade.status}
- Entry Time: ${trade.entryTime.toISOString()}
- Exit Time: ${trade.exitTime ? trade.exitTime.toISOString() : 'Still Open'}
- Stop Loss: ${trade.stopLoss || 'None'}
- Take Profit: ${trade.takeProfit || 'None'}

Please provide:
1. A comprehensive analysis of this trade (2-3 sentences)
2. The reasoning behind why this trade was likely taken (2-3 sentences)
3. Key lessons learned from this trade (2-3 sentences)
4. 2-3 specific recommendations for future trades
5. A numerical score from 1-100 for trade quality
6. Risk assessment (LOW, MEDIUM, HIGH)

Format your response as JSON:
{
  "analysis": "...",
  "reasoning": "...",
  "lessonsLearned": "...",
  "recommendations": ["...", "...", "..."],
  "score": 85,
  "riskAssessment": "MEDIUM"
}
`;

      // Simple implementation without calling actual AI service for now
      // In production, this would call the actual AI service
      const mockResponse = JSON.stringify({
        analysis: `${trade.side} trade on ${trade.symbol} executed at $${trade.entryPrice}. ${trade.pnl ? (trade.pnl > 0 ? 'Profitable trade with good risk management.' : 'Loss trade that followed risk management rules.') : 'Position currently being monitored.'}`,
        reasoning: `Trade was executed based on ${trade.strategy || 'algorithmic'} strategy signals with appropriate risk management parameters.`,
        lessonsLearned: `Trade demonstrates the importance of ${trade.stopLoss ? 'having stop losses' : 'implementing risk management'} and following systematic approach to trading.`,
        recommendations: ['Monitor position sizing relative to portfolio', 'Review strategy performance regularly', 'Maintain disciplined risk management'],
        score: trade.pnl ? (trade.pnl > 0 ? 75 : 45) : 60,
        riskAssessment: trade.pnl && Math.abs(trade.pnl) > 100 ? 'HIGH' : 'MEDIUM'
      });

      const analysis = JSON.parse(mockResponse);

      return {
        analysis: analysis.analysis || 'Analysis not available',
        reasoning: analysis.reasoning || 'Reasoning not available',
        lessonsLearned: analysis.lessonsLearned || 'No lessons identified',
        recommendations: analysis.recommendations || [],
        score: analysis.score || 50,
        riskAssessment: analysis.riskAssessment || 'MEDIUM'
      };

    } catch (error) {
      logger.error('Failed to generate AI analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tradeId: trade.id,
        service: 'NotionService'
      });

      // Return fallback analysis
      return {
        analysis: `${trade.side} trade on ${trade.symbol} ${trade.pnl && trade.pnl > 0 ? 'generated profit' : trade.pnl && trade.pnl < 0 ? 'resulted in loss' : 'is still active'}.`,
        reasoning: `Trade was executed based on ${trade.strategy || 'algorithmic'} strategy signals.`,
        lessonsLearned: 'Trade execution completed according to system parameters.',
        recommendations: ['Monitor position sizing', 'Review risk management', 'Analyze market conditions'],
        score: 50,
        riskAssessment: 'MEDIUM'
      };
    }
  }

  /**
   * Update an existing journal entry
   */
  async updateJournalEntry(pageId: string, trade: Trade): Promise<void> {
    try {
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          'Exit Price': {
            type: 'number',
            number: trade.exitPrice || 0,
          },
          'PnL': {
            type: 'number',
            number: trade.pnl || 0,
          },
          'Status': {
            type: 'select',
            select: {
              name: trade.status,
            },
          },
          ...(trade.exitTime ? {
            'Exit Time': {
              type: 'date',
              date: {
                start: trade.exitTime.toISOString(),
              },
            }
          } : {}),
        },
      });

      logger.info('Journal entry updated', {
        pageId,
        tradeId: trade.id,
        newStatus: trade.status,
        pnl: trade.pnl,
        service: 'NotionService'
      });

    } catch (error) {
      logger.error('Failed to update journal entry', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pageId,
        tradeId: trade.id,
        service: 'NotionService'
      });
      throw error;
    }
  }

  /**
   * Create daily trading summary
   */
  async createDailySummary(summary: {
    date: Date;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    bestTrade: Trade | null;
    worstTrade: Trade | null;
    strategiesUsed: string[];
  }): Promise<NotionPage> {
    try {
      // Generate AI insights for the day
      const aiInsights = await this.generateDailyInsights(summary);

      const response = await this.notion.pages.create({
        parent: {
          database_id: this.databaseId,
        },
        properties: {
          'Trade ID': {
            title: [
              {
                text: {
                  content: `Daily Summary - ${summary.date.toISOString().split('T')[0]}`,
                },
              },
            ],
          },
          'Symbol': {
            rich_text: [
              {
                text: {
                  content: 'DAILY_SUMMARY',
                },
              },
            ],
          },
          'Side': {
            select: {
              name: 'SUMMARY',
            },
          },
          'PnL': {
            number: summary.totalPnL,
          },
          'Entry Time': {
            date: {
              start: summary.date.toISOString(),
            },
          },
          'AI Score': {
            number: aiInsights.score,
          },
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [
                {
                  text: {
                    content: `📈 Daily Trading Summary - ${summary.date.toISOString().split('T')[0]}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'divider',
            divider: {},
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  text: {
                    content: '📊 Performance Metrics',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Total Trades: ${summary.totalTrades}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Winning Trades: ${summary.winningTrades}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Losing Trades: ${summary.losingTrades}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Win Rate: ${summary.winRate.toFixed(1)}%`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                {
                  text: {
                    content: `Total P&L: ${summary.totalPnL > 0 ? '+' : ''}$${summary.totalPnL.toFixed(2)}`,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  text: {
                    content: '🤖 AI Daily Insights',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: aiInsights.summary,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [
                {
                  text: {
                    content: 'Key Observations',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: aiInsights.observations,
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [
                {
                  text: {
                    content: 'Tomorrow\'s Focus',
                  },
                },
              ],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: aiInsights.tomorrowFocus,
                  },
                },
              ],
            },
          },
        ],
      });

      logger.info('Daily summary created', {
        date: summary.date.toISOString().split('T')[0],
        totalTrades: summary.totalTrades,
        totalPnL: summary.totalPnL,
        winRate: summary.winRate,
        pageId: response.id,
        service: 'NotionService'
      });

      return response as unknown as NotionPage;

    } catch (error) {
      logger.error('Failed to create daily summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        date: summary.date.toISOString().split('T')[0],
        service: 'NotionService'
      });
      throw error;
    }
  }

  /**
   * Generate AI insights for daily summary
   */
  private async generateDailyInsights(summary: any): Promise<{
    summary: string;
    observations: string;
    tomorrowFocus: string;
    score: number;
  }> {
    try {
      // Mock implementation for now
      const mockResponse = JSON.stringify({
        summary: `Completed ${summary.totalTrades} trades with ${summary.winRate.toFixed(1)}% win rate, generating ${summary.totalPnL > 0 ? 'positive' : 'negative'} P&L of $${summary.totalPnL.toFixed(2)}.`,
        observations: `${summary.totalTrades > 10 ? 'High trading activity observed' : 'Moderate trading activity'} with ${summary.winRate > 60 ? 'strong' : summary.winRate > 40 ? 'acceptable' : 'concerning'} win rate performance.`,
        tomorrowFocus: `${summary.totalPnL < 0 ? 'Review risk management and strategy effectiveness' : 'Continue current approach while monitoring market conditions'}. ${summary.strategiesUsed.length > 1 ? 'Evaluate strategy performance individually' : 'Consider diversifying strategies'}.`,
        score: Math.min(100, Math.max(0, 50 + (summary.winRate - 50) + (summary.totalPnL > 0 ? 20 : -20)))
      });

      const insights = JSON.parse(mockResponse);

      return {
        summary: insights.summary || 'Daily trading completed.',
        observations: insights.observations || 'No significant patterns observed.',
        tomorrowFocus: insights.tomorrowFocus || 'Continue current strategy.',
        score: insights.score || 50
      };

    } catch (error) {
      logger.error('Failed to generate daily insights', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'NotionService'
      });

      return {
        summary: `Executed ${summary.totalTrades} trades with ${summary.winRate.toFixed(1)}% win rate.`,
        observations: 'Trading system operated within normal parameters.',
        tomorrowFocus: 'Continue monitoring market conditions and strategy performance.',
        score: 50
      };
    }
  }

  /**
   * Test Notion connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.databaseId) {
        throw new Error('Notion database ID not configured');
      }

      await this.notion.databases.retrieve({
        database_id: this.databaseId,
      });

      logger.info('Notion connection test successful', {
        service: 'NotionService'
      });

      return true;

    } catch (error) {
      logger.error('Notion connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'NotionService'
      });

      return false;
    }
  }
}