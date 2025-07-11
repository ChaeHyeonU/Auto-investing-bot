'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Socket.IO Hook for Real-time Trading Data
 * 
 * This hook manages Socket.IO connections for real-time updates
 * from the trading system backend.
 */

interface SocketIOHookReturn<T = any> {
  data: T | null;
  connected: boolean;
  error: string | null;
  sendMessage: (event: string, data?: any) => void;
  reconnect: () => void;
}

export function useWebSocket<T = any>(
  url: string,
  options: {
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    enabled?: boolean;
  } = {}
): SocketIOHookReturn<T> {
  const {
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    enabled = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) {
      console.log('Socket.IO disabled by configuration');
      return;
    }

    try {
      // Close existing connection
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      console.log('🔄 Attempting Socket.IO connection to:', url);
      
      socketRef.current = io(url, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        timeout: 20000,
        reconnection: autoReconnect,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectInterval,
        forceNew: true // Force new connection
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Socket.IO connected successfully');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        setConnected(false);
        
        // Only show error for unexpected disconnections
        if (reason !== 'io client disconnect') {
          setError(`Disconnected: ${reason}`);
        }
      });

      socketRef.current.on('connect_error', (err) => {
        const errorMessage = err?.message || 'Connection failed';
        console.warn('⚠️ Socket.IO connection error:', errorMessage);
        setError(`Connection error: ${errorMessage}`);
        setConnected(false);
      });

      // Listen for trading events
      socketRef.current.on('priceUpdate', (updateData) => {
        setData({ type: 'priceUpdate', ...updateData } as T);
      });

      socketRef.current.on('tradeExecuted', (tradeData) => {
        setData({ type: 'tradeExecuted', trade: tradeData } as T);
      });

      socketRef.current.on('portfolioUpdate', (portfolioData) => {
        setData({ type: 'portfolioUpdate', portfolio: portfolioData } as T);
      });

      socketRef.current.on('initialData', (initialData) => {
        setData({ type: 'initialData', ...initialData } as T);
      });

      // Listen for errors
      socketRef.current.on('error', (err) => {
        console.error('❌ Socket.IO error:', err);
        setError(`Socket error: ${err}`);
      });

    } catch (connectionError) {
      console.error('❌ Failed to create Socket.IO connection:', connectionError);
      setError('Failed to initialize connection');
    }
  }, [url, autoReconnect, reconnectInterval, maxReconnectAttempts, enabled]);

  const sendMessage = useCallback((event: string, data?: any) => {
    if (socketRef.current && socketRef.current.connected) {
      try {
        socketRef.current.emit(event, data);
        console.log(`📤 Sent message: ${event}`, data);
      } catch (sendError) {
        console.error('Failed to send Socket.IO message:', sendError);
        setError('Failed to send message');
      }
    } else {
      console.warn('Cannot send message - Socket.IO not connected');
    }
  }, []);

  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnection triggered');
    reconnectAttemptsRef.current = 0;
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      console.log('Socket.IO connection disabled');
      setConnected(false);
      setError(null);
    }

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        console.log('🔌 Disconnecting Socket.IO');
        socketRef.current.disconnect();
      }
    };
  }, [connect, enabled]);

  return {
    data,
    connected,
    error,
    sendMessage,
    reconnect
  };
}

/**
 * Hook specifically for trading data updates
 */
export function useTradingWebSocket() {
  const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const enableWebSocket = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET !== 'false';
  
  return useWebSocket(socketUrl, {
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    enabled: enableWebSocket
  });
}

export default useWebSocket;