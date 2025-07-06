# Supabase Setup Guide

이 가이드는 Auto Trading System에서 Supabase 데이터베이스를 설정하는 방법을 설명합니다.

## 📋 사전 준비

1. [Supabase](https://supabase.com) 계정 생성
2. 새로운 Supabase 프로젝트 생성

## 🛠 설정 단계

### 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - **Name**: `auto-trading-system`
   - **Database Password**: 강력한 비밀번호 생성
   - **Region**: 가장 가까운 지역 선택
4. "Create new project" 클릭

### 2. 데이터베이스 스키마 설정

1. Supabase 대시보드에서 "SQL Editor" 탭으로 이동
2. "New query" 클릭
3. `supabase/schema.sql` 파일의 내용을 복사하여 붙여넣기
4. "Run" 버튼 클릭하여 스키마 생성

### 3. 환경 변수 설정

1. Supabase 대시보드에서 "Settings" → "API" 탭으로 이동
2. API 키와 URL 복사
3. 프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## 🔐 Row Level Security (RLS) 설정

데이터베이스 스키마에 이미 RLS 정책이 포함되어 있습니다:

- ✅ 사용자는 자신의 데이터만 볼 수 있음
- ✅ 시장 데이터는 모든 사용자가 읽기 가능
- ✅ 자동 타임스탬프 업데이트

## 📊 데이터베이스 구조

### 주요 테이블

1. **users** - 사용자 프로필
2. **portfolios** - 포트폴리오 정보
3. **positions** - 현재 포지션
4. **trades** - 거래 기록
5. **strategies** - 트레이딩 전략
6. **performance_history** - 성과 기록
7. **ai_analyses** - AI 분석 결과
8. **journal_entries** - 트레이딩 저널

### 관계도

```
users (1) → portfolios (1)
portfolios (1) → positions (*)
portfolios (1) → trades (*)
users (1) → strategies (*)
users (1) → performance_history (*)
users (1) → ai_analyses (*)
users (1) → journal_entries (*)
```

## 🧪 테스트 데이터 삽입

개발용 테스트 데이터를 삽입하려면 다음 SQL을 실행하세요:

```sql
-- 테스트 사용자 (실제 auth.users ID로 교체해야 함)
INSERT INTO users (id, email, username) 
VALUES ('your-user-id-here', 'test@example.com', 'testuser');

-- 테스트 포트폴리오
INSERT INTO portfolios (user_id, total_value, total_pnl, available_balance) 
VALUES ('your-user-id-here', 10000.00, 500.00, 5000.00);

-- 테스트 거래
INSERT INTO trades (user_id, symbol, side, quantity, entry_price, status, entry_time)
VALUES ('your-user-id-here', 'BTCUSDT', 'BUY', 0.1, 45000.00, 'CLOSED', NOW());
```

## 🔄 데이터 마이그레이션

기존 데이터를 Supabase로 마이그레이션하려면:

1. 기존 데이터 백업
2. Supabase 스키마 적용
3. 데이터 변환 스크립트 실행
4. 데이터 검증

## 📈 성능 최적화

### 인덱스 최적화

다음 인덱스가 자동으로 생성됩니다:

- 사용자 ID 기반 조회
- 날짜 범위 조회
- 심볼별 거래 조회
- 성과 기록 날짜별 조회

### 쿼리 최적화

- Row Level Security 정책 활용
- 적절한 LIMIT 사용
- 날짜 범위 제한
- 필요한 컬럼만 SELECT

## 🚀 프로덕션 배포

### 백업 설정

1. Supabase 대시보드에서 "Settings" → "Database" 탭
2. "Point in Time Recovery" 활성화
3. 자동 백업 주기 설정

### 모니터링

1. "Reports" 탭에서 성능 모니터링
2. 슬로우 쿼리 감지
3. API 사용량 추적

## 🔧 문제 해결

### 일반적인 문제

1. **RLS 정책 오류**
   - 사용자 인증 상태 확인
   - 정책 조건 검토

2. **연결 오류**
   - 환경 변수 확인
   - 네트워크 연결 상태 확인

3. **성능 이슈**
   - 쿼리 최적화
   - 인덱스 추가 고려

### 로그 확인

```typescript
// Supabase 클라이언트에서 로그 활성화
import { supabase } from '@/lib/supabase';

// 디버그 모드로 쿼리 실행
const { data, error } = await supabase
  .from('trades')
  .select('*')
  .eq('user_id', userId);

console.log('Query result:', { data, error });
```

## 📚 추가 리소스

- [Supabase 공식 문서](https://supabase.com/docs)
- [PostgreSQL 문서](https://www.postgresql.org/docs/)
- [Row Level Security 가이드](https://supabase.com/docs/guides/auth/row-level-security)

---

**참고**: 실제 프로덕션 환경에서는 적절한 백업, 모니터링, 보안 설정을 반드시 구성해야 합니다.