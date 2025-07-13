# 🌸 kbeauty.market - 한국 화장품 글로벌 마켓플레이스

kbeauty.market은 medusa.js를 기반으로 한국 화장품을 세계 각국의 아마존을 통해 판매자와 소비자를 연결하는 플랫폼입니다.

## 🚀 빠른 시작

### 1. 포크 및 클론
```bash
# 1. GitHub에서 medusajs/medusa를 본인 계정으로 포크
# 2. 포크된 저장소를 클론
git clone https://github.com/YOUR_USERNAME/medusa.git
cd medusa

# 3. 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/medusajs/medusa.git
```

### 2. 환경 설정
```bash
# 환경 변수 설정
cp kbeauty.env.example .env
# .env 파일을 수정하여 필요한 설정 변경

# 의존성 설치
yarn install

# Docker 서비스 시작 (데이터베이스, 레디스 등)
yarn kbeauty:docker:up
```

### 3. 개발 환경 설정
```bash
# Nginx 설정 (포트 포워딩)
./scripts/setup-nginx.sh

# Hosts 파일 설정 (도메인 매핑)
./scripts/setup-hosts.sh

# 데이터베이스 마이그레이션
yarn kbeauty:db:migrate

# 관리자 계정 생성
yarn kbeauty:user:create
```

### 4. 개발 서버 실행
```bash
# 전체 개발 환경 실행 (권장)
yarn kbeauty:dev

# 또는 개별 실행
yarn kbeauty:backend    # 백엔드 서버 (포트 10000)
yarn kbeauty:admin      # 관리자 패널 (포트 10001)
# 프론트엔드 스토어프론트는 별도 구성 필요
```

## 🌐 서비스 URL

### 개발 환경
- **메인 스토어**: http://kbeauty.market
- **API 서버**: http://api.kbeauty.market
- **관리자 패널**: http://admin.kbeauty.market
- **데이터베이스 관리**: http://db.kbeauty.market
- **파일 저장소**: http://storage.kbeauty.market
- **S3 API**: http://s3.kbeauty.market

### 포트 정보
- Backend API: 10000
- Admin Panel: 10001
- PostgreSQL: 10002
- Redis: 10003
- Storefront: 10004
- Adminer: 10008
- MinIO API: 10009
- MinIO Console: 10010

## 🐳 Docker 서비스

### 서비스 관리
```bash
# 모든 서비스 시작
yarn kbeauty:docker:up

# 모든 서비스 중지
yarn kbeauty:docker:down

# 로그 확인
yarn kbeauty:docker:logs

# 특정 서비스만 실행
docker-compose up -d postgres redis
```

### 포함된 서비스
- **PostgreSQL**: 데이터베이스 (포트 10002)
- **Redis**: 캐시 및 세션 스토어 (포트 10003)
- **Adminer**: 데이터베이스 관리 도구 (포트 10008)
- **MinIO**: S3 호환 파일 저장소 (포트 10009, 10010)

## 🛠️ 개발 가이드

### 디렉토리 구조
```
.
├── packages/
│   ├── medusa/           # 백엔드 코어
│   ├── admin/            # 관리자 패널
│   └── ...
├── docker-compose.yml    # Docker 서비스 정의
├── medusa-config.js      # Medusa 설정
├── nginx/                # Nginx 설정
├── scripts/              # 개발 스크립트
└── README.kbeauty.md     # 이 파일
```

### 주요 명령어
```bash
# 개발 서버 실행
yarn kbeauty:dev

# 빌드
yarn kbeauty:build

# 프로덕션 서버 실행
yarn kbeauty:start

# 데이터베이스 마이그레이션
yarn kbeauty:db:migrate

# 데이터베이스 시드
yarn kbeauty:db:seed

# 관리자 계정 생성
yarn kbeauty:user:create
```

### 백엔드 개발
- **경로**: `packages/medusa/`
- **포트**: 10000
- **설정**: `medusa-config.js`
- **API 문서**: http://api.kbeauty.market/docs

### 관리자 패널 개발
- **경로**: `packages/admin/`
- **포트**: 10001
- **URL**: http://admin.kbeauty.market

### 협업 가이드
1. **브랜치 전략**: `main` > `develop` > `feature/기능명`
2. **코드 스타일**: ESLint + Prettier 설정 준수
3. **커밋 메시지**: 영어 또는 한국어 일관성 유지
4. **PR 리뷰**: 모든 변경사항은 코드 리뷰 후 병합

## 🌟 kbeauty.market 특화 기능

### 계획된 기능
1. **다국가 아마존 연동**: 미국, 일본, 독일, 영국 등 아마존 마켓플레이스 연동
2. **한국 화장품 카테고리**: K-뷰티 특화 상품 분류
3. **다국어 지원**: 한국어, 영어, 일본어, 중국어 등
4. **환율 연동**: 실시간 환율 정보 제공
5. **배송 추적**: 국제 배송 추적 시스템
6. **리뷰 시스템**: 다국가 리뷰 통합 관리

### 개발 우선순위
1. 기본 e-commerce 기능 구현
2. 아마존 API 연동 모듈 개발
3. 다국어 지원 시스템 구축
4. 결제 시스템 연동
5. 배송 및 물류 관리 시스템

## 📞 지원

문제가 발생하거나 질문이 있으시면:
1. GitHub Issues에 문제 등록
2. 개발팀에 직접 연락
3. Medusa.js 공식 문서 참조: https://docs.medusajs.com

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 