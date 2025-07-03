import { SimpleMovingAverage } from '../backend/services/indicators/movingAverages';
import { RelativeStrengthIndex } from '../backend/services/indicators/oscillators';
import { IndicatorManager } from '../backend/services/indicators/indicatorManager';
import { StrategyFactory } from '../backend/services/backtest/strategyFactory';
import { CandlestickData } from '../src/types';

/**
 * 빠른 기능 테스트 스크립트
 * 실제 API 키 없이도 테스트 가능한 기본 기능들을 확인
 */

// 샘플 캔들 데이터 생성
function generateSampleCandles(count: number = 100): CandlestickData[] {
  const candles: CandlestickData[] = [];
  let basePrice = 50000; // 시작 가격 (BTC 기준)
  
  for (let i = 0; i < count; i++) {
    // 랜덤 가격 변동 (-2% ~ +2%)
    const change = (Math.random() - 0.5) * 0.04;
    const open = basePrice;
    const close = basePrice * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    candles.push({
      openTime: Date.now() - (count - i) * 3600000, // 1시간 간격
      open,
      high,
      low,
      close,
      volume: 100 + Math.random() * 900, // 100~1000 랜덤 볼륨
      closeTime: Date.now() - (count - i - 1) * 3600000,
      quoteAssetVolume: 0,
      numberOfTrades: 100,
      takerBuyBaseAssetVolume: 0,
      takerBuyQuoteAssetVolume: 0
    });
    
    basePrice = close;
  }
  
  return candles;
}

// 1. 기술적 지표 테스트
async function testTechnicalIndicators() {
  console.log('\n🔍 기술적 지표 테스트 시작...');
  
  try {
    const candles = generateSampleCandles(50);
    
    // SMA 테스트
    console.log('\n📈 SMA (Simple Moving Average) 테스트:');
    const sma = new SimpleMovingAverage(20);
    candles.forEach(candle => sma.addData(candle));
    const smaResult = sma.calculate();
    
    if (smaResult) {
      console.log(`✅ SMA 계산 성공: ${(smaResult.value as number).toFixed(2)}`);
      console.log(`   신호: ${smaResult.signal}, 강도: ${smaResult.strength}`);
    } else {
      console.log('❌ SMA 계산 실패');
    }
    
    // RSI 테스트
    console.log('\n📊 RSI (Relative Strength Index) 테스트:');
    const rsi = new RelativeStrengthIndex(14);
    candles.forEach(candle => rsi.addData(candle));
    const rsiResult = rsi.calculate();
    
    if (rsiResult) {
      console.log(`✅ RSI 계산 성공: ${(rsiResult.value as number).toFixed(2)}`);
      console.log(`   신호: ${rsiResult.signal}, 강도: ${rsiResult.strength}`);
      
      // RSI 해석
      const rsiValue = rsiResult.value as number;
      if (rsiValue > 70) {
        console.log('   💡 과매수 구간 (매도 고려)');
      } else if (rsiValue < 30) {
        console.log('   💡 과매도 구간 (매수 고려)');
      } else {
        console.log('   💡 중립 구간');
      }
    } else {
      console.log('❌ RSI 계산 실패');
    }
    
    console.log('✅ 기술적 지표 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 기술적 지표 테스트 실패:', error);
  }
}

// 2. 지표 매니저 테스트
async function testIndicatorManager() {
  console.log('\n🎯 지표 매니저 테스트 시작...');
  
  try {
    const manager = new IndicatorManager('BTCUSDT');
    const candles = generateSampleCandles(100);
    
    // 캔들 데이터 추가
    candles.forEach(candle => manager.addCandlestickData(candle));
    
    // 모든 지표 계산
    const results = manager.calculateAllIndicators();
    console.log(`✅ ${results.size}개 지표 계산 완료`);
    
    // 결과 출력
    let validResults = 0;
    results.forEach((result, name) => {
      if (result) {
        validResults++;
        console.log(`   ${name}: ${result.signal} (강도: ${result.strength})`);
      }
    });
    
    console.log(`✅ ${validResults}개 지표가 유효한 결과 반환`);
    
    // 통합 신호 생성
    const aggregatedSignal = manager.getAggregatedSignal();
    console.log('\n📊 통합 신호 결과:');
    console.log(`   최종 신호: ${aggregatedSignal.signal}`);
    console.log(`   신뢰도: ${aggregatedSignal.confidence.toFixed(1)}%`);
    
    // 시장 상태 확인
    const marketCondition = manager.getMarketCondition();
    console.log(`   시장 상태: ${marketCondition}`);
    
    console.log('✅ 지표 매니저 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 지표 매니저 테스트 실패:', error);
  }
}

