# 🌸 kbeauty.market - 한국 화장품 글로벌 마켓플레이스

kbeauty.market은 Medusa.js v2를 기반으로 한국 화장품을 세계 각국의 아마존을 통해 판매자와 소비자를 연결하는 플랫폼입니다.

## 🚀 빠른 시작

### 1. 포크 및 클론
```bash
# 1. GitHub에서 ComBba/medusa를 본인 계정으로 포크
# 2. 포크된 저장소를 클론
git clone https://github.com/YOUR_USERNAME/medusa.git
cd medusa

# 3. 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/ComBba/medusa.git

# 4. kbeauty 브랜치로 체크아웃
git checkout kbeauty/main
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
# 빠른 시작 스크립트 실행 (권장)
./scripts/quick-start.sh

# 또는 수동 설정
./scripts/setup-nginx.sh    # Nginx 설정 (포트 포워딩)
./scripts/setup-hosts.sh    # Hosts 파일 설정 (도메인 매핑)

# 데이터베이스 마이그레이션 및 시드
./scripts/kbeauty-db.sh migrate
./scripts/kbeauty-db.sh seed
./scripts/kbeauty-db.sh create-admin
```

### 4. 개발 서버 실행
```bash
# 전체 개발 환경 실행 (권장)
./scripts/kbeauty-manager.sh start-all

# 또는 개별 실행
yarn kbeauty:backend        # 백엔드 서버 (포트 9000)
yarn kbeauty:storefront     # 스토어프론트 (포트 8000)
yarn kbeauty:admin          # 관리자 패널 (Medusa v2에 내장)
```

## 🌐 서비스 URL

### 개발 환경
- **메인 스토어**: http://localhost:8000 (kbeauty-app-storefront)
- **API 서버**: http://localhost:9000 (kbeauty-app)
- **관리자 패널**: http://localhost:9000/app (Medusa v2 내장)
- **데이터베이스 관리**: http://localhost:10008 (Adminer)
- **파일 저장소**: http://localhost:10009 (MinIO)

### 포트 정보
- **kbeauty-app**: 9000 (Medusa v2 백엔드 + 관리자)
- **kbeauty-app-storefront**: 8000 (Next.js 스토어프론트)
- **PostgreSQL**: 10002
- **Redis**: 10003
- **Adminer**: 10008
- **MinIO API**: 10009
- **MinIO Console**: 10010

## 🏗️ 프로젝트 구조

```
.
├── kbeauty-app/              # Medusa v2 백엔드 애플리케이션
│   ├── src/
│   │   ├── api/              # REST API 라우트
│   │   ├── workflows/        # 비즈니스 로직 워크플로우
│   │   ├── modules/          # 커스텀 모듈
│   │   ├── subscribers/      # 이벤트 구독자
│   │   └── scripts/          # 데이터베이스 시드 스크립트
│   ├── medusa-config.ts      # Medusa 설정
│   └── package.json
│
├── kbeauty-app-storefront/   # Next.js 스토어프론트 애플리케이션
│   ├── src/
│   │   ├── app/              # Next.js 13+ App Router
│   │   ├── components/       # React 컴포넌트
│   │   ├── lib/              # 유틸리티 및 설정
│   │   └── styles/           # 스타일 파일
│   ├── public/               # 정적 파일
│   ├── next.config.js        # Next.js 설정 (빌드 시간 시스템 정보 포함)
│   └── package.json
│
├── scripts/                  # 개발 및 배포 스크립트
│   ├── kbeauty-manager.sh    # 메인 관리 스크립트 (CI/CD 포함)
│   ├── kbeauty-db.sh         # 데이터베이스 관리 스크립트
│   ├── kbeauty-aliases.sh    # 개발 도구 별칭
│   ├── quick-start.sh        # 빠른 시작 스크립트
│   ├── setup-nginx.sh        # Nginx 설정 스크립트
│   ├── setup-hosts.sh        # Hosts 파일 설정 스크립트
│   └── deploy.sh             # 배포 스크립트
│
├── .github/
│   └── workflows/
│       └── deploy-kbeauty.yml # GitHub Actions 자동 배포 워크플로우
│
├── docker-compose.yml        # Docker 서비스 정의
├── medusa-config.js          # 루트 Medusa 설정 (레거시)
├── kbeauty.env.example       # 환경 변수 템플릿
├── nginx/                    # Nginx 설정 파일
├── packages/                 # 원본 Medusa.js 패키지들 (레거시)
└── README.kbeauty.md         # 이 파일
```

