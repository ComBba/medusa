# 🚀 Amazon SP-API SDK V2 통합 가이드

## 📋 개요

K-Beauty 앱에 공식 Amazon SP-API SDK를 통합하여 더 안정적이고 효율적인 Amazon 마켓플레이스 동기화를 제공합니다.

## 🔧 새로운 기능

### 1. 공식 SDK 통합
- **패키지**: `amazon-sp-api` (공식 npm 패키지)
- **자동 Rate Limiting**: SDK에서 자동으로 처리
- **자동 토큰 갱신**: Refresh Token 자동 관리
- **에러 핸들링**: 향상된 에러 처리 및 재시도 로직

### 2. 새로운 서비스 구조

```typescript
// 새로운 SDK 클라이언트
AmazonSPAPIClient
├── getMarketplaceParticipations()
├── putListingsItem()
├── patchListingsItem()  
├── updatePrice()
├── updateInventory()
├── getOrders()
└── testConnection()
```

### 3. 향상된 워크플로우

```typescript
// 새로운 워크플로우
amazonSyncEnhancedV2Workflow
├── testAmazonConnectionStep
├── getMarketplaceInfoStep
├── syncProductToAmazonStep
└── reportSyncResultsStep
```

## 🛠 설치 및 설정

### 1. 의존성 설치

```bash
npm install amazon-sp-api
```

### 2. 환경 변수 설정

```bash
# Amazon SP-API 설정 (필수)
AMAZON_CLIENT_ID=amzn1.application-oa2-client.your-client-id
AMAZON_CLIENT_SECRET=amzn1.oa2-cs.v1.your-client-secret
AMAZON_REFRESH_TOKEN=Atzr|your-refresh-token
AMAZON_SELLER_ID=your-seller-id
AMAZON_REGION=NA
AMAZON_SANDBOX_MODE=true

# 기본 마켓플레이스 (선택사항)
AMAZON_DEFAULT_MARKETPLACE_ID=ATVPDKIKX0DER
```

### 3. 서비스 초기화

```typescript
// 자동 초기화 - 환경변수 기반
const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)

// 연결 테스트
const connectionResult = await amazonService.testAmazonConnection()
```

## 🔄 사용법

### 1. 상품 동기화

```typescript
// 기본 상품 동기화
await amazonService.submitProductToAmazon(
  productId,
  marketplaceId,
  'VALIDATION_PREVIEW' // 또는 'LISTING'
)

// 향상된 워크플로우 사용
await amazonSyncEnhancedV2Workflow.run({
  input: {
    product_id: productId,
    sync_type: 'all',
    options: {
      validation_only: true,
      batch_mode: true
    }
  }
})
```

### 2. 가격 업데이트

```typescript
// 개별 가격 업데이트
await amazonService.updateProductPrice(
  productId,
  marketplaceId,
  29.99,
  'USD'
)

// 모든 마켓플레이스에 가격 동기화
await syncPriceToAllMarketplaces(productId)
```

### 3. 재고 업데이트

```typescript
// 개별 재고 업데이트
await amazonService.updateProductInventory(
  productId,
  marketplaceId,
  100
)

// 모든 마켓플레이스에 재고 동기화
await syncInventoryToAllMarketplaces(productId)
```

### 4. 마켓플레이스 정보 조회

```typescript
// 참여 중인 마켓플레이스 조회
const participations = await amazonService.getMarketplaceParticipations()

// 특정 리스팅 정보 조회
const listing = await amazonService.getAmazonListing(sku, marketplaceId)
```

## 📊 모니터링 및 로깅

### 동기화 상태 추적

```typescript
// 동기화 기록 자동 저장
- 성공/실패 상태
- 에러 메시지
- 동기화 데이터
- 타임스탬프
```

### 로그 출력 예시

```
🧪 [AMAZON SYNC V2] 샌드박스 모드: YES
🔗 [AMAZON SYNC V2] 지역: NA
📝 [AMAZON SYNC V2] 모드: VALIDATION_PREVIEW
✅ [AMAZON SYNC V2] 제품 prod_123 제출 완료
📊 [AMAZON SYNC V2] 동기화 완료 - 성공: 3, 실패: 0
```

## 🛡 에러 핸들링

### 자동 재시도 로직

```typescript
// SDK 내장 기능
- Rate Limiting 자동 처리
- 토큰 자동 갱신
- 네트워크 에러 재시도
```

### 보상 작업 (Compensation)

```typescript
// 워크플로우 실패 시 자동 롤백
- 부분 성공 시 보상 작업
- 동기화 상태 복원
- 에러 알림
```

## 🧪 테스트

### 연결 테스트

```bash
# API 호출을 통한 연결 테스트
curl -X POST http://localhost:9000/admin/amazon/test-connection
```

### 샌드박스 테스트

```typescript
// 환경변수 설정
AMAZON_SANDBOX_MODE=true

// 검증 모드로 테스트
mode: 'VALIDATION_PREVIEW'
```

## 📈 성능 최적화

### 배치 처리

```typescript
// 여러 마켓플레이스 동시 처리
options: {
  batch_mode: true,
  force_update: false
}
```

### 캐싱

```typescript
// 마켓플레이스 정보 캐싱
// 토큰 캐싱 (SDK 내장)
// 동기화 상태 캐싱
```

## 🔄 마이그레이션 가이드

### 기존 코드에서 새 SDK로

```typescript
// 기존 방식
const result = await this.callSpApiListings(...)

// 새로운 방식
const result = await spApiClient.putListingsItem(...)
```

### 워크플로우 업데이트

```typescript
// 기존 워크플로우
amazon-sync-product

// 새로운 워크플로우  
amazon-sync-enhanced-v2
```

## 🚨 중요 참고사항

### 1. 환경 설정
- 모든 필수 환경변수 설정 필요
- 샌드박스 모드에서 충분한 테스트 후 프로덕션 전환

### 2. Rate Limiting
- SDK에서 자동 처리
- 수동 Rate Limiting 코드 제거 가능

### 3. 에러 처리
- 모든 API 호출에 try-catch 적용
- 동기화 실패 시 자동 기록

### 4. 보안
- 환경변수로 민감 정보 관리
- 토큰 자동 갱신으로 보안 강화

## 📋 TODO 체크리스트

### Phase 1: SDK 통합 ✅
- [x] amazon-sp-api 패키지 설치
- [x] AmazonSPAPIClient 서비스 생성
- [x] 기존 서비스에 SDK 통합
- [x] 새로운 워크플로우 생성

### Phase 2: 테스트 및 검증 (진행 중)
- [ ] 연결 테스트 구현
- [ ] 샌드박스 환경 테스트
- [ ] 에러 핸들링 테스트
- [ ] 성능 테스트

### Phase 3: 프로덕션 준비
- [ ] 환경 변수 문서화
- [ ] 모니터링 대시보드
- [ ] 알림 시스템 통합
- [ ] 백업 및 복구 프로세스

## 📞 지원

문제가 발생하거나 질문이 있는 경우:

1. **로그 확인**: 콘솔 로그에서 에러 메시지 확인
2. **환경 변수**: 모든 필수 환경변수 설정 확인
3. **연결 테스트**: API 연결 상태 확인
4. **샌드박스 모드**: 프로덕션 전 충분한 테스트

---

**🎯 목표**: 안정적이고 효율적인 Amazon 마켓플레이스 통합으로 K-Beauty 제품의 글로벌 진출 지원