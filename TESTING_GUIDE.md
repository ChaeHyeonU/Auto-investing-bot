# Auto Trading System Testing Guide

## 테스트 단계별 가이드

### 1. 환경 설정 및 기본 테스트

#### 1.1 의존성 설치 및 빌드 테스트
```bash
# 프로젝트 루트에서 실행
npm install
npm run type-check
npm run build
```

#### 1.2 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env

# 필수 설정값 입력 (.env 파일 편집)
BINANCE_API_KEY=your_testnet_api_key
BINANCE_API_SECRET=your_testnet_secret
BINANCE_TESTNET=true
OPENAI_API_KEY=your_openai_key
```

### 2. 개별 모듈 테스트

#### 2.1 기술적 지표 테스트
```typescript
// tests/indicators.test.ts 생성
import { SimpleMovingAverage, RSI } from '../backend/services/indicators/movingAverages';

// 샘플 캔들 데이터로 지표 테스트
const testCandles = [
  { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: Date.now() },
  // ... 더 많은 데이터
];

const sma = new SimpleMovingAverage(5);
testCandles.forEach(candle => sma.addData(candle));
const result = sma.calculate();
console.log('SMA Result:', result);
```

#### 2.2 바이낸스 API 연결 테스트
```typescript
// tests/binance.test.ts
import { BinanceService } from '../backend/services/binanceService';

async function testBinanceConnection() {
  const binance = new BinanceService();
  
  try {
    // 연결 테스트
    await binance.connect();
    console.log('✅ Binance 연결 성공');
    
    // 계정 정보 테스트 (테스트넷)
    const portfolio = await binance.getAccountInfo();
    console.log('Portfolio:', portfolio);
    
    // 가격 정보 테스트
    const ticker = await binance.getSymbolTicker('BTCUSDT');
    console.log('BTC Price:', ticker.lastPrice);
    
  } catch (error) {
    console.error('❌ Binance 테스트 실패:', error);
  }
}
```

#### 2.3 AI 분석 테스트
```typescript
// tests/ai.test.ts
import { OpenAIService } from '../backend/services/ai/openaiService';

async function testAIAnalysis() {
  const aiService = new OpenAIService();
  
  const mockRequest = {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    marketData: {
      symbol: 'BTCUSDT',
      candlesticks: [], // 실제 데이터
      indicators: []    // 실제 지표 결과
    },
    indicators: [],
    context: 'Test analysis'
  };
  
  try {
    const analysis = await aiService.analyzeMarketData(mockRequest);
    console.log('✅ AI 분석 성공:', analysis.recommendation);
  } catch (error) {
    console.error('❌ AI 분석 실패:', error);
  }
}
```

### 3. 통합 테스트

#### 3.1 백테스팅 시스템 테스트
```typescript
// tests/backtest.test.ts
import { BacktestEngine } from '../backend/services/backtest/backtestEngine';
import { StrategyFactory } from '../backend/services/backtest/strategyFactory';

async function testBacktesting() {
  // 전략 생성
  const strategy = StrategyFactory.createMeanReversionStrategy();
  
  // 백테스트 설정
  const config = {
    strategyId: strategy.id,
    symbol: 'BTCUSDT',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    initialBalance: 10000,
    timeframe: '1h',
    commission: 0.001,
    slippage: 0.0005
  };
  
  // 샘플 역사 데이터 (실제로는 Binance에서 가져옴)
  const historicalData = []; // 실제 캔들 데이터 배열
  
  try {
    const engine = new BacktestEngine(config);
    const result = await engine.runBacktest(historicalData, strategy);
    
    console.log('✅ 백테스트 완료');
    console.log('총 수익률:', result.totalReturnPercentage.toFixed(2) + '%');
    console.log('최대 드로우다운:', result.maxDrawdownPercentage.toFixed(2) + '%');
    console.log('총 거래 수:', result.totalTrades);
    console.log('승률:', result.winRate.toFixed(2) + '%');
    
  } catch (error) {
    console.error('❌ 백테스트 실패:', error);
  }
}
```

### 4. 실시간 테스트 (Paper Trading)

#### 4.1 Trading Engine 테스트
```typescript
// tests/trading.test.ts
import { TradingEngine } from '../backend/services/trading/tradingEngine';
import { StrategyFactory } from '../backend/services/backtest/strategyFactory';

