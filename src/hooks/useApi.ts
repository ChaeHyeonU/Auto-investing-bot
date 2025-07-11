'use client';

import { useState, useEffect, useCallback } from 'react';
import { Portfolio, Trade, TradingStrategy, EquityPoint } from '@/types';

/**
 * API Hook for Trading System Backend
 * 
 * This hook provides a convenient way to interact with our Express.js backend API.
 * It handles loading states, error handling, and response caching.
 * 
 * Usage:
 * const { data, loading, error, refetch } = useApi('/api/portfolio');
 */

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Import Supabase service for database operations
import { supabaseService } from '@/services/supabaseService';

export function useApi<T = unknown>(
  endpoint: string,
  options: {
    immediate?: boolean;
    refreshInterval?: number;
  } = {}
): UseApiReturn<T> {
  const { immediate = true, refreshInterval } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<T> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      setData(result.data || null);
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error(`API Error for ${endpoint}:`, errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [fetchData, immediate]);

  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}

/**
 * POST request hook
 */
export function useApiPost<T = unknown, R = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (endpoint: string, body: T): Promise<R | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<R> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      return result.data || null;
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error(`API POST Error for ${endpoint}:`, errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { post, loading, error };
}

/**
 * Specific hooks for trading operations
 */

// Portfolio data hook
export function usePortfolio() {
  return useApi('/api/portfolio', { 
    immediate: true, 
    refreshInterval: 30000 // Refresh every 30 seconds
  });
}

// Trading status hook
export function useTradingStatus() {
  return useApi('/api/trading/status', { 
    immediate: true, 
    refreshInterval: 15000 // Refresh every 15 seconds
  });
}

// Active strategies hook
export function useActiveStrategies() {
  return useApi('/api/strategy/active', { 
    immediate: true, 
    refreshInterval: 60000 // Refresh every 60 seconds
  });
}

// Dashboard analytics hook
export function useDashboardAnalytics() {
  return useApi('/api/analytics/dashboard', { 
    immediate: true, 
    refreshInterval: 60000 // Refresh every 60 seconds
  });
}

// Portfolio history hook
export function usePortfolioHistory(limit: number = 50) {
  return useApi(`/api/portfolio/history?limit=${limit}`, { 
    immediate: true 
  });
}

// Performance metrics hook
export function usePerformanceMetrics(period: string = 'all') {
  return useApi(`/api/analytics/performance/summary?period=${period}`, { 
    immediate: true,
    refreshInterval: 30000 // Refresh every 30 seconds
  });
}

// Risk assessment hook
export function useRiskAssessment() {
  return useApi('/api/analytics/risk/assessment', { 
    immediate: true,
    refreshInterval: 10000 // Refresh every 10 seconds
  });
}

/**
 * Trading action hooks
 */
export function useTradingActions() {
  const { post, loading, error } = useApiPost();

  const startTrading = useCallback(() => 
    post('/api/trading/start', {}), [post]
  );

  const stopTrading = useCallback(() => 
    post('/api/trading/stop', {}), [post]
  );

  const emergencyStop = useCallback(() => 
    post('/api/trading/emergency-stop', {}), [post]
  );

  return {
    startTrading,
    stopTrading,
    emergencyStop,
    loading,
    error
  };
}

/**
 * Strategy management hooks
 */
export function useStrategyActions() {
  const { post, loading, error } = useApiPost();

  const createStrategy = useCallback((strategyData: Partial<TradingStrategy>) => 
    post('/api/strategy/create', strategyData), [post]
  );

  const activateStrategy = useCallback((strategyId: string) => 
    post(`/api/strategy/${strategyId}/activate`, {}), [post]
  );

  const deactivateStrategy = useCallback((strategyId: string) => 
    post(`/api/strategy/${strategyId}/deactivate`, {}), [post]
  );

  return {
    createStrategy,
    activateStrategy,
    deactivateStrategy,
    loading,
    error
  };
}

/**
 * Supabase-based hooks for database operations
 */

// Portfolio data hook using Supabase
export function useSupabasePortfolio() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const portfolio = await supabaseService.getPortfolio();
      setData(portfolio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Trade history hook using Supabase
export function useSupabaseTradeHistory(limit: number = 50) {
  const [data, setData] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const trades = await supabaseService.getTradeHistory(limit);
      setData(trades);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Active strategies hook using Supabase
export function useSupabaseActiveStrategies() {
  const [data, setData] = useState<TradingStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const strategies = await supabaseService.getActiveStrategies();
      setData(strategies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Performance history hook using Supabase
export function useSupabasePerformanceHistory(days: number = 30) {
  const [data, setData] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const performance = await supabaseService.getPerformanceHistory(days);
      
      // Transform DbPerformance[] to EquityPoint[]
      const equityPoints: EquityPoint[] = performance.map((item) => ({
        timestamp: new Date(item.date),
        equity: item.total_value,
        drawdown: 0 // Calculate based on peak values if needed
      }));
      
      setData(equityPoints);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export default useApi;