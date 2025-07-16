#!/bin/bash

# 🌸 KBeauty.Market 자동 배포 스크립트
# 사용법: ./scripts/deploy.sh [environment]

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

# 환경 변수 설정
ENVIRONMENT=${1:-production}
BACKUP_DIR="/home/barahime/backups/kbeauty-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/home/barahime/github/medusa/.logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# 로깅 함수
log() {
    echo -e "${PINK}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# 헤더 출력
echo -e "${PINK}"
cat << 'EOF'
╔════════════════════════════════════════════════════════════════════════╗
║                    🌸 KBeauty.Market 자동 배포                        ║
║                  한국 화장품 글로벌 마켓플레이스                       ║
╚════════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log "🚀 배포 시작 - 환경: $ENVIRONMENT"

# 현재 디렉토리 확인
if [ ! -f "package.json" ] || [ ! -d "kbeauty-app" ]; then
    error "잘못된 디렉토리입니다. medusa 프로젝트 루트에서 실행해주세요."
fi

# 1. 백업 생성
log "📦 현재 상태 백업 중..."
mkdir -p "$(dirname "$BACKUP_DIR")"
if [ -f ".logs/backend.log" ] && [ -f ".logs/storefront.log" ]; then
    cp -r ".logs" "$BACKUP_DIR/" || warning "로그 백업 실패"
    success "백업 완료: $BACKUP_DIR"
else
    warning "로그 파일이 없어 백업을 건너뜁니다."
fi

# 2. 서비스 상태 확인
log "🔍 현재 서비스 상태 확인 중..."
./scripts/kbeauty-manager.sh status || warning "일부 서비스가 실행되지 않고 있습니다."

# 3. Git 업데이트
log "🔄 소스 코드 업데이트 중..."
git fetch origin || error "Git fetch 실패"
git reset --hard origin/kbeauty/main || error "Git reset 실패"
success "소스 코드 업데이트 완료"

# 4. 의존성 업데이트
log "📦 의존성 업데이트 중..."
yarn install || error "의존성 설치 실패"
success "의존성 업데이트 완료"

# 5. 백엔드 빌드
log "🔨 백엔드 빌드 중..."
cd kbeauty-app
yarn build || error "백엔드 빌드 실패"
cd ..
success "백엔드 빌드 완료"

# 6. 스토어프론트 빌드
log "🔨 스토어프론트 빌드 중..."
cd kbeauty-app-storefront
yarn build || error "스토어프론트 빌드 실패"
cd ..
success "스토어프론트 빌드 완료"

# 7. 데이터베이스 마이그레이션
log "🗄️ 데이터베이스 마이그레이션 중..."
./scripts/kbeauty-db.sh migrate || warning "데이터베이스 마이그레이션 실패"

# 8. 서비스 재시작
log "🔄 서비스 재시작 중..."
./scripts/kbeauty-manager.sh restart all || error "서비스 재시작 실패"
success "서비스 재시작 완료"

# 9. 배포 후 확인
log "⏱️ 서비스 초기화 대기 중..."
sleep 15

log "🔍 배포 후 상태 확인 중..."
./scripts/kbeauty-manager.sh status

# 10. 연결 테스트
log "🌐 서비스 연결 테스트 중..."

# HTTPS 테스트
if curl -k -f -s https://kbeauty.market >/dev/null 2>&1; then
    success "메인 사이트 연결 성공: https://kbeauty.market"
else
    warning "메인 사이트 연결 실패"
fi

# API 테스트
if curl -k -f -s https://api.kbeauty.market >/dev/null 2>&1; then
    success "API 서버 연결 성공: https://api.kbeauty.market"
else
    warning "API 서버 연결 실패"
fi

# 데이터베이스 관리 도구 테스트
if curl -f -s https://db.kbeauty.market >/dev/null 2>&1; then
    success "데이터베이스 관리 도구 연결 성공: https://db.kbeauty.market"
else
    warning "데이터베이스 관리 도구 연결 실패"
fi

# 배포 완료
echo -e "${PINK}"
cat << EOF
╔════════════════════════════════════════════════════════════════════════╗
║                    🎉 CI/CD 자동 배포 완료!                            ║
║                                                                        ║
║  🌐 메인 사이트: https://kbeauty.market                                ║
║  🔧 API 서버: https://api.kbeauty.market                               ║
║  💾 데이터베이스: https://db.kbeauty.market                             ║
║  📁 파일 저장소: https://storage.kbeauty.market                         ║
║                                                                        ║
║  🚀 GitHub Actions: 자동 배포 시스템 운영 중                            ║
║  📊 배포 로그: $LOG_FILE                                               ║
║  📦 백업 위치: $BACKUP_DIR                                             ║
║                                                                        ║
║  🌸 kbeauty/main 브랜치 → 자동 배포 활성화됨!                          ║
╚════════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log "🎊 KBeauty.Market CI/CD 자동 배포가 성공적으로 완료되었습니다!"
log "🚀 GitHub Actions로 push-to-deploy 시스템 운영 중!"
log "🎯 Q4 2025 목표: 50개 K-Beauty 브랜드 연동을 향해!"

exit 0 