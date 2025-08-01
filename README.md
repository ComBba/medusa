# 🌸 kbeauty.market

**한국 화장품 전문 글로벌 마켓플레이스**

[![Medusa](https://img.shields.io/badge/Built%20with-Medusa-blueviolet)](https://medusajs.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue)](https://docker.com)

> 🇰🇷 한국의 뷰티 브랜드와 전 세계 고객을 연결하는 글로벌 Amazon 마켓플레이스 플랫폼

## 📋 프로젝트 개요

kbeauty.market은 Medusa.js 기반의 한국 화장품 전문 마켓플레이스입니다. 한국의 K-뷰티 브랜드와 전 세계 고객들을 아마존 마켓플레이스를 통해 연결하는 플랫폼으로, 판매자와 소비자 모두에게 최적화된 경험을 제공합니다.

### 🎯 주요 특징

- **🌍 글로벌 마켓플레이스**: 10개국 Amazon 마켓플레이스 연동 (미국, 일본, 독일, 영국, 프랑스, 이탈리아, 스페인, 캐나다, 호주, 한국)
- **🎨 K-뷰티 특화**: 스킨케어, 메이크업, 헤어케어, 바디케어, 뷰티 도구 전문 카테고리
- **📦 통합 관리**: 재고, 주문, 배송을 하나의 플랫폼에서 관리
- **🔧 완전 커스터마이징**: Medusa.js 기반의 확장 가능한 아키텍처
- **👥 팀 협업**: 프론트엔드/백엔드 분리 개발 환경

## 🚀 빠른 시작

### 전제 조건

- Node.js 18 이상
- Docker & Docker Compose
- Yarn 패키지 매니저
- Git

### 1. 저장소 클론

```bash
git clone https://github.com/ComBba/medusa.git
cd medusa
git checkout kbeauty/initial-setup
```

### 2. 원클릭 설치

```bash
# 모든 종속성 설치 및 서비스 시작
./scripts/quick-start.sh
```

### 3. 개발 환경 설정

```bash
# 별칭 설정 (선택사항)
source ./scripts/kbeauty-aliases.sh

# 개발 환경 시작
kstart-all
# 또는
./scripts/kbeauty-manager.sh start all
```

## 🛠️ 개발 환경 구성

### 서비스 아키텍처

```
📦 kbeauty.market
├── 🌐 프론트엔드 (Next.js)     → http://kbeauty.market:10004
├── 🔧 백엔드 API (Medusa)      → http://api.kbeauty.market
├── 👨‍💼 관리자 패널               → http://admin.kbeauty.market:10001
├── 🗄️ PostgreSQL              → localhost:10002
├── 🚀 Redis                    → localhost:10003
├── 🗂️ MinIO (S3 호환)          → http://s3.kbeauty.market:10009
└── 🔍 Adminer (DB 관리)        → http://db.kbeauty.market:10008
```

### 포트 할당

| 서비스 | 포트 | 도메인 | 설명 |
|--------|------|---------|------|
| Backend API | 10000 | api.kbeauty.market | Medusa API 서버 |
| Admin Panel | 10001 | admin.kbeauty.market | 관리자 대시보드 |
| PostgreSQL | 10002 | - | 메인 데이터베이스 |
| Redis | 10003 | - | 캐시 및 세션 스토어 |
| Storefront | 10004 | kbeauty.market | 고객용 웹사이트 |
| Adminer | 10008 | db.kbeauty.market | DB 관리 도구 |
| MinIO API | 10009 | s3.kbeauty.market | 파일 스토리지 |
| MinIO Console | 10010 | storage.kbeauty.market | 스토리지 관리 |

## 🎮 관리 스크립트

### 🚀 서비스 매니저 (`./scripts/kbeauty-manager.sh`)

```bash
# 모든 서비스 시작
./scripts/kbeauty-manager.sh start all

# 개별 서비스 제어
./scripts/kbeauty-manager.sh start backend
./scripts/kbeauty-manager.sh stop frontend
./scripts/kbeauty-manager.sh restart docker

# 상태 확인
./scripts/kbeauty-manager.sh status
./scripts/kbeauty-manager.sh logs backend
./scripts/kbeauty-manager.sh monitor

# 개발 환경 초기화
./scripts/kbeauty-manager.sh reset
```

### 🗄️ 데이터베이스 매니저 (`./scripts/kbeauty-db.sh`)

```bash
# 마이그레이션 실행
./scripts/kbeauty-db.sh migrate

# 관리자 계정 생성
./scripts/kbeauty-db.sh create-admin

# 백업 & 복원
./scripts/kbeauty-db.sh backup
./scripts/kbeauty-db.sh restore

# 데이터베이스 상태 확인
./scripts/kbeauty-db.sh status
./scripts/kbeauty-db.sh connect
```

### ⚡ 빠른 별칭 (`./scripts/kbeauty-aliases.sh`)

```bash
# 별칭 활성화
source ./scripts/kbeauty-aliases.sh

# 사용 가능한 별칭
kstart-all        # 모든 서비스 시작
kstop-all         # 모든 서비스 중지
kstatus           # 상태 확인
kclean            # 환경 정리
khelp             # 도움말

# 디렉토리 이동
cdkb              # 프로젝트 루트로 이동
cdback            # 백엔드 디렉토리로 이동
cdfront           # 프론트엔드 디렉토리로 이동
```

## 📦 npm 스크립트

```bash
# 서비스 관리
npm run kbeauty:start          # 모든 서비스 시작
npm run kbeauty:stop           # 모든 서비스 중지
npm run kbeauty:status         # 상태 확인
npm run kbeauty:logs           # 로그 보기

# 개발 환경
npm run kbeauty:dev            # 개발 모드 시작
npm run kbeauty:build          # 프로덕션 빌드
npm run kbeauty:reset          # 환경 초기화

# 데이터베이스
npm run kbeauty:db-migrate     # 마이그레이션
npm run kbeauty:db-backup      # 백업
npm run kbeauty:db-restore     # 복원
npm run kbeauty:create-admin   # 관리자 계정 생성
```

## 🌍 K-뷰티 설정

### 지원 마켓플레이스

- 🇺🇸 **Amazon US** (amazon.com)
- 🇯🇵 **Amazon Japan** (amazon.co.jp)
- 🇩🇪 **Amazon Germany** (amazon.de)
- 🇬🇧 **Amazon UK** (amazon.co.uk)
- 🇫🇷 **Amazon France** (amazon.fr)
- 🇮🇹 **Amazon Italy** (amazon.it)
- 🇪🇸 **Amazon Spain** (amazon.es)
- 🇨🇦 **Amazon Canada** (amazon.ca)
- 🇦🇺 **Amazon Australia** (amazon.com.au)
- 🇰🇷 **Amazon Korea** (amazon.co.kr)

### 제품 카테고리

- **🧴 스킨케어**: 토너, 세럼, 크림, 마스크, 클렌저
- **💄 메이크업**: 파운데이션, 립스틱, 아이섀도, 마스카라
- **💆 헤어케어**: 샴푸, 컨디셔너, 헤어 마스크, 스타일링
- **🛁 바디케어**: 바디 로션, 스크럽, 오일, 비누
- **🔧 뷰티 도구**: 브러시, 스펀지, 마사지 도구, 액세서리

### 주요 브랜드

설정 파일 `src/kbeauty/config/countries.js`에서 50개 이상의 한국 뷰티 브랜드를 지원합니다.

## 🏗️ 프로젝트 구조

```
📁 kbeauty.market/
├── 📁 kbeauty-app/                 # 백엔드 (Medusa)
│   ├── 📄 medusa-config.js         # Medusa 설정
│   ├── 📄 package.json
│   └── 📁 src/
├── 📁 kbeauty-app-storefront/      # 프론트엔드 (Next.js)
│   ├── 📄 next.config.js
│   ├── 📄 package.json
│   └── 📁 src/
├── 📁 src/kbeauty/config/          # K-뷰티 설정
│   └── 📄 countries.js             # 국가별 마켓플레이스 설정
├── 📁 scripts/                     # 관리 스크립트
│   ├── 📄 kbeauty-manager.sh       # 서비스 매니저
│   ├── 📄 kbeauty-db.sh            # DB 매니저
│   ├── 📄 kbeauty-aliases.sh       # 별칭
│   └── 📄 quick-start.sh           # 빠른 시작
├── 📁 nginx/                       # Nginx 설정
│   └── 📄 kbeauty.market.conf
├── 📄 docker-compose.yml           # Docker 서비스
├── 📄 kbeauty.env.example          # 환경 변수 예시
└── 📄 README.kbeauty.md            # 상세 가이드
```

## 👥 팀 협업

### 브랜치 전략

- `main`: 프로덕션 배포 브랜치
- `develop`: 개발 통합 브랜치
- `kbeauty/initial-setup`: 초기 설정 브랜치 (현재)
- `feature/*`: 기능 개발 브랜치
- `hotfix/*`: 긴급 수정 브랜치

### 개발 워크플로우

```bash
# 1. 기능 브랜치 생성
git checkout -b feature/new-feature

# 2. 개발 환경 시작
kstart-all

# 3. 개발 작업
# ... 코드 작성 ...

# 4. 테스트
npm run test

# 5. 빌드 확인
npm run build

# 6. 커밋 및 푸시
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin feature/new-feature
```

## 🔧 환경 설정

### 필수 환경 변수

```bash
# .env 파일 생성
cp kbeauty.env.example .env

# 주요 설정
DATABASE_URL=postgresql://medusa:medusa@localhost:10002/medusa
REDIS_URL=redis://localhost:10003
MINIO_ENDPOINT=localhost:10009
ADMIN_CORS=http://admin.kbeauty.market:10001
STORE_CORS=http://kbeauty.market:10004
```

### Docker 설정

```yaml
# docker-compose.yml에서 제공하는 서비스:
- PostgreSQL (데이터베이스)
- Redis (캐시)
- MinIO (파일 스토리지)
- Adminer (DB 관리)
```

## 🐛 문제 해결

### 일반적인 문제

1. **포트 충돌 시:**
   ```bash
   # 포트 사용 중인 프로세스 확인
   lsof -i :10000
   # 또는
   ./scripts/kbeauty-manager.sh monitor
   ```

2. **Docker 서비스 오류:**
   ```bash
   # Docker 서비스 재시작
   docker-compose down && docker-compose up -d
   ```

3. **데이터베이스 연결 실패:**
   ```bash
   # DB 상태 확인
   ./scripts/kbeauty-db.sh status
   ```

4. **환경 완전 초기화:**
   ```bash
   ./scripts/kbeauty-manager.sh reset
   ```

## 📖 추가 문서

- **[📘 상세 가이드](README.kbeauty.md)**: 완전한 개발 가이드
- **[📖 Medusa 문서](https://docs.medusajs.com)**: 공식 Medusa 문서
- **[🛠️ API 참조](http://api.kbeauty.market/docs)**: API 문서

## 🤝 기여하기

1. Fork 저장소
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🆘 지원

- **Issues**: [GitHub Issues](https://github.com/ComBba/medusa/issues)
- **Email**: support@kbeauty.market
- **Discord**: [Medusa Discord](https://discord.gg/medusajs)

---

<p align="center">
  <strong>🌸 Made with ❤️ for K-Beauty 🌸</strong>
</p>

<p align="center">
  <a href="https://kbeauty.market">kbeauty.market</a> • 
  <a href="https://github.com/ComBba/medusa">GitHub</a> • 
  <a href="https://medusajs.com">Medusa</a>
</p>
