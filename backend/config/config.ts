import dotenv from 'dotenv';
import { AppConfig } from '@/types';
import path from 'path';

// .env.local 파일을 명시적으로 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const config: AppConfig = {
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: process.env.BINANCE_TESTNET === 'true',
    recvWindow: 5000
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7
  },
  
  notion: {
    apiKey: process.env.NOTION_API_KEY || '',
    databaseId: process.env.NOTION_DATABASE_ID || ''
  },
  
  trading: {
    mode: (process.env.TRADING_MODE as 'PAPER' | 'LIVE') || 'PAPER',
    maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT || '100'),
    riskPercentage: parseFloat(process.env.RISK_PERCENTAGE || '2'),
    symbols: process.env.DEFAULT_SYMBOLS?.split(',') || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
    defaultTimeframe: '1h'
  },
  
  server: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || 'localhost',
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true
    }
  }
};

export default config;