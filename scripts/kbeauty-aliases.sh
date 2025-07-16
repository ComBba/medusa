#!/bin/bash

# kbeauty.market 개발 별칭 스크립트
# 사용법: source scripts/kbeauty-aliases.sh

# 색상 정의
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🌸 kbeauty.market 개발 별칭을 로드합니다...${NC}"

# 기본 경로
export KBEAUTY_ROOT="/home/barahime/github/medusa"
export KBEAUTY_BACKEND="$KBEAUTY_ROOT/kbeauty-app"
export KBEAUTY_STOREFRONT="$KBEAUTY_ROOT/kbeauty-app-storefront"

# 서비스 관리 별칭
alias kb='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh'
alias kstart='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh start'
alias kstop='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh stop'
alias krestart='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh restart'
alias kstatus='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh status'
alias klogs='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh logs'
alias khealth='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh health'
alias kports='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh ports'
alias kreset='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh reset'

# 개별 서비스 별칭
alias kstart-all='kb start all'
alias kstart-docker='kb start docker'
alias kstart-backend='kb start backend'
alias kstart-front='kb start storefront'

alias kstop-all='kb stop all'
alias kstop-docker='kb stop docker'
alias kstop-backend='kb stop backend'
alias kstop-front='kb stop storefront'

alias krestart-all='kb restart all'
alias krestart-backend='kb restart backend'
alias krestart-front='kb restart storefront'

# 로그 별칭
alias klog-backend='kb logs backend'
alias klog-front='kb logs storefront'
alias klog-docker='kb logs docker'

# 디렉토리 이동 별칭
alias cdkb='cd $KBEAUTY_ROOT'
alias cdback='cd $KBEAUTY_BACKEND'
alias cdfront='cd $KBEAUTY_STOREFRONT'

# Docker 관련 별칭
alias kdocker='cd $KBEAUTY_ROOT && sudo docker-compose'
alias kdb='sudo docker-compose exec postgres psql -U medusa -d kbeauty_market'
alias kredis='sudo docker-compose exec redis redis-cli'

# 개발 도구 별칭
alias kbuild='cd $KBEAUTY_BACKEND && yarn build'
alias ktest='cd $KBEAUTY_BACKEND && yarn test'
alias klint='cd $KBEAUTY_BACKEND && yarn lint'

# URL 단축 별칭
alias kurl-admin='echo "http://admin.kbeauty.market"'
alias kurl-api='echo "http://api.kbeauty.market"'
alias kurl-store='echo "http://kbeauty.market"'
alias kurl-db='echo "http://db.kbeauty.market"'
alias kurl-storage='echo "http://storage.kbeauty.market"'

# 유틸리티 함수들
khelp() {
    echo -e "${CYAN}🌸 kbeauty.market 개발 별칭 도움말${NC}"
    echo ""
    echo -e "${GREEN}서비스 관리:${NC}"
    echo "  kb [command] [service]  - 메인 관리 명령어"
    echo "  kstart/kstop/krestart   - 서비스 시작/중지/재시작"
    echo "  kstatus                 - 서비스 상태 확인"
    echo "  klogs [service]         - 로그 확인"
    echo "  khealth                 - 헬스 체크"
    echo "  kports                  - 포트 확인"
    echo ""
    echo -e "${GREEN}개별 서비스:${NC}"
    echo "  kstart-all/backend/front/docker"
    echo "  kstop-all/backend/front/docker"
    echo "  krestart-all/backend/front"
    echo ""
    echo -e "${GREEN}디렉토리 이동:${NC}"
    echo "  cdkb    - kbeauty 루트로 이동"
    echo "  cdback  - 백엔드 디렉토리로 이동"
    echo "  cdfront - 스토어프론트 디렉토리로 이동"
    echo ""
    echo -e "${GREEN}개발 도구:${NC}"
    echo "  kbuild  - 백엔드 빌드"
    echo "  ktest   - 테스트 실행"
    echo "  klint   - 린트 실행"
    echo "  kdb     - PostgreSQL 접속"
    echo "  kredis  - Redis CLI 접속"
    echo ""
    echo -e "${GREEN}URL 확인:${NC}"
    echo "  kurl-admin/api/store/db/storage - 서비스 URL 출력"
    echo ""
    echo -e "${PURPLE}🚀 CI/CD 관리:${NC}"
    echo "  kcicd        - CI/CD 시스템 상태 확인"
    echo "  kdeploy      - 수동 배포 실행"
    echo "  kdeploy-logs - 배포 로그 확인"
    echo "  kgit-status  - Git 상태 확인"
    echo "  kactions     - GitHub Actions 페이지 열기"
    echo ""
}

# 빠른 개발 환경 설정 함수
kdev() {
    echo -e "${CYAN}🚀 kbeauty.market 개발 환경 시작 중...${NC}"
    kstart-all
    echo ""
    echo -e "${GREEN}✅ 개발 환경이 시작되었습니다!${NC}"
    echo ""
    echo "📋 서비스 URL:"
    echo "  - 관리자: $(kurl-admin)"
    echo "  - API: $(kurl-api)" 
    echo "  - 스토어: $(kurl-store)"
    echo "  - DB: $(kurl-db)"
    echo "  - 저장소: $(kurl-storage)"
    echo ""
    echo "💡 유용한 명령어: kstatus, klogs, khelp"
}

# 개발 환경 정리 함수
kclean() {
    echo -e "${CYAN}🧹 kbeauty.market 개발 환경 정리 중...${NC}"
    kstop-all
    echo ""
    echo -e "${GREEN}✅ 모든 서비스가 중지되었습니다.${NC}"
}

# Git 관련 유틸리티
kgit() {
    case "$1" in
        "status"|"st")
            cd $KBEAUTY_ROOT && git status
            ;;
        "pull")
            cd $KBEAUTY_ROOT && git pull upstream develop
            ;;
        "push")
            cd $KBEAUTY_ROOT && git push origin $(git branch --show-current)
            ;;
        "branch"|"br")
            cd $KBEAUTY_ROOT && git branch -v
            ;;
        "log")
            cd $KBEAUTY_ROOT && git log --oneline -10
            ;;
        *)
            echo "사용법: kgit [status|pull|push|branch|log]"
            ;;
    esac
}

# 🚀 CI/CD 관련 별칭
alias kcicd='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh cicd'              # CI/CD 상태 확인
alias kdeploy='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh deploy'          # 수동 배포 실행
alias kdeploy-logs='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh deploy-logs' # 배포 로그 확인
alias kgit-status='$KBEAUTY_ROOT/scripts/kbeauty-manager.sh git-status'  # Git 상태 확인

# GitHub Actions 관련
kactions() {
    echo -e "${CYAN}🚀 GitHub Actions 페이지를 여는 중...${NC}"
    echo -e "🔗 https://github.com/ComBba/medusa/actions"
    if command -v xdg-open &> /dev/null; then
        xdg-open "https://github.com/ComBba/medusa/actions"
    elif command -v open &> /dev/null; then
        open "https://github.com/ComBba/medusa/actions"
    fi
}

echo -e "${GREEN}✅ kbeauty.market 별칭이 로드되었습니다!${NC}"
echo -e "💡 ${CYAN}khelp${NC} 명령어로 사용 가능한 별칭을 확인하세요."
echo -e "🚀 ${PURPLE}CI/CD 별칭${NC}: kcicd, kdeploy, kdeploy-logs, kgit-status, kactions" 