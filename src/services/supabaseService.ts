import { supabase, DbUser, DbPerformance } from '@/lib/supabase';
import { Portfolio, Trade, TradingStrategy } from '@/types';

/**
 * Supabase Service
 * 
 * Handles all database operations for the trading system.
 * Provides methods for portfolio management, trade history, and performance tracking.
 */

export class SupabaseService {
  // User Management
  async getCurrentUser(): Promise<DbUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null;
    }
  }

  async createUserProfile(email: string, username?: string): Promise<DbUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email,
          username,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createUserProfile:', error);
      return null;
    }
  }

  // Portfolio Management
  async getPortfolio(userId?: string): Promise<Portfolio | null> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return null;

      const { data: portfolio, error } = await supabase
        .from('portfolios')
        .select(`
          *,
          positions (*)
        `)
        .eq('user_id', currentUser)
        .single();

      if (error) {
        console.error('Error fetching portfolio:', error);
        return null;
      }

      // Transform database data to frontend format
      return {
        totalValue: Number(portfolio.total_value),
        totalPnL: Number(portfolio.total_pnl),
        totalPnLPercentage: Number(portfolio.total_pnl_percentage),
        availableBalance: Number(portfolio.available_balance),
        dailyPnL: Number(portfolio.daily_pnl),
        totalTrades: portfolio.total_trades,
        winRate: Number(portfolio.win_rate),
        maxDrawdown: Number(portfolio.max_drawdown),
        sharpeRatio: Number(portfolio.sharpe_ratio),
        positions: portfolio.positions?.map((pos: { symbol: string; quantity: number; average_price: number; current_price: number; pnl: number; unrealized_pnl: number; pnl_percentage: number; value: number; side: 'LONG' | 'SHORT'; }) => ({
          symbol: pos.symbol,
          quantity: Number(pos.quantity),
          averagePrice: Number(pos.average_price),
          avgPrice: Number(pos.average_price),
          currentPrice: Number(pos.current_price),
          pnl: Number(pos.pnl),
          unrealizedPnL: Number(pos.unrealized_pnl),
          pnlPercentage: Number(pos.pnl_percentage),
          value: Number(pos.value),
          side: pos.side as 'LONG' | 'SHORT',
        })) || [],
        assets: [], // Will be populated separately if needed
      };
    } catch (error) {
      console.error('Error in getPortfolio:', error);
      return null;
    }
  }

  async updatePortfolio(portfolio: Partial<Portfolio>, userId?: string): Promise<boolean> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return false;

      const updateData: Record<string, number> = {};
      if (portfolio.totalValue !== undefined) updateData.total_value = portfolio.totalValue;
      if (portfolio.totalPnL !== undefined) updateData.total_pnl = portfolio.totalPnL;
      if (portfolio.totalPnLPercentage !== undefined) updateData.total_pnl_percentage = portfolio.totalPnLPercentage;
      if (portfolio.availableBalance !== undefined) updateData.available_balance = portfolio.availableBalance;
      if (portfolio.dailyPnL !== undefined) updateData.daily_pnl = portfolio.dailyPnL;
      if (portfolio.totalTrades !== undefined) updateData.total_trades = portfolio.totalTrades;
      if (portfolio.winRate !== undefined) updateData.win_rate = portfolio.winRate;
      if (portfolio.maxDrawdown !== undefined) updateData.max_drawdown = portfolio.maxDrawdown;
      if (portfolio.sharpeRatio !== undefined) updateData.sharpe_ratio = portfolio.sharpeRatio;

      const { error } = await supabase
        .from('portfolios')
        .upsert({
          user_id: currentUser,
          ...updateData,
        });

      if (error) {
        console.error('Error updating portfolio:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updatePortfolio:', error);
      return false;
    }
  }

  // Trade Management
  async saveTrade(trade: Trade, userId?: string): Promise<string | null> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return null;

      const { data, error } = await supabase
        .from('trades')
        .insert({
          user_id: currentUser,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          pnl: trade.pnl,
          strategy: trade.strategy,
          status: trade.status,
          entry_time: trade.entryTime.toISOString(),
          exit_time: trade.exitTime?.toISOString(),
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          commission: trade.commission,
          notes: trade.notes,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error saving trade:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in saveTrade:', error);
      return null;
    }
  }

  async getTradeHistory(limit: number = 50, userId?: string): Promise<Trade[]> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', currentUser)
        .order('entry_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching trade history:', error);
        return [];
      }

      return data.map((trade: { id: string; symbol: string; side: 'BUY' | 'SELL'; entry_price: number; exit_price?: number; quantity: number; pnl?: number; strategy: string; status: 'OPEN' | 'CLOSED' | 'PARTIAL'; entry_time: string; exit_time?: string; stop_loss?: number; take_profit?: number; commission?: number; notes?: string; }) => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side as 'BUY' | 'SELL',
        entryPrice: Number(trade.entry_price),
        exitPrice: trade.exit_price ? Number(trade.exit_price) : undefined,
        quantity: Number(trade.quantity),
        pnl: trade.pnl ? Number(trade.pnl) : undefined,
        strategy: trade.strategy,
        status: trade.status as 'OPEN' | 'CLOSED' | 'PARTIAL',
        entryTime: new Date(trade.entry_time),
        exitTime: trade.exit_time ? new Date(trade.exit_time) : undefined,
        stopLoss: trade.stop_loss ? Number(trade.stop_loss) : undefined,
        takeProfit: trade.take_profit ? Number(trade.take_profit) : undefined,
        commission: trade.commission ? Number(trade.commission) : undefined,
        notes: trade.notes,
      }));
    } catch (error) {
      console.error('Error in getTradeHistory:', error);
      return [];
    }
  }

  // Strategy Management
  async saveStrategy(strategy: TradingStrategy, userId?: string): Promise<string | null> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return null;

      const { data, error } = await supabase
        .from('strategies')
        .insert({
          user_id: currentUser,
          name: strategy.name,
          description: strategy.description,
          is_active: strategy.isActive,
          total_trades: strategy.performance.totalTrades,
          winning_trades: strategy.performance.winningTrades,
          losing_trades: strategy.performance.losingTrades,
          win_rate: strategy.performance.winRate,
          total_return: strategy.performance.totalReturn,
          total_pnl: strategy.performance.totalPnL,
          max_drawdown: strategy.performance.maxDrawdown,
          sharpe_ratio: strategy.performance.sharpeRatio,
          profit_factor: strategy.performance.profitFactor,
          avg_trade_duration: strategy.performance.avgTradeDuration,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error saving strategy:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in saveStrategy:', error);
      return null;
    }
  }

  async getActiveStrategies(userId?: string): Promise<TradingStrategy[]> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', currentUser)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching active strategies:', error);
        return [];
      }

      return data.map((strategy: { id: string; name: string; description: string; is_active: boolean; total_trades: number; winning_trades: number; losing_trades: number; win_rate: number; total_return: number; total_pnl: number; max_drawdown: number; sharpe_ratio: number; profit_factor: number; avg_trade_duration: number; created_at: string; updated_at: string; }) => ({
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        indicators: [], // Will be populated from separate table if needed
        rules: [], // Will be populated from separate table if needed
        riskManagement: {
          maxPositionSize: 1000,
          maxDrawdown: 10,
          stopLossPercentage: 2,
          takeProfitPercentage: 4,
          riskPerTrade: 1,
        },
        isActive: strategy.is_active,
        performance: {
          totalTrades: strategy.total_trades,
          winningTrades: strategy.winning_trades,
          losingTrades: strategy.losing_trades,
          winRate: Number(strategy.win_rate),
          totalReturn: Number(strategy.total_return),
          totalReturnPercentage: 0, // Calculate if needed
          totalPnL: Number(strategy.total_pnl),
          maxDrawdown: Number(strategy.max_drawdown),
          maxDrawdownPercentage: 0, // Calculate if needed
          sharpeRatio: Number(strategy.sharpe_ratio),
          profitFactor: Number(strategy.profit_factor),
          avgTradeDuration: strategy.avg_trade_duration,
          startDate: new Date(strategy.created_at),
          endDate: new Date(strategy.updated_at),
        },
        createdAt: new Date(strategy.created_at),
        updatedAt: new Date(strategy.updated_at),
      }));
    } catch (error) {
      console.error('Error in getActiveStrategies:', error);
      return [];
    }
  }

  // Performance Tracking
  async savePerformanceSnapshot(userId?: string): Promise<boolean> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return false;

      const portfolio = await this.getPortfolio(currentUser);
      if (!portfolio) return false;

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('performance_history')
        .upsert({
          user_id: currentUser,
          date: today,
          total_value: portfolio.totalValue,
          pnl_daily: portfolio.dailyPnL || 0,
          pnl_total: portfolio.totalPnL,
          trades_count: portfolio.totalTrades || 0,
          win_rate: portfolio.winRate || 0,
        });

      if (error) {
        console.error('Error saving performance snapshot:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in savePerformanceSnapshot:', error);
      return false;
    }
  }

  async getPerformanceHistory(days: number = 30, userId?: string): Promise<DbPerformance[]> {
    try {
      const currentUser = userId || (await this.getCurrentUser())?.id;
      if (!currentUser) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('performance_history')
        .select('*')
        .eq('user_id', currentUser)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching performance history:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error in getPerformanceHistory:', error);
      return [];
    }
  }
}

export const supabaseService = new SupabaseService();