// 3. 전략 팩토리 테스트
async function testStrategyFactory() {
  console.log('\n🎲 전략 팩토리 테스트 시작...');
  
  try {
    // 모든 사전 정의된 전략 가져오기
    const strategies = StrategyFactory.getAllStrategies();
    console.log(`✅ ${strategies.length}개 전략 로드 완료`);
    
    strategies.forEach((strategy, index) => {
      console.log(`\n${index + 1}. ${strategy.name}`);
      console.log(`   설명: ${strategy.description}`);
      console.log(`   지표 수: ${strategy.indicators.length}`);
      console.log(`   규칙 수: ${strategy.rules.length}`);
      console.log(`   활성 상태: ${strategy.isActive ? '✅' : '❌'}`);
      
      // 리스크 관리 설정 확인
      const risk = strategy.riskManagement;
      console.log(`   최대 포지션: ${(risk.maxPositionSize * 100).toFixed(1)}%`);
      console.log(`   손절: ${risk.stopLossPercentage}%, 익절: ${risk.takeProfitPercentage}%`);
    });
    
    // 전략 유효성 검증
    console.log('\n🔍 전략 유효성 검증:');
    strategies.forEach(strategy => {
      const validation = StrategyFactory.validateStrategy(strategy);
      if (validation.isValid) {
        console.log(`✅ ${strategy.name}: 유효함`);
      } else {
        console.log(`❌ ${strategy.name}: 오류 - ${validation.errors.join(', ')}`);
      }
    });
    
    // 시장 상황별 전략 추천
    console.log('\n💡 시장 상황별 전략 추천:');
    const bullStrategies = StrategyFactory.getStrategiesForMarketCondition('BULL');
    const bearStrategies = StrategyFactory.getStrategiesForMarketCondition('BEAR');
    const sidewaysStrategies = StrategyFactory.getStrategiesForMarketCondition('SIDEWAYS');
    
    console.log(`   상승장: ${bullStrategies.map(s => s.name).join(', ')}`);
    console.log(`   하락장: ${bearStrategies.map(s => s.name).join(', ')}`);
    console.log(`   횡보장: ${sidewaysStrategies.map(s => s.name).join(', ')}`);
    
    console.log('✅ 전략 팩토리 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 전략 팩토리 테스트 실패:', error);
  }
}

// 4. 성능 테스트
async function testPerformance() {
  console.log('\n⚡ 성능 테스트 시작...');
  
  try {
    const largeDataset = generateSampleCandles(1000);
    
    // 지표 계산 성능 테스트
    console.log('📊 1000개 캔들 데이터로 성능 테스트...');
    
    const startTime = Date.now();
    
    const manager = new IndicatorManager('BTCUSDT');
    largeDataset.forEach(candle => manager.addCandlestickData(candle));
    const results = manager.calculateAllIndicators();
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`✅ 실행 시간: ${executionTime}ms`);
    console.log(`✅ 처리 속도: ${(largeDataset.length / executionTime * 1000).toFixed(0)} 캔들/초`);
    
    // 메모리 사용량 확인
    const memoryUsage = process.memoryUsage();
    console.log('📊 메모리 사용량:');
    console.log(`   RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('✅ 성능 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 성능 테스트 실패:', error);
  }
}

// 5. 전체 시스템 상태 확인
async function checkSystemHealth() {
  console.log('\n🏥 시스템 상태 확인...');
  
  try {
    // Node.js 버전 확인
    console.log(`Node.js 버전: ${process.version}`);
    
    // TypeScript 컴파일 확인
    console.log('TypeScript 컴파일 상태: ✅ (스크립트 실행 중이므로 정상)');
    
    // 환경 변수 확인 (중요한 것들만)
    const envStatus = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      TRADING_MODE: process.env.TRADING_MODE || 'paper'
    };
    
    console.log('환경 설정:');
    Object.entries(envStatus).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    // 필수 디렉토리 확인
    const fs = require('fs');
    const requiredDirs = ['backend', 'src', 'tests', 'logs'];
    
    console.log('디렉토리 구조:');
    requiredDirs.forEach(dir => {
      const exists = fs.existsSync(dir);
      console.log(`   ${dir}: ${exists ? '✅' : '❌'}`);
    });
    
    console.log('✅ 시스템 상태 확인 완료!');
    
  } catch (error) {
    console.error('❌ 시스템 상태 확인 실패:', error);
  }
}

// 메인 테스트 실행 함수
async function runQuickTest() {
  console.log('🚀 Auto Trading System - 빠른 기능 테스트');
  console.log('='.repeat(50));
  
  try {
    await checkSystemHealth();
    await testTechnicalIndicators();
    await testIndicatorManager();
    await testStrategyFactory();
    await testPerformance();
    
    console.log('\n🎉 모든 기본 기능 테스트 완료!');
    console.log('\n💡 다음 단계:');
    console.log('   1. .env 파일 설정 후 API 연결 테스트');
    console.log('   2. 백테스팅 시스템 테스트');
    console.log('   3. Paper Trading 테스트');
    console.log('   4. 실제 거래 (충분한 테스트 후)');
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  runQuickTest();
}

export { runQuickTest, testTechnicalIndicators, testIndicatorManager, testStrategyFactory };