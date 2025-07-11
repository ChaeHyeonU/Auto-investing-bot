import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration
 * 
 * Handles database operations for the trading system.
 * Stores trading history, portfolio data, and user information.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase environment variables not configured. Database features will be disabled.');
}

export { supabase };

// Database Types
export interface DbUser {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  username?: string;
  avatar_url?: string;
}

export interface DbPortfolio {
  id: string;
  user_id: string;
  total_value: number;
  total_pnl: number;
  available_balance: number;
  daily_pnl: number;
  created_at: string;
  updated_at: string;
}

export interface DbTrade {
  id: string;
  user_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl?: number;
  strategy?: string;
  status: 'OPEN' | 'CLOSED' | 'PARTIAL';
  entry_time: string;
  exit_time?: string;
  created_at: string;
  updated_at: string;
}

export interface DbStrategy {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_active: boolean;
  total_trades: number;
  win_rate: number;
  total_pnl: number;
  created_at: string;
  updated_at: string;
}

export interface DbPerformance {
  id: string;
  user_id: string;
  date: string;
  total_value: number;
  pnl_daily: number;
  pnl_total: number;
  trades_count: number;
  created_at: string;
}

export default supabase;