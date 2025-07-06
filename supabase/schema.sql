-- Auto Trading System Database Schema
-- Created for Supabase PostgreSQL

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolios table
CREATE TABLE public.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  total_value DECIMAL(20,8) DEFAULT 0,
  total_pnl DECIMAL(20,8) DEFAULT 0,
  total_pnl_percentage DECIMAL(10,4) DEFAULT 0,
  available_balance DECIMAL(20,8) DEFAULT 0,
  daily_pnl DECIMAL(20,8) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  max_drawdown DECIMAL(10,4) DEFAULT 0,
  sharpe_ratio DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Positions table
CREATE TABLE public.positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity DECIMAL(20,8) NOT NULL,
  average_price DECIMAL(20,8) NOT NULL,
  current_price DECIMAL(20,8) NOT NULL,
  pnl DECIMAL(20,8) DEFAULT 0,
  unrealized_pnl DECIMAL(20,8) DEFAULT 0,
  pnl_percentage DECIMAL(10,4) DEFAULT 0,
  value DECIMAL(20,8) NOT NULL,
  side TEXT CHECK (side IN ('LONG', 'SHORT')) DEFAULT 'LONG',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT CHECK (side IN ('BUY', 'SELL')) NOT NULL,
  quantity DECIMAL(20,8) NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  exit_price DECIMAL(20,8),
  pnl DECIMAL(20,8),
  pnl_percentage DECIMAL(10,4),
  strategy TEXT,
  status TEXT CHECK (status IN ('OPEN', 'CLOSED', 'PARTIAL')) DEFAULT 'OPEN',
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  stop_loss DECIMAL(20,8),
  take_profit DECIMAL(20,8),
  commission DECIMAL(20,8) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading strategies table
CREATE TABLE public.strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_return DECIMAL(20,8) DEFAULT 0,
  total_pnl DECIMAL(20,8) DEFAULT 0,
  max_drawdown DECIMAL(10,4) DEFAULT 0,
  sharpe_ratio DECIMAL(10,4) DEFAULT 0,
  profit_factor DECIMAL(10,4) DEFAULT 0,
  avg_trade_duration INTEGER DEFAULT 0, -- in minutes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance history table
CREATE TABLE public.performance_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_value DECIMAL(20,8) NOT NULL,
  pnl_daily DECIMAL(20,8) DEFAULT 0,
  pnl_total DECIMAL(20,8) DEFAULT 0,
  trades_count INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, portfolio_id, date)
);

-- AI Analysis table
CREATE TABLE public.ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  recommendation TEXT CHECK (recommendation IN ('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL')),
  confidence DECIMAL(5,2) NOT NULL,
  reasoning TEXT NOT NULL,
  key_points JSONB,
  target_price DECIMAL(20,8),
  stop_loss DECIMAL(20,8),
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  timeframe TEXT NOT NULL,
  market_sentiment TEXT CHECK (market_sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  indicators_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading journal entries table
CREATE TABLE public.journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  outcome TEXT CHECK (outcome IN ('PROFIT', 'LOSS', 'BREAKEVEN')),
  lessons TEXT,
  ai_analysis_id UUID REFERENCES public.ai_analyses(id),
  screenshots TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market data cache table (for performance)
CREATE TABLE public.market_data_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(symbol, timeframe)
);

-- Indexes for performance
CREATE INDEX idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX idx_positions_user_id ON public.positions(user_id);
CREATE INDEX idx_positions_portfolio_id ON public.positions(portfolio_id);
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_portfolio_id ON public.trades(portfolio_id);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);
CREATE INDEX idx_trades_entry_time ON public.trades(entry_time);
CREATE INDEX idx_strategies_user_id ON public.strategies(user_id);
CREATE INDEX idx_performance_history_user_id ON public.performance_history(user_id);
CREATE INDEX idx_performance_history_date ON public.performance_history(date);
CREATE INDEX idx_ai_analyses_user_id ON public.ai_analyses(user_id);
CREATE INDEX idx_ai_analyses_symbol ON public.ai_analyses(symbol);
CREATE INDEX idx_journal_entries_user_id ON public.journal_entries(user_id);
CREATE INDEX idx_market_data_cache_expires_at ON public.market_data_cache(expires_at);

-- Row Level Security Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view their own profile" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can view their own portfolios" ON public.portfolios FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own positions" ON public.positions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own trades" ON public.trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own strategies" ON public.strategies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own performance" ON public.performance_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own analyses" ON public.ai_analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own journal" ON public.journal_entries FOR ALL USING (auth.uid() = user_id);

-- Market data is public (read-only)
ALTER TABLE public.market_data_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Market data is public" ON public.market_data_cache FOR SELECT USING (true);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();