async function testTradingEngine() {
  const engine = new TradingEngine();
  
  // 이벤트 리스너 설정
  engine.on('tradeExecuted', (data) => {
    console.log('✅ 거래 실행:', data.order.symbol, data.order.side, data.order.quantity);
  });
  
  engine.on('tradeError', (error) => {
    console.error('❌ 거래 오류:', error);
  });
  
  engine.on('riskAlert', (alerts) => {
    console.warn('⚠️ 리스크 경고:', alerts);
  });
  
  try {
    // 엔진 시작
    await engine.start();
    console.log('✅ Trading Engine 시작됨');
    
    // 전략 추가
    const strategy = StrategyFactory.createMeanReversionStrategy();
    engine.addStrategy(strategy);
    console.log('✅ 전략 추가됨:', strategy.name);
    
    // 잠시 실행 후 중단 (테스트용)
    setTimeout(() => {
      engine.stop();
      console.log('✅ Trading Engine 중단됨');
    }, 60000); // 1분 후 중단
    
  } catch (error) {
    console.error('❌ Trading Engine 테스트 실패:', error);
  }
}
```

### 5. 통합 시스템 테스트

#### 5.1 전체 플로우 테스트 스크립트
```typescript
// tests/integration.test.ts
async function runFullSystemTest() {
  console.log('🚀 전체 시스템 테스트 시작...\n');
  
  // 1. 환경 확인
  console.log('1. 환경 변수 확인...');
  const requiredEnvs = ['BINANCE_API_KEY', 'BINANCE_API_SECRET', 'OPENAI_API_KEY'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  
  if (missingEnvs.length > 0) {
    console.error('❌ 누락된 환경 변수:', missingEnvs);
    return;
  }
  console.log('✅ 환경 변수 OK\n');
  
  // 2. Binance 연결 테스트
  console.log('2. Binance 연결 테스트...');
  await testBinanceConnection();
  console.log('✅ Binance 연결 OK\n');
  
  // 3. 지표 계산 테스트
  console.log('3. 기술적 지표 테스트...');
  await testTechnicalIndicators();
  console.log('✅ 기술적 지표 OK\n');
  
  // 4. AI 분석 테스트
  console.log('4. AI 분석 테스트...');
  await testAIAnalysis();
  console.log('✅ AI 분석 OK\n');
  
  // 5. 백테스팅 테스트
  console.log('5. 백테스팅 테스트...');
  await testBacktesting();
  console.log('✅ 백테스팅 OK\n');
  
  // 6. Paper Trading 테스트
  console.log('6. Paper Trading 테스트...');
  await testPaperTrading();
  console.log('✅ Paper Trading OK\n');
  
  console.log('🎉 모든 테스트 완료!');
}
```

### 6. 성능 및 스트레스 테스트

#### 6.1 성능 테스트
```typescript
// tests/performance.test.ts
async function testPerformance() {
  console.log('📊 성능 테스트 시작...');
  
  const startTime = Date.now();
  
  // 1000개 캔들 데이터로 지표 계산 속도 테스트
  const sma = new SimpleMovingAverage(20);
  const testData = generateTestCandles(1000);
  
  testData.forEach(candle => sma.addData(candle));
  const result = sma.calculate();
  
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log(`✅ 1000 캔들 처리 시간: ${executionTime}ms`);
  console.log('메모리 사용량:', process.memoryUsage());
}
```

### 7. 실제 테스트 실행 방법

#### 7.1 테스트 스크립트 생성
```bash
# package.json에 테스트 스크립트 추가
"scripts": {
  "test:indicators": "ts-node tests/indicators.test.ts",
  "test:binance": "ts-node tests/binance.test.ts",
  "test:ai": "ts-node tests/ai.test.ts",
  "test:backtest": "ts-node tests/backtest.test.ts",
  "test:trading": "ts-node tests/trading.test.ts",
  "test:integration": "ts-node tests/integration.test.ts",
  "test:performance": "ts-node tests/performance.test.ts"
}
```

#### 7.2 단계별 테스트 실행
```bash
# 1. 기본 환경 테스트
npm run test:indicators

# 2. API 연결 테스트
npm run test:binance

# 3. AI 기능 테스트
npm run test:ai

# 4. 백테스팅 테스트
npm run test:backtest

# 5. Paper Trading 테스트
npm run test:trading

# 6. 전체 통합 테스트
npm run test:integration
```

### 8. 로그 모니터링

#### 8.1 로그 확인
```bash
# 실시간 로그 확인
tail -f logs/combined.log

# 에러 로그만 확인
tail -f logs/error.log

# 특정 서비스 로그 필터링
grep "BinanceService" logs/combined.log
grep "TradingEngine" logs/combined.log
```

### 9. 데이터 검증

#### 9.1 결과 데이터 확인
```typescript
// 백테스트 결과 검증
function validateBacktestResults(result) {
  const checks = [
    result.totalTrades > 0,
    result.winRate >= 0 && result.winRate <= 100,
    result.sharpeRatio !== undefined,
    result.maxDrawdownPercentage >= 0
  ];
  
  return checks.every(check => check);
}

// AI 분석 결과 검증
function validateAIAnalysis(analysis) {
  const validRecommendations = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];
  const validRiskLevels = ['LOW', 'MEDIUM', 'HIGH'];
  
  return validRecommendations.includes(analysis.recommendation) &&
         validRiskLevels.includes(analysis.riskLevel) &&
         analysis.confidence >= 0 && analysis.confidence <= 100;
}
```

### 10. 문제 해결 가이드

#### 10.1 일반적인 문제들
```bash
# API 키 문제
❌ "Invalid API key" 
→ .env 파일의 API 키 확인

# 네트워크 연결 문제
❌ "Connection timeout"
→ 인터넷 연결 및 방화벽 확인

# 메모리 부족
❌ "Out of memory"
→ 큰 데이터셋 처리 시 청크 단위로 분할

# TypeScript 오류
❌ "Type error"
→ npm run type-check로 확인 후 수정
```

#### 10.2 디버깅 팁
```typescript
// 상세 로깅 활성화
process.env.LOG_LEVEL = 'debug';

// 특정 모듈만 테스트
process.env.TEST_MODULE = 'indicators';

// Paper Trading 모드 강제 설정
process.env.TRADING_MODE = 'paper';
```

이 가이드를 따라 단계별로 테스트하시면 각 기능이 올바르게 작동하는지 확인할 수 있습니다!