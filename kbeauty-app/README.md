# 🌸 K-Beauty Market - Amazon Integration

<p align="center">
  Medusa 2.0 기반 한국 뷰티 제품 아마존 마켓플레이스 통합 플랫폼
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Medusa-2.8.8-blueviolet" alt="Medusa Version" />
  <img src="https://img.shields.io/badge/Amazon%20SP--API-Integrated-orange" alt="Amazon SP-API" />
  <img src="https://img.shields.io/badge/Node.js-20+-green" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.9+-blue" alt="TypeScript" />
</p>

## 🚀 프로젝트 개요

이 프로젝트는 Medusa 2.0을 기반으로 한국 뷰티 제품을 아마존 마켓플레이스에 자동으로 동기화하는 이커머스 플랫폼입니다.

### 핵심 기능
- 🔄 **자동 상품 동기화**: Medusa 제품을 아마존 마켓플레이스에 자동 동기화
- 💰 **가격 관리**: 실시간 가격 동기화 및 마켓플레이스별 가격 차별화
- 📦 **재고 관리**: 멀티 마켓플레이스 재고 동기화
- 🛒 **주문 관리**: 아마존 주문을 Medusa로 자동 import
- 📊 **대시보드**: 동기화 상태 모니터링 및 관리
- 🌍 **멀티 마켓플레이스**: 미국, 캐나다, 멕시코, 호주, 스페인, 일본 지원

## 🛠 기술 스택

- **Backend**: Medusa 2.8.8, Node.js 20+, TypeScript 5.9+
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: MinIO (S3 호환)
- **Integration**: Amazon SP-API, Amazon LWA
- **Admin UI**: Medusa Admin SDK 2.8.8

## 📋 시스템 요구사항

- Node.js 20 이상
- PostgreSQL 13 이상
- Redis 6 이상
- 최소 4GB RAM

## 🔧 환경 설정

### 1. 환경 변수 설정
```bash
# .env 파일에 다음 설정을 추가하세요:
DATABASE_URL=postgres://medusa:medusa@localhost:10002/kbeauty_market
REDIS_URL=redis://localhost:10003
PORT=10000

# Amazon SP-API 설정
AMAZON_LWA_CLIENT_ID=your_lwa_client_id
AMAZON_LWA_CLIENT_SECRET=your_lwa_client_secret
AMAZON_LWA_REFRESH_TOKEN=your_refresh_token
AMAZON_SELLER_ID=your_seller_id
AMAZON_SP_API_SANDBOX=true
```

### 2. 설치 및 실행
```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
medusa migrations run

# 시드 데이터 생성
npm run seed

# 개발 서버 실행
npm run dev
```

## 🔄 아마존 통합 기능

### 워크플로우
- **상품 동기화**: `amazon-sync-product`
- **가격 동기화**: `amazon-sync-price`
- **재고 동기화**: `amazon-sync-inventory`
- **주문 동기화**: `amazon-sync-orders`

### 관리 스크립트
```bash
# 아마존 연결 테스트
npm run exec src/scripts/test-amazon-api-connection.ts

# 샌드박스 환경 설정
npm run exec src/scripts/setup-amazon-sandbox.ts

# 마켓플레이스 활성화
npm run exec src/scripts/activate-marketplace.ts

# 통합 상태 검증
npm run exec src/scripts/validate-amazon-integration.ts
```

## 📊 Admin UI 기능

- **동기화 대시보드**: 실시간 동기화 상태 모니터링
- **마켓플레이스 관리**: 아마존 마켓플레이스 활성화/비활성화
- **에러 로그**: 동기화 실패 원인 분석 및 재시도
- **성능 모니터링**: API 호출 제한 및 성능 통계

## 🔗 관련 문서

- [Amazon 통합 가이드](./README.Amazon-Integration-Guide.md)
- [Amazon 샌드박스 완전 가이드](./README.Amazon-Sandbox-Complete-Guide.md)
- [Amazon 테스팅 체크리스트](./README.Amazon-Testing-Checklist.md)
- [Amazon Console 에러 수정](./README.Amazon-Console-Error-Fix.md)
- [Amazon Seller ID 수정](./README.Amazon-Seller-ID-Fix.md)

## 🚨 주의사항

- 프로덕션 환경에서는 반드시 `AMAZON_SP_API_SANDBOX=false`로 설정
- Amazon SP-API rate limit 준수 (초당 10회 호출 제한)
- 민감한 정보 (.env)는 절대 버전 관리에 포함하지 않기

## 🆘 지원

- [Medusa 공식 문서](https://docs.medusajs.com)
- [Amazon SP-API 문서](https://developer-docs.amazon.com/sp-api)
- 이슈 및 문의: GitHub Issues
