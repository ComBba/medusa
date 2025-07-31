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
- 로컬: `http://localhost:10000/app/settings/amazon`
- 프로덕션: `https://admin.kbeauty.market/app/settings/amazon`

**사용 가능한 기능**:
1. **동기화 대시보드**: 실시간 동기화 상태 모니터링
2. **마켓플레이스 테이블**: 9개 마켓플레이스 목록 및 상태 확인
3. **마켓플레이스 설정**: 연필 아이콘 클릭하여 Seller ID, MWS Token 설정
4. **활성화 토글**: 스위치를 통한 마켓플레이스 활성화/비활성화
5. **연결 테스트**: 선택한 마켓플레이스의 Amazon SP-API 연결 상태 확인

### 프로그래밍 방식 활성화

```typescript
// 미국 마켓플레이스 활성화 예시 (API 호출)
const response = await fetch('/admin/amazon/marketplaces', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    marketplace_id: "ATVPDKIKX0DER",
    seller_id: "YOUR_SELLER_ID",
    is_active: true,
    auto_sync: true
  })
})

// 또는 서비스 직접 호출
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
GET  /admin/amazon/sync/stats           // 동기화 통계 (예정)
GET  /admin/amazon/sync/status/:id      // 상품별 동기화 상태 (예정)
POST /admin/amazon/sync/:id             // 수동 동기화 (예정)
```

### 환경 변수 참조

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
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

**Phase 3: SP-API 통합** 🚧
- [ ] Amazon SP-API SDK 통합
- [x] 연결 테스트 API 엔드포인트
- [ ] 실제 SP-API 호출 구현
- [ ] 인증 토큰 자동 갱신
- [x] 에러 핸들링 개선

**Phase 3: 상품 동기화** 📋
- [ ] 상품 생성 시 자동 등록
- [ ] 이미지 업로드 및 최적화
- [ ] 카테고리 매핑
- [ ] SEO 최적화

**Phase 4: 실시간 동기화** 📋
- [ ] 재고 변경 감지 및 동기화
- [ ] 가격 업데이트 자동 반영
- [ ] 주문 상태 양방향 동기화
- [ ] 배치 처리 최적화

**Phase 5: 고급 기능** 📋
- [ ] 다국가 통화 변환
- [ ] K-Beauty 특화 최적화
- [ ] 성능 모니터링
- [ ] 자동 보고서 생성

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
> **버전**: 1.2.0  
> **상태**: Admin UI 구현 완료 ✅ 실제 SP-API 통합 진행 중 🚧 