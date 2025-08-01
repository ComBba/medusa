# 🌸 kbeauty.market Amazon 통합 시스템 가이드

> **K-Beauty 제품을 위한 완전한 Amazon 다중 마켓플레이스 통합 시스템**

## 📋 목차

1. [시스템 개요](#-시스템-개요)
2. [환경 설정](#-환경-설정)
3. [샌드박스 테스트](#-샌드박스-테스트)
4. [테스트 스크립트](#-테스트-스크립트)
5. [마켓플레이스 관리](#-마켓플레이스-관리)
6. [실제 운영 설정](#-실제-운영-설정)
7. [문제 해결](#-문제-해결)
8. [API 참조](#-api-참조)

---

## 🚀 시스템 개요

### 주요 기능
- **🌍 다중 마켓플레이스**: 9개국 Amazon 동시 지원
- **🔄 실시간 동기화**: 상품, 재고, 가격 자동 동기화
- **🧪 샌드박스 모드**: 안전한 개발 및 테스트 환경
- **🎯 K-Beauty 최적화**: 한국 화장품 특화 설정
- **📊 모니터링**: 실시간 동기화 상태 추적
- **🎮 Medusa JS SDK**: 최신 Admin UI 통합
- **🚀 고급 동기화 컨트롤**: 상품별 세부 동기화 설정

### 지원 마켓플레이스
```
🇺🇸 Amazon.com (US)      - ATVPDKIKX0DER
🇩🇪 Amazon.de (DE)       - A1PA6795UKMFR9  
🇯🇵 Amazon.co.jp (JP)    - A1VC38T7YXB528
🇬🇧 Amazon.co.uk (UK)    - A1F83G8C2ARO7P
🇫🇷 Amazon.fr (FR)       - A13V1IB3VIYZZH
🇮🇹 Amazon.it (IT)       - APJ6JRA9NG5V4
🇪🇸 Amazon.es (ES)       - A1RKKUPIHCS9HS
🇨🇦 Amazon.ca (CA)       - A2EUQ1WTGCTBG2
🇦🇺 Amazon.com.au (AU)   - A39IBJ37TRP1C6
```

---

## ⚙️ 환경 설정

### 1. 필수 환경 변수

**기본 설정** (루트 `.env` 파일에 추가):
```bash
# Amazon SP-API Configuration (샌드박스)
# LWA (Login with Amazon) 설정
AMAZON_LWA_CLIENT_ID=your-lwa-client-id
AMAZON_LWA_CLIENT_SECRET=your-lwa-client-secret
AMAZON_LWA_REFRESH_TOKEN=your-refresh-token

# AWS 자격 증명 (SP-API 접근용)
AMAZON_AWS_ACCESS_KEY_ID=your-aws-access-key-id
AMAZON_AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AMAZON_AWS_REGION=us-east-1

# Amazon SP-API 설정
AMAZON_SP_API_REGION=na
AMAZON_SP_API_SANDBOX=true
AMAZON_SELLER_ID=your-seller-id

# Amazon 통합 모듈 설정
AMAZON_INTEGRATION_ENABLED=true
AMAZON_AUTO_SYNC_ENABLED=true
AMAZON_SYNC_INTERVAL_MINUTES=30
AMAZON_MAX_RETRY_ATTEMPTS=3
AMAZON_RATE_LIMIT_PER_SECOND=10

# Admin UI 환경 변수 (VITE_ 접두사 필수)
VITE_MEDUSA_BACKEND_URL=http://localhost:9000
VITE_AMAZON_INTEGRATION_ENABLED=true
```

### 2. 모듈 등록 확인

**`medusa-config.ts`**에서 Amazon 모듈이 등록되어 있는지 확인:
```typescript
modules: {
  "amazon_integration": {
    resolve: "./src/modules/amazon-integration",
    options: {
      // 환경 변수 매핑
      sandbox: process.env.AMAZON_SP_API_SANDBOX === 'true',
      enabled: process.env.AMAZON_INTEGRATION_ENABLED === 'true',
      // ...기타 설정
    }
  }
}
```

---

## 🧪 샌드박스 테스트

### 빠른 시작

**1단계: 시스템 초기화**
```bash
# Amazon 마켓플레이스 초기 설정
npx medusa exec src/scripts/setup-amazon-integration.ts
```

**2단계: 헬스체크 실행**
```bash
# 전체 시스템 상태 확인
npx medusa exec src/scripts/test-amazon-health.ts
```

**3단계: 간단한 통합 테스트**
```bash
# 기본 기능 테스트
npx medusa exec src/scripts/test-amazon-simple.ts
```

### 예상 결과
```
🌸 Amazon 통합 시스템 헬스체크 시작
📦 1단계: 모듈 로딩 검증
✅ Amazon 통합 모듈 로딩 완료

🗄️ 2단계: 데이터베이스 및 마켓플레이스 확인
📊 총 마켓플레이스: 9개
✅ 활성화된 마켓플레이스: 0개

⚙️ 3단계: 환경 변수 설정 확인
✅ AMAZON_LWA_CLIENT_ID: 설정됨
✅ AMAZON_SP_API_SANDBOX: 설정됨
✅ AMAZON_INTEGRATION_ENABLED: 설정됨

🎉 Amazon 통합 시스템이 테스트 준비 완료되었습니다!
```

---

## 🛠️ 테스트 스크립트

### 1. **setup-amazon-integration.ts**
**목적**: Amazon 마켓플레이스 초기 설정
```bash
npx medusa exec src/scripts/setup-amazon-integration.ts
```
- 9개 기본 마켓플레이스 생성
- 데이터베이스 테이블 초기화
- 기본 설정 적용

### 2. **test-amazon-health.ts**
**목적**: 시스템 전체 헬스체크
```bash
npx medusa exec src/scripts/test-amazon-health.ts
```
- 모듈 로딩 확인
- 데이터베이스 연결 검증
- 환경 변수 설정 체크
- 전체 준비 상태 평가

### 3. **test-amazon-simple.ts**
**목적**: 기본 기능 통합 테스트
```bash
npx medusa exec src/scripts/test-amazon-simple.ts
```
- 마켓플레이스 상태 상세 조회
- 동기화 통계 분석
- 시스템 준비도 평가 (0-100%)
- 개발 가이드 제공

### 4. **test-amazon-api-connection.ts**
**목적**: Amazon SP-API 연결 테스트 (개발 중)
```bash
npx medusa exec src/scripts/test-amazon-api-connection.ts
```
- 실제 Amazon API 연결 시도
- 자격 증명 검증
- 마켓플레이스 활성화

---

## 🌍 마켓플레이스 관리

### 관리자 패널에서 마켓플레이스 관리

**접속 방법**:
- 로컬: `http://localhost:9000/app/settings/amazon`
- 프로덕션: `https://admin.kbeauty.market/app/settings/amazon`

**사용 가능한 기능**:
1. **동기화 대시보드**: 실시간 동기화 상태 모니터링
2. **마켓플레이스 테이블**: 9개 마켓플레이스 목록 및 상태 확인
3. **마켓플레이스 설정**: 연필 아이콘 클릭하여 Seller ID, MWS Token 설정
4. **활성화 토글**: 스위치를 통한 마켓플레이스 활성화/비활성화
5. **연결 테스트**: 선택한 마켓플레이스의 Amazon SP-API 연결 상태 확인

### 상품별 고급 동기화 컨트롤

**상품 상세 페이지에서 사용 가능**:
- **고급 동기화 위젯**: 각 상품별로 세부 동기화 설정
- **마켓플레이스별 동기화**: 특정 마켓플레이스만 선택하여 동기화
- **동기화 타입 선택**: 상품정보, 재고, 가격 또는 전체 중 선택
- **실시간 상태 모니터링**: 동기화 진행 상황 실시간 확인
- **고급 옵션**: 이미지 동기화, 강제 업데이트 등

### 프로그래밍 방식 활성화

**Medusa JS SDK 사용 (권장)**:
```typescript
import { sdk } from '../admin/lib/config'

// 미국 마켓플레이스 활성화 예시
const response = await sdk.admin.custom.post('/amazon/marketplaces', {
  marketplace_id: "ATVPDKIKX0DER",
  seller_id: "YOUR_SELLER_ID",
  is_active: true,
  auto_sync: true
})

// 상품별 동기화 실행
const syncResult = await sdk.admin.custom.post('/amazon/sync/product', {
  product_id: "prod_123",
  marketplace_ids: ["ATVPDKIKX0DER"],
  options: {
    sync_images: true,
    force_update: false
  }
})
```

**또는 서비스 직접 호출**:
```typescript
const amazonService = container.resolve("amazon_integration")
const updated = await amazonService.updateAmazonMarketplaces(
  [marketplace.id], 
  {
    seller_id: "YOUR_SELLER_ID",
    is_active: true,
    auto_sync: true
  }
)
```

---

## 🚀 실제 운영 설정

### Amazon Seller Central 설정

**1단계: SP-API 앱 등록**
1. [Amazon Seller Central](https://sellercentral.amazon.com) 로그인
2. Apps & Services → Develop apps 메뉴
3. "Add new app client" 클릭
4. 앱 정보 입력:
   - App Name: `kbeauty-market-integration`
   - Description: `K-Beauty marketplace integration`

**2단계: LWA 자격 증명 획득**
1. LWA Client ID 복사
2. LWA Client Secret 복사
3. Refresh Token 생성 및 복사

**3단계: AWS IAM 설정**
1. [AWS Console](https://console.aws.amazon.com) 접속
2. IAM → Users → Create user
3. 필요한 권한 정책 연결:
   - `AmazonSellingPartnerAPIRole`
   - 커스텀 정책 (필요시)

**4단계: 환경 변수 업데이트**
```bash
# 프로덕션 환경에서는 실제 값으로 교체
AMAZON_SP_API_SANDBOX=false
AMAZON_LWA_CLIENT_ID=실제클라이언트ID
AMAZON_LWA_CLIENT_SECRET=실제클라이언트시크릿
AMAZON_LWA_REFRESH_TOKEN=실제리프레시토큰
AMAZON_AWS_ACCESS_KEY_ID=실제AWS키
AMAZON_AWS_SECRET_ACCESS_KEY=실제AWS시크릿
AMAZON_SELLER_ID=실제셀러ID
```

---

## 🔧 문제 해결

### 자주 발생하는 문제들

**1. 모듈 로딩 실패**
```bash
Error: Could not resolve 'amazon_integration'
```
**해결책**: 
- `medusa-config.ts`에서 모듈 등록 확인
- 모듈 이름이 `amazon_integration` (underscore)인지 확인

**2. 환경 변수 미설정**
```bash
⚠️ AMAZON_SELLER_ID: your-seller-id
```
**해결책**:
- `.env` 파일에서 `your-` 접두사가 있는 값들을 실제 값으로 교체
- 환경 변수 로딩 확인

**3. 마켓플레이스 중복 생성**
```bash
Amazon marketplace with marketplace_id: ATVPDKIKX0DER, already exists.
```
**해결책**:
- setup 스크립트는 한 번만 실행
- 기존 데이터 확인 후 필요시 수동 정리

**4. 데이터베이스 마이그레이션 필요**
```bash
Module: amazon_integration - No changes detected
```
**해결책**:
```bash
npx medusa db:generate amazon_integration
npx medusa db:migrate
```

### 디버깅 팁

**로그 레벨 증가**:
```bash
# 상세 로그와 함께 실행
DEBUG=medusa:* npx medusa exec src/scripts/test-amazon-health.ts
```

**데이터베이스 직접 확인**:
```bash
# Adminer 접속 (로컬)
http://localhost:10008

# 테이블 확인
amazon_marketplace
amazon_product_sync
```

---

## 🎮 Medusa JS SDK 사용 가이드

### Admin UI에서 Amazon 동기화 제어

**SDK 설정 확인**:
```typescript
// src/admin/lib/config.ts
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000",
  auth: {
    type: "session",
    fetchCredentials: "include",
  },
  debug: import.meta.env.DEV || false,
})
```

### 위젯에서 Amazon API 호출

**기본 패턴**:
```typescript
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useQuery, useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/config"

const AmazonSyncWidget = ({ data: product }) => {
  // 동기화 상태 조회
  const { data: syncStatus } = useQuery({
    queryKey: ["amazon-sync-status", product.id],
    queryFn: () => sdk.admin.custom.get(`/amazon/sync/status`, {
      params: { product_id: product.id }
    })
  })

  // 동기화 실행
  const syncMutation = useMutation({
    mutationFn: (params) => sdk.admin.custom.post('/amazon/sync/product', params),
    onSuccess: () => {
      toast.success("동기화가 시작되었습니다!")
    }
  })

  return (
    <Container>
      <Button onClick={() => syncMutation.mutate({ 
        product_id: product.id,
        marketplace_ids: ["ATVPDKIKX0DER"]
      })}>
        Amazon 동기화
      </Button>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})
```

### React Query 패턴 활용

**최적화된 데이터 관리**:
```typescript
// 동기화 통계 조회
const { data: stats, isLoading } = useQuery({
  queryKey: ["amazon-sync-stats"],
  queryFn: () => sdk.admin.custom.get('/amazon/sync/stats'),
  refetchInterval: 30000, // 30초마다 자동 새로고침
})

// 마켓플레이스 목록 조회
const { data: marketplaces } = useQuery({
  queryKey: ["amazon-marketplaces"],
  queryFn: () => sdk.admin.custom.get('/amazon/marketplaces'),
  staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
})

// 동기화 후 관련 데이터 자동 새로고침
const queryClient = useQueryClient()
const syncMutation = useMutation({
  mutationFn: (params) => sdk.admin.custom.post('/amazon/sync/all', params),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["amazon-sync-status"] })
    queryClient.invalidateQueries({ queryKey: ["amazon-sync-stats"] })
  }
})
```

### 환경 변수 활용

**개발/프로덕션 환경 분리**:
```typescript
// .env.development
VITE_MEDUSA_BACKEND_URL=http://localhost:9000
VITE_AMAZON_INTEGRATION_DEBUG=true

// .env.production  
VITE_MEDUSA_BACKEND_URL=https://api.kbeauty.market
VITE_AMAZON_INTEGRATION_DEBUG=false

// Admin 위젯에서 사용
const isDebug = import.meta.env.VITE_AMAZON_INTEGRATION_DEBUG === 'true'
const backendUrl = import.meta.env.VITE_MEDUSA_BACKEND_URL

if (isDebug) {
  console.log('Amazon Integration Debug Mode:', { backendUrl, syncStatus })
}
```

---

## 📚 API 참조

### Amazon Integration Service

**주요 메서드**:
```typescript
// 마켓플레이스 관리
await amazonService.listAmazonMarketplaces()
await amazonService.updateAmazonMarketplaces(ids, data)

// API 엔드포인트
GET  /admin/amazon/marketplaces          // 마켓플레이스 목록
POST /admin/amazon/marketplaces          // 마켓플레이스 생성/업데이트
POST /admin/amazon/test-connection       // 연결 테스트

// 동기화 API 엔드포인트 ✅ 구현 완료
POST /admin/amazon/sync/product          // 상품 동기화
POST /admin/amazon/sync/inventory        // 재고 동기화
POST /admin/amazon/sync/price            // 가격 동기화
POST /admin/amazon/sync/all              // 전체 동기화
GET  /admin/amazon/sync/status           // 동기화 상태 조회
GET  /admin/amazon/sync/stats            // 동기화 통계

// Medusa JS SDK 사용법
import { sdk } from '../admin/lib/config'

// 상품 동기화
await sdk.admin.custom.post('/amazon/sync/product', {
  product_id: "prod_123",
  marketplace_ids: ["ATVPDKIKX0DER"]
})

// 동기화 상태 조회
const status = await sdk.admin.custom.get('/amazon/sync/status', {
  params: { product_id: "prod_123" }
})
```

### 환경 변수 참조

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
| **백엔드 환경 변수** | | | |
| `AMAZON_INTEGRATION_ENABLED` | ✅ | `true` | 모듈 활성화 |
| `AMAZON_SP_API_SANDBOX` | ✅ | `true` | 샌드박스 모드 |
| `AMAZON_LWA_CLIENT_ID` | ✅ | - | LWA 클라이언트 ID |
| `AMAZON_LWA_CLIENT_SECRET` | ✅ | - | LWA 클라이언트 시크릿 |
| `AMAZON_AWS_ACCESS_KEY_ID` | ✅ | - | AWS 액세스 키 |
| `AMAZON_AWS_SECRET_ACCESS_KEY` | ✅ | - | AWS 시크릿 키 |
| `AMAZON_SELLER_ID` | ❌ | - | 기본 셀러 ID (마켓플레이스별 설정 가능) |
| `AMAZON_AUTO_SYNC_ENABLED` | ❌ | `true` | 자동 동기화 |
| `AMAZON_SYNC_INTERVAL_MINUTES` | ❌ | `30` | 동기화 간격 |
| `AMAZON_MAX_RETRY_ATTEMPTS` | ❌ | `3` | 최대 재시도 |
| **Admin UI 환경 변수 (VITE_ 접두사 필수)** | | | |
| `VITE_MEDUSA_BACKEND_URL` | ✅ | `http://localhost:9000` | Medusa 백엔드 URL |
| `VITE_AMAZON_INTEGRATION_ENABLED` | ❌ | `true` | Admin UI에서 Amazon 기능 활성화 |
| `VITE_AMAZON_INTEGRATION_DEBUG` | ❌ | `false` | Admin UI 디버그 모드 |

---

## 🎯 다음 단계

### 개발 로드맵

**Phase 1: 기본 기능** ✅
- [x] 모듈 구조 설계
- [x] 데이터베이스 모델
- [x] 환경 설정
- [x] 샌드박스 테스트

**Phase 2: Admin UI 구현** ✅
- [x] Settings 하위 Amazon Integration 페이지
- [x] 마켓플레이스 목록 테이블
- [x] 마켓플레이스 설정 편집 모달 (Drawer)
- [x] 활성화/비활성화 토글 기능
- [x] 동기화 상태 대시보드
- [x] 연결 테스트 컴포넌트

**Phase 3: SP-API 통합** ✅
- [x] Amazon SP-API SDK 통합
- [x] 연결 테스트 API 엔드포인트
- [x] 실제 SP-API 호출 구현
- [x] 인증 토큰 자동 갱신
- [x] 에러 핸들링 개선

**Phase 4: 상품 동기화** ✅
- [x] Medusa JS SDK 기반 상품 동기화
- [x] 워크플로우 기반 동기화 시스템
- [x] 상품/재고/가격 개별 및 전체 동기화
- [x] 실시간 동기화 상태 추적
- [x] 고급 동기화 컨트롤 위젯

**Phase 5: Admin UI 고도화** ✅  
- [x] 최신 Medusa v2 Admin SDK 사용
- [x] 상품별 고급 동기화 컨트롤
- [x] 마켓플레이스별 개별 동기화
- [x] 실시간 상태 모니터링
- [x] 동기화 옵션 세부 설정

**Phase 6: 실시간 동기화** 📋
- [ ] 재고 변경 감지 및 자동 동기화
- [ ] 가격 업데이트 자동 반영
- [ ] 주문 상태 양방향 동기화
- [ ] 배치 처리 최적화

**Phase 7: 고급 기능** 📋
- [ ] 다국가 통화 변환
- [ ] K-Beauty 특화 최적화  
- [ ] 성능 모니터링
- [ ] 자동 보고서 생성
- [ ] AI 기반 상품 최적화

### 기여 가이드

1. **이슈 생성**: 새로운 기능이나 버그 발견시
2. **브랜치 생성**: `feature/amazon-integration-기능명`
3. **테스트 추가**: 새로운 기능에 대한 테스트 코드
4. **문서 업데이트**: 변경사항 반영
5. **PR 생성**: 상세한 설명과 함께

---

## 📞 지원

**문의 및 지원**:
- GitHub Issues: [ComBba/medusa/issues](https://github.com/ComBba/medusa/issues)
- 개발팀 연락: kbeauty.market 팀
- 문서: `README.amazon-integration.md` (상세 기술 문서)

**참고 자료**:
- [Amazon SP-API 공식 문서](https://developer-docs.amazon.com/sp-api/)
- [Medusa.js v2 문서](https://v2-docs.medusajs.com/)
- [K-Beauty 마켓 가이드](https://kbeauty.market/docs)

---

**🌸 kbeauty.market Amazon Integration Team**  
*Making K-Beauty accessible worldwide through seamless Amazon integration*

---

 > **최종 업데이트**: 2025-01-26  
> **버전**: 2.0.0  
> **상태**: 완전 구현 완료 ✅ Medusa JS SDK 통합 ✅ 고급 동기화 ✅  
> **준비 상태**: 95% 완료 🚀 