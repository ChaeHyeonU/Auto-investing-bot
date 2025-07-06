'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket Hook for Real-time Trading Data
 * 
 * This hook manages WebSocket connections for real-time updates
 * from the trading system backend.
 * 
 * Usage:
 * const { data, connected, sendMessage } = useWebSocket('ws://localhost:3001');
 */

interface WebSocketHookReturn<T = any> {
  data: T | null;
  connected: boolean;
  error: string | null;
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

export function useWebSocket<T = any>(
  url: string,
  options: {
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  } = {}
): WebSocketHookReturn<T> {
  const {
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
        } catch (parseError) {
          console.error('Failed to parse WebSocket message:', parseError);
          setError('Failed to parse message');
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnected(false);

        // Auto-reconnect if enabled and not manually closed
        if (autoReconnect && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

    } catch (connectionError) {
      console.error('Failed to create WebSocket connection:', connectionError);
      setError('Failed to connect');
    }
  }, [url, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (sendError) {
        console.error('Failed to send WebSocket message:', sendError);
        setError('Failed to send message');
      }
    } else {
      console.warn('WebSocket is not connected');
      setError('WebSocket not connected');
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);

  return {
    data,
    connected,
    error,
    sendMessage,
    reconnect
  };
}

/**
 * Specific hook for trading data updates
 */
export function useTradingWebSocket() {
  return useWebSocket('ws://localhost:3001', {
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });
}

export default useWebSocket;