## 🛠️ 개발 가이드

### 주요 명령어

#### 🚀 빠른 시작
```bash
# 전체 개발 환경 빠른 시작
./scripts/quick-start.sh

# 메인 관리 스크립트 사용 (추천)
./scripts/kbeauty-manager.sh [command]

# 서비스 관리
./scripts/kbeauty-manager.sh start-all      # 모든 서비스 시작
./scripts/kbeauty-manager.sh stop-all       # 모든 서비스 중지
./scripts/kbeauty-manager.sh restart-all    # 모든 서비스 재시작
./scripts/kbeauty-manager.sh status         # 서비스 상태 확인
```

#### 🛠️ 개별 서비스 관리
```bash
# 백엔드 서비스
./scripts/kbeauty-manager.sh start-backend  # kbeauty-app 시작
./scripts/kbeauty-manager.sh stop-backend   # kbeauty-app 중지

# 프론트엔드 서비스  
./scripts/kbeauty-manager.sh start-frontend # kbeauty-app-storefront 시작
./scripts/kbeauty-manager.sh stop-frontend  # kbeauty-app-storefront 중지

# Docker 서비스
./scripts/kbeauty-manager.sh start-docker   # PostgreSQL, Redis, MinIO 등 시작
./scripts/kbeauty-manager.sh stop-docker    # Docker 서비스 중지
```

#### 🗄️ 데이터베이스 관리
```bash
# 데이터베이스 관리 스크립트
./scripts/kbeauty-db.sh [command]

# 자주 사용하는 명령어
./scripts/kbeauty-db.sh migrate         # 마이그레이션 실행
./scripts/kbeauty-db.sh seed             # 시드 데이터 삽입
./scripts/kbeauty-db.sh create-admin     # 관리자 계정 생성
./scripts/kbeauty-db.sh backup           # 데이터베이스 백업
./scripts/kbeauty-db.sh connect          # 데이터베이스 연결
```

#### 🚀 CI/CD 관리
```bash
# CI/CD 시스템 관리
./scripts/kbeauty-manager.sh cicd          # CI/CD 상태 확인
./scripts/kbeauty-manager.sh deploy        # 수동 배포 실행
./scripts/kbeauty-manager.sh deploy-logs   # 배포 로그 확인
./scripts/kbeauty-manager.sh git-status    # Git 상태 확인
```

#### 🔧 개발 도구 별칭
```bash
# 별칭 로드 (터미널에서 한 번만 실행)
source scripts/kbeauty-aliases.sh

# 사용 가능한 별칭들
kstart-all      # 모든 서비스 시작
kstop-all       # 모든 서비스 중지  
kstatus         # 상태 확인
kdev            # 개발 환경 빠른 시작
khelp           # 도움말 확인
```

### 백엔드 개발 (kbeauty-app)
- **기반**: Medusa.js v2
- **포트**: 9000
- **설정**: `kbeauty-app/medusa-config.ts`
- **API 문서**: http://localhost:9000/docs
- **관리자 패널**: http://localhost:9000/app

### 프론트엔드 개발 (kbeauty-app-storefront)
- **기반**: Next.js 14 + App Router
- **포트**: 8000
- **설정**: `kbeauty-app-storefront/next.config.js`
- **스타일링**: Tailwind CSS + @medusajs/ui
- **상태 관리**: Zustand

## 🌟 구현 완료된 기능

### ✅ 시스템 정보 표시
- **Footer 시스템 정보**: 커밋 해시, 브랜치, 배포 시간 (KST)
- **Hero 섹션 배지**: 현재 버전 정보 표시
- **시스템 정보 팝업**: 상세한 시스템 정보 (⚙️ 버튼)
- **GitHub 링크**: 커밋 및 브랜치로 직접 이동 가능

### ✅ CI/CD 자동 배포 시스템
- **GitHub Actions**: kbeauty/main 브랜치 푸시 시 자동 배포
- **SSH 배포**: 포트 17141을 통한 안전한 SSH 연결
- **워크플로우 최적화**: 불필요한 원본 Medusa 워크플로우 제거
- **배포 상태 모니터링**: 배포 로그 및 상태 확인 가능

