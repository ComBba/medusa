# 🌸 kbeauty.market Amazon 연동 가이드

kbeauty.market에서 Amazon 마켓플레이스로 자동 상품 등록 시스템입니다.

## 🎯 주요 기능

- ✅ **자동 동기화**: 상품 생성 시 Amazon에 자동 등록
- 🌍 **다중 마켓플레이스**: 미국, 독일, 일본, 영국, 프랑스, 이탈리아, 스페인, 캐나다, 호주 지원
- 🔄 **실시간 상태 추적**: 동기화 진행 상태 및 결과 모니터링
- 🎨 **K-뷰티 최적화**: 한국 화장품에 특화된 카테고리 매핑 및 SEO
- 📊 **관리자 대시보드**: 동기화 상태 확인 및 관리 기능
- 🛡️ **에러 처리**: 재시도 로직 및 상세한 에러 추적

## 🛠️ 설치 및 설정

### 1. 초기 설정

```bash
# Amazon 연동 모듈 초기 설정
npx medusa exec ./src/scripts/setup-amazon-integration.ts

# 데이터베이스 마이그레이션 실행
npx medusa db:migrate
```

### 2. Amazon SP-API 설정

1. **Amazon Seller Central 등록**
   - [Amazon Seller Central](https://sellercentral.amazon.com) 가입
   - 비즈니스 정보 및 세금 정보 등록

2. **SP-API 애플리케이션 등록**
   - Seller Central > Apps & Services > Develop apps 
   - 새 애플리케이션 생성
   - OAuth 리다이렉트 URI 설정
   - 필요한 API 권한 요청

3. **인증 정보 획득**
   - Client ID
   - Client Secret  
   - Refresh Token
   - Seller ID

### 3. 마켓플레이스 활성화

관리자 대시보드(`/app`)에서:

1. 상품 관리 > Amazon 연동 설정 
2. 원하는 마켓플레이스 선택
3. Seller ID와 인증 토큰 입력
4. 마켓플레이스 활성화

## 📖 사용법

### 자동 동기화

상품을 생성하면 자동으로 활성화된 모든 Amazon 마켓플레이스에 등록됩니다:

```javascript
// 상품 생성 시 자동으로 Amazon 동기화 실행
const product = await createProductsWorkflow(container).run({
  input: {
    products: [{
      title: "Korean Beauty Vitamin C Serum",
      description: "Premium K-Beauty vitamin C serum for glowing skin",
      // ... 기타 상품 정보
    }]
  }
})
```

### 수동 동기화

특정 상품을 수동으로 동기화:

```bash
# 테스트 동기화 실행
npx medusa exec ./src/scripts/test-amazon-sync.ts [product_id]
```

관리자 API를 통한 수동 동기화:

```javascript
POST /admin/amazon/sync
{
  "product_id": "prod_123",
  "marketplace_ids": ["marketplace_1", "marketplace_2"] // 선택사항
}
```

### 동기화 상태 확인

```javascript
GET /admin/amazon/sync?product_id=prod_123
```

## 🗺️ 지원 마켓플레이스

| 국가 | 마켓플레이스 | 통화 | 지역 |
|------|-------------|------|------|
| 🇺🇸 미국 | Amazon.com | USD | NA |
| 🇩🇪 독일 | Amazon.de | EUR | EU |
| 🇯🇵 일본 | Amazon.co.jp | JPY | FE |
| 🇬🇧 영국 | Amazon.co.uk | GBP | EU |
| 🇫🇷 프랑스 | Amazon.fr | EUR | EU |
| 🇮🇹 이탈리아 | Amazon.it | EUR | EU |
| 🇪🇸 스페인 | Amazon.es | EUR | EU |
| 🇨🇦 캐나다 | Amazon.ca | CAD | NA |
| 🇦🇺 호주 | Amazon.com.au | AUD | FE |

## 🎨 K-뷰티 특화 기능

### 카테고리 자동 매핑

```javascript
const categoryMapping = {
  'skincare': 'Beauty',
  'makeup': 'Beauty',
  'face-mask': 'Beauty',
  'serum': 'Beauty',
  'sunscreen': 'Beauty'
  // ... 추가 매핑
}
```

### SEO 최적화

- **지역별 키워드**: 각 국가별 최적화된 제목 생성
- **K-뷰티 키워드**: "Korean Beauty", "K-Beauty" 자동 추가
- **현지화된 설명**: 지역별 언어 및 문화 고려

### 한국 브랜드 정보

- **원산지**: 자동으로 "KR" (한국) 설정
- **제조사**: kbeauty.market으로 기본 설정
- **브랜드 정보**: 메타데이터에서 자동 추출

## 📊 모니터링 및 관리

### 관리자 위젯

상품 상세 페이지에서 Amazon 동기화 상태를 실시간으로 확인:

- 📈 마켓플레이스별 동기화 상태
- 🔄 수동 동기화 실행
- ❌ 실패한 동기화 재시도
- 📝 에러 메시지 및 로그

### API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/admin/amazon/marketplaces` | GET | 마켓플레이스 목록 조회 |
| `/admin/amazon/marketplaces` | POST | 마켓플레이스 설정 |
| `/admin/amazon/sync` | GET | 동기화 상태 조회 |
| `/admin/amazon/sync` | POST | 수동 동기화 실행 |
| `/admin/amazon/sync/retry` | PUT | 실패한 동기화 재시도 |

## 🔧 환경 변수

```bash
# Amazon SP-API 설정
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REFRESH_TOKEN=your_refresh_token
AMAZON_SELLER_ID=your_seller_id

# 환경 설정
NODE_ENV=development  # development = 샌드박스, production = 실제 환경
```

## 🐛 문제 해결

### 일반적인 문제

**Q: 동기화가 실행되지 않습니다**
A: 
1. 마켓플레이스가 활성화되어 있는지 확인
2. Seller ID와 인증 토큰이 올바른지 확인
3. 로그에서 에러 메시지 확인

**Q: Amazon에서 상품이 거부됩니다**
A:
1. 상품 카테고리가 올바른지 확인
2. 필수 속성이 모두 포함되어 있는지 확인
3. 이미지 URL이 유효한지 확인

**Q: Feed 처리가 지연됩니다**
A:
- Amazon Feed 처리는 보통 15-45분이 소요됩니다
- 대량 업로드 시 더 오래 걸릴 수 있습니다

### 로그 확인

```bash
# 백엔드 로그 확인
tail -f .logs/backend.log

# Amazon 동기화 관련 로그만 필터링
tail -f .logs/backend.log | grep -i amazon
```

### 테스트 모드

```bash
# 샌드박스 환경에서 테스트
NODE_ENV=development npx medusa exec ./src/scripts/test-amazon-sync.ts
```

## 📚 추가 리소스

- [Amazon SP-API 공식 문서](https://developer-docs.amazon.com/sp-api/)
- [Amazon MWS to SP-API 마이그레이션](https://developer-docs.amazon.com/sp-api/docs/sp-api-migration-guide)
- [Medusa v2 워크플로우 가이드](https://docs.medusajs.com/learn/fundamentals/workflows)

## 🤝 기여하기

Amazon 연동 기능 개선에 기여하고 싶으시다면:

1. 이슈 등록
2. 기능 제안 
3. 풀 리퀘스트 제출

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 