### ✅ 개발 환경 도구
- **관리 스크립트**: 통합된 서비스 관리
- **데이터베이스 도구**: 백업, 복원, 마이그레이션 자동화
- **개발 별칭**: 빠른 명령어 접근
- **빠른 시작**: 원클릭 개발 환경 설정

### ✅ 인프라 설정
- **Docker 컨테이너**: PostgreSQL, Redis, MinIO, Adminer
- **포트 관리**: 충돌 없는 포트 배정
- **환경 변수**: 개발/프로덕션 환경 분리
- **Nginx 프록시**: 도메인 기반 라우팅 (선택사항)

## 🐳 Docker 서비스

### 서비스 관리
```bash
# 모든 서비스 시작
./scripts/kbeauty-manager.sh start-docker

# 모든 서비스 중지
./scripts/kbeauty-manager.sh stop-docker

# 로그 확인
docker-compose logs -f [service_name]

# 특정 서비스만 실행
docker-compose up -d postgres redis
```

### 포함된 서비스
- **PostgreSQL**: 메인 데이터베이스 (포트 10002)
- **Redis**: 캐시 및 세션 스토어 (포트 10003)
- **Adminer**: 데이터베이스 관리 도구 (포트 10008)
- **MinIO**: S3 호환 파일 저장소 (API: 10009, Console: 10010)

## 🌟 kbeauty.market 특화 기능

### 계획된 기능
1. **다국가 아마존 연동**: 미국, 일본, 독일, 영국 등 아마존 마켓플레이스 연동
2. **한국 화장품 카테고리**: K-뷰티 특화 상품 분류 및 필터링
3. **다국어 지원**: 한국어, 영어, 일본어, 중국어 등 다국어 인터페이스
4. **환율 연동**: 실시간 환율 정보 제공 및 가격 변환
5. **배송 추적**: 국제 배송 추적 시스템 및 알림
6. **리뷰 시스템**: 다국가 리뷰 통합 관리 및 번역

### 개발 우선순위
1. ✅ 기본 e-commerce 기능 구현 (Medusa v2 기반)
2. ✅ CI/CD 자동 배포 시스템 구축
3. ✅ 시스템 정보 및 모니터링 기능
4. 🔄 아마존 API 연동 모듈 개발 (진행 중)
5. 📋 다국어 지원 시스템 구축
6. 📋 결제 시스템 연동 (Stripe, PayPal 등)
7. 📋 배송 및 물류 관리 시스템

### 협업 가이드
1. **브랜치 전략**: `kbeauty/main` > `kbeauty/develop` > `kbeauty/feature/기능명`
2. **코드 스타일**: ESLint + Prettier 설정 준수
3. **커밋 메시지**: 한국어 또는 영어 일관성 유지
4. **PR 리뷰**: 모든 변경사항은 코드 리뷰 후 병합
5. **자동 배포**: kbeauty/main 브랜치 푸시 시 자동 배포

## 📞 지원

문제가 발생하거나 질문이 있으시면:
1. GitHub Issues에 문제 등록: https://github.com/ComBba/medusa/issues
2. 개발팀에 직접 연락
3. Medusa.js v2 공식 문서 참조: https://v2-docs.medusajs.com

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

## 🚀 CI/CD 자동 배포 시스템 설정 완료!

✅ **GitHub Actions 워크플로우 설정 완료**  
✅ **SSH 키 배포 스크립트 설정 완료** (포트 17141)  
✅ **GitHub Secrets (DEPLOY_SSH_KEY) 설정 완료**  
✅ **불필요한 워크플로우 파일 정리 완료** (18개 파일 삭제)  
✅ **자동 배포 시스템 활성화됨!**

kbeauty/main 브랜치에 push하면 자동으로 서버에 배포됩니다! 🎉  
서비스 URL: https://kbeauty.market

### 최신 업데이트 (2025.07.16)
- ✅ 시스템 정보 표시 기능 구현 (커밋 정보, GitHub 링크, KST 시간)
- ✅ GitHub Actions 워크플로우 최적화 (kbeauty 전용)
- ✅ SSH 연결 포트 17141 설정 및 배포 안정화
- ✅ 프로젝트 구조 정리 및 문서화 완료
