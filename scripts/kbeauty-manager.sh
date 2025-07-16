#!/bin/bash

# kbeauty.market 서비스 관리 스크립트
# 사용법: ./scripts/kbeauty-manager.sh [command] [service]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 프로젝트 경로 (스크립트 실행 위치 기준)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/kbeauty-app"
STOREFRONT_DIR="$PROJECT_ROOT/kbeauty-app-storefront"

# PID 파일 디렉토리
PID_DIR="$PROJECT_ROOT/.pids"
mkdir -p "$PID_DIR"

# 로그 파일 디렉토리
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

# 서비스 포트 정의 (현재 실제 사용 포트)
BACKEND_PORT=9000
STOREFRONT_PORT=8000
POSTGRES_PORT=10002
REDIS_PORT=10003
ADMINER_PORT=10008
MINIO_API_PORT=10009
MINIO_CONSOLE_PORT=10010

# 함수: 헤더 출력
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}                    🌸 kbeauty.market 서비스 관리자                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 함수: 사용법 출력
show_usage() {
    print_header
    echo -e "${WHITE}사용법:${NC}"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh ${YELLOW}[command] [service]${NC}"
    echo ""
    echo -e "${WHITE}명령어:${NC}"
    echo -e "  ${GREEN}start${NC}     - 서비스 시작"
    echo -e "  ${GREEN}stop${NC}      - 서비스 중지"
    echo -e "  ${GREEN}restart${NC}   - 서비스 재시작"
    echo -e "  ${GREEN}status${NC}    - 서비스 상태 확인"
    echo -e "  ${GREEN}logs${NC}      - 서비스 로그 확인"
    echo -e "  ${GREEN}health${NC}    - 서비스 헬스 체크"
    echo -e "  ${GREEN}reset${NC}     - 개발 환경 리셋"
    echo -e "  ${GREEN}ports${NC}     - 포트 사용 현황 확인"
    echo ""
    echo -e "${WHITE}CI/CD 명령어:${NC}"
    echo -e "  ${PURPLE}deploy${NC}    - 수동 배포 실행"
    echo -e "  ${PURPLE}cicd${NC}      - CI/CD 시스템 상태 확인"
    echo -e "  ${PURPLE}deploy-logs${NC} - 배포 로그 확인"
    echo -e "  ${PURPLE}git-status${NC}  - Git 상태 및 브랜치 확인"
    echo ""
    echo -e "${WHITE}서비스:${NC}"
    echo -e "  ${BLUE}all${NC}         - 모든 서비스"
    echo -e "  ${BLUE}docker${NC}      - Docker 서비스 (DB, Redis, MinIO 등)"
    echo -e "  ${BLUE}backend${NC}     - Medusa v2 백엔드 + 관리자 (포트 $BACKEND_PORT)"
    echo -e "  ${BLUE}storefront${NC}  - Next.js 스토어프론트 (포트 $STOREFRONT_PORT)"
    echo -e "  ${BLUE}postgres${NC}    - PostgreSQL (포트 $POSTGRES_PORT)"
    echo -e "  ${BLUE}redis${NC}       - Redis (포트 $REDIS_PORT)"
    echo -e "  ${BLUE}adminer${NC}     - Adminer (포트 $ADMINER_PORT)"
    echo -e "  ${BLUE}minio${NC}       - MinIO (포트 $MINIO_API_PORT, $MINIO_CONSOLE_PORT)"
    echo ""
    echo -e "${WHITE}예시:${NC}"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start all${NC}          # 모든 서비스 시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start-all${NC}          # 별칭: 모든 서비스 시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh restart backend${NC}    # 백엔드만 재시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh logs storefront${NC}    # 스토어프론트 로그 확인"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh status${NC}             # 전체 상태 확인"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh cicd${NC}               # CI/CD 시스템 상태"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh deploy${NC}             # 수동 배포 실행"
    echo ""
    echo -e "${WHITE}빠른 별칭:${NC}"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start-all${NC}          # 모든 서비스 시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh stop-all${NC}           # 모든 서비스 중지"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh restart-all${NC}        # 모든 서비스 재시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start-backend${NC}      # 백엔드만 시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start-frontend${NC}     # 스토어프론트만 시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start-docker${NC}       # Docker 서비스만 시작"
    echo ""
}

# 함수: 프로세스가 실행 중인지 확인
is_process_running() {
    local pid_file="$1"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# 함수: 포트가 사용 중인지 확인
is_port_in_use() {
    local port="$1"
    lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
}

# 함수: Docker 서비스 시작
start_docker() {
    echo -e "${YELLOW}🐳 Docker 서비스 시작 중...${NC}"
    cd "$PROJECT_ROOT"
    sudo docker-compose up -d
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Docker 서비스가 시작되었습니다.${NC}"
    else
        echo -e "${RED}❌ Docker 서비스 시작에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: Docker 서비스 중지
stop_docker() {
    echo -e "${YELLOW}🐳 Docker 서비스 중지 중...${NC}"
    cd "$PROJECT_ROOT"
    sudo docker-compose down
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Docker 서비스가 중지되었습니다.${NC}"
    else
        echo -e "${RED}❌ Docker 서비스 중지에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: 백엔드 서버 시작
start_backend() {
    local pid_file="$PID_DIR/backend.pid"
    local log_file="$LOG_DIR/backend.log"
    
    if is_process_running "$pid_file"; then
        echo -e "${YELLOW}⚠️  백엔드 서버가 이미 실행 중입니다.${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}🚀 백엔드 서버 시작 중...${NC}"
    
    if [[ ! -d "$BACKEND_DIR" ]]; then
        echo -e "${RED}❌ 백엔드 디렉토리를 찾을 수 없습니다: $BACKEND_DIR${NC}"
        return 1
    fi
    
    cd "$BACKEND_DIR"
    nohup yarn dev --port=$BACKEND_PORT > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    echo -e "${GREEN}✅ 백엔드 서버가 시작되었습니다 (PID: $pid, 포트: $BACKEND_PORT).${NC}"
    echo -e "${CYAN}   로그: tail -f $log_file${NC}"
}

# 함수: 스토어프론트 시작
start_storefront() {
    local pid_file="$PID_DIR/storefront.pid"
    local log_file="$LOG_DIR/storefront.log"
    
    if is_process_running "$pid_file"; then
        echo -e "${YELLOW}⚠️  스토어프론트가 이미 실행 중입니다.${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}🛍️  스토어프론트 시작 중...${NC}"
    
    if [[ ! -d "$STOREFRONT_DIR" ]]; then
        echo -e "${RED}❌ 스토어프론트 디렉토리를 찾을 수 없습니다: $STOREFRONT_DIR${NC}"
        return 1
    fi
    
    cd "$STOREFRONT_DIR"
    # Next.js dev 서버는 package.json에서 포트 설정됨 (-p 8000)
    nohup yarn dev > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    echo -e "${GREEN}✅ 스토어프론트가 시작되었습니다 (PID: $pid, 포트: $STOREFRONT_PORT).${NC}"
    echo -e "${CYAN}   로그: tail -f $log_file${NC}"
}

# 함수: 프로세스 중지
stop_process() {
    local service_name="$1"
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if is_process_running "$pid_file"; then
        local pid=$(cat "$pid_file")
        echo -e "${YELLOW}🛑 ${service_name} 중지 중... (PID: $pid)${NC}"
        kill $pid
        sleep 2
        
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}   강제 종료 중...${NC}"
            kill -9 $pid
        fi
        
        rm -f "$pid_file"
        echo -e "${GREEN}✅ ${service_name}가 중지되었습니다.${NC}"
    else
        echo -e "${YELLOW}⚠️  ${service_name}가 실행 중이 아닙니다.${NC}"
    fi
}

# 함수: 서비스 상태 확인
check_service_status() {
    local service_name="$1"
    local port="$2"
    local pid_file="$PID_DIR/${service_name}.pid"
    
    printf "%-12s " "$service_name:"
    
    if is_process_running "$pid_file"; then
        local pid=$(cat "$pid_file")
        if is_port_in_use "$port"; then
            # 추가적으로 HTTP 응답 확인 (storefront/backend의 경우)
            if [[ "$service_name" == "backend" ]]; then
                if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ 실행 중 (PID: $pid, 포트: $port, 응답: 정상)${NC}"
                else
                    echo -e "${YELLOW}⚠️  실행 중이나 API 응답 없음 (PID: $pid, 포트: $port)${NC}"
                fi
            elif [[ "$service_name" == "storefront" ]]; then
                if curl -s "http://localhost:$port" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ 실행 중 (PID: $pid, 포트: $port, 응답: 정상)${NC}"
                else
                    echo -e "${YELLOW}⚠️  시작 중... (PID: $pid, 포트: $port, 준비 대기)${NC}"
                fi
            else
                echo -e "${GREEN}✅ 실행 중 (PID: $pid, 포트: $port)${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  프로세스 실행 중이지만 포트 연결 안됨 (PID: $pid)${NC}"
        fi
    else
        if is_port_in_use "$port"; then
            echo -e "${YELLOW}⚠️  다른 프로세스가 포트 사용 중 (포트: $port)${NC}"
        else
            echo -e "${RED}❌ 중지됨${NC}"
        fi
    fi
}

# 함수: Docker 컨테이너 상태 확인
check_docker_status() {
    echo -e "\n${WHITE}Docker 서비스 상태:${NC}"
    sudo docker-compose ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}"
}

# 함수: 헬스 체크
health_check() {
    echo -e "${CYAN}🏥 헬스 체크 진행 중...${NC}\n"
    
    # 백엔드 헬스 체크
    echo -n "백엔드 API: "
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 정상${NC}"
    else
        echo -e "${RED}❌ 응답 없음${NC}"
    fi
    
    # 스토어프론트 헬스 체크
    echo -n "스토어프론트: "
    if curl -s http://localhost:$STOREFRONT_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 정상${NC}"
    else
        echo -e "${RED}❌ 응답 없음${NC}"
    fi
    
    # 데이터베이스 연결 체크
    echo -n "PostgreSQL: "
    if nc -z localhost $POSTGRES_PORT 2>/dev/null; then
        echo -e "${GREEN}✅ 연결 가능${NC}"
    else
        echo -e "${RED}❌ 연결 불가${NC}"
    fi
    
    # Redis 연결 체크
    echo -n "Redis: "
    if nc -z localhost $REDIS_PORT 2>/dev/null; then
        echo -e "${GREEN}✅ 연결 가능${NC}"
    else
        echo -e "${RED}❌ 연결 불가${NC}"
    fi
}

# 함수: 포트 사용 현황 확인
check_ports() {
    echo -e "${CYAN}🔌 포트 사용 현황:${NC}\n"
    
    local ports=($BACKEND_PORT $STOREFRONT_PORT $POSTGRES_PORT $REDIS_PORT $ADMINER_PORT $MINIO_API_PORT $MINIO_CONSOLE_PORT)
    local names=("Backend" "Storefront" "PostgreSQL" "Redis" "Adminer" "MinIO-API" "MinIO-Console")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local name=${names[$i]}
        printf "%-12s (포트 %5d): " "$name" "$port"
        
        if is_port_in_use "$port"; then
            local pid=$(lsof -ti:$port 2>/dev/null | head -1)
            echo -e "${GREEN}✅ 사용 중 (PID: $pid)${NC}"
        else
            echo -e "${RED}❌ 사용 안함${NC}"
        fi
    done
}

# 함수: 로그 확인
show_logs() {
    local service="$1"
    local log_file="$LOG_DIR/${service}.log"
    
    if [[ "$service" == "docker" ]]; then
        echo -e "${CYAN}🐳 Docker 서비스 로그:${NC}"
        sudo docker-compose logs -f --tail=50
        return
    fi
    
    if [[ -f "$log_file" ]]; then
        echo -e "${CYAN}📋 ${service} 로그 (마지막 50줄):${NC}"
        tail -f "$log_file"
    else
        echo -e "${RED}❌ 로그 파일을 찾을 수 없습니다: $log_file${NC}"
    fi
}

# 함수: 개발 환경 리셋
reset_environment() {
    echo -e "${YELLOW}🔄 개발 환경 리셋 중...${NC}"
    
    # 모든 서비스 중지
    stop_process "backend"
    stop_process "storefront"
    stop_docker
    
    # PID 및 로그 파일 정리
    echo -e "${YELLOW}🧹 임시 파일 정리 중...${NC}"
    rm -rf "$PID_DIR"/*
    rm -rf "$LOG_DIR"/*
    
    # Docker 볼륨 및 네트워크 정리 (선택적)
    read -p "Docker 볼륨도 삭제하시겠습니까? (데이터베이스 데이터가 삭제됩니다) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️  Docker 볼륨 삭제 중...${NC}"
        sudo docker-compose down -v
    fi
    
    echo -e "${GREEN}✅ 개발 환경 리셋이 완료되었습니다.${NC}"
}

# 함수: 수동 배포 실행
run_manual_deploy() {
    echo -e "${PURPLE}🚀 수동 배포를 실행합니다...${NC}"
    
    # 배포 스크립트 존재 확인
    if [[ ! -f "$PROJECT_ROOT/scripts/deploy.sh" ]]; then
        echo -e "${RED}❌ 배포 스크립트를 찾을 수 없습니다: $PROJECT_ROOT/scripts/deploy.sh${NC}"
        return 1
    fi
    
    # 현재 브랜치 확인
    local current_branch=$(git -C "$PROJECT_ROOT" branch --show-current)
    echo -e "${CYAN}📍 현재 브랜치: $current_branch${NC}"
    
    if [[ "$current_branch" != "kbeauty/main" ]]; then
        echo -e "${YELLOW}⚠️  권장: kbeauty/main 브랜치에서 배포하세요${NC}"
        echo -e "${YELLOW}   현재 브랜치에서 계속하시겠습니까? (y/N)${NC}"
        read -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${CYAN}💡 브랜치 변경: git checkout kbeauty/main${NC}"
            return 0
        fi
    fi
    
    # 배포 실행
    echo -e "${PURPLE}🚀 배포 스크립트 실행 중...${NC}"
    "$PROJECT_ROOT/scripts/deploy.sh" production
}

# 함수: CI/CD 시스템 상태 확인
check_cicd_status() {
    echo -e "${PURPLE}🔍 CI/CD 시스템 상태를 확인합니다...${NC}"
    echo ""
    
    # GitHub Actions 상태
    echo -e "${WHITE}📊 GitHub Actions 정보:${NC}"
    echo -e "  Repository: ${CYAN}ComBba/medusa${NC}"
    echo -e "  Workflow: ${CYAN}🌸 Deploy KBeauty.Market${NC}"
    echo -e "  URL: ${CYAN}https://github.com/ComBba/medusa/actions${NC}"
    echo ""
    
    # Git 브랜치 정보
    echo -e "${WHITE}🌿 Git 브랜치 정보:${NC}"
    local current_branch=$(git -C "$PROJECT_ROOT" branch --show-current)
    local last_commit=$(git -C "$PROJECT_ROOT" log --oneline -1)
    echo -e "  현재 브랜치: ${GREEN}$current_branch${NC}"
    echo -e "  최신 커밋: ${CYAN}$last_commit${NC}"
    echo ""
    
    # 배포 스크립트 상태
    echo -e "${WHITE}📋 배포 시스템 상태:${NC}"
    if [[ -f "$PROJECT_ROOT/scripts/deploy.sh" ]]; then
        echo -e "  배포 스크립트: ${GREEN}✅ 사용 가능${NC}"
    else
        echo -e "  배포 스크립트: ${RED}❌ 없음${NC}"
    fi
    
    if [[ -f "$PROJECT_ROOT/.github/workflows/deploy-kbeauty.yml" ]]; then
        echo -e "  GitHub Actions: ${GREEN}✅ 설정됨${NC}"
    else
        echo -e "  GitHub Actions: ${RED}❌ 설정 안됨${NC}"
    fi
    
    # SSH 키 확인
    if [[ -f "$HOME/.ssh/kbeauty_deploy" ]]; then
        echo -e "  SSH 키: ${GREEN}✅ 설정됨${NC}"
    else
        echo -e "  SSH 키: ${YELLOW}⚠️  확인 필요${NC}"
    fi
    echo ""
    
    # 서비스 상태
    echo -e "${WHITE}🌐 서비스 상태:${NC}"
    curl -s -k -o /dev/null -w "  메인 사이트: %{http_code} (https://kbeauty.market)\n" "https://kbeauty.market" || echo -e "  메인 사이트: ${RED}❌ 연결 실패${NC}"
    curl -s -k -o /dev/null -w "  API 서버: %{http_code} (https://api.kbeauty.market)\n" "https://api.kbeauty.market/health" || echo -e "  API 서버: ${RED}❌ 연결 실패${NC}"
    echo ""
}

# 함수: 배포 로그 확인
show_deploy_logs() {
    echo -e "${PURPLE}📋 배포 로그를 확인합니다...${NC}"
    
    local log_dir="$PROJECT_ROOT/.logs"
    
    if [[ ! -d "$log_dir" ]]; then
        echo -e "${RED}❌ 로그 디렉토리를 찾을 수 없습니다: $log_dir${NC}"
        return 1
    fi
    
    # 최신 배포 로그 찾기
    local latest_deploy_log=$(ls -t "$log_dir"/deploy-*.log 2>/dev/null | head -1)
    
    if [[ -n "$latest_deploy_log" ]]; then
        echo -e "${GREEN}📄 최신 배포 로그: $(basename "$latest_deploy_log")${NC}"
        echo -e "${CYAN}위치: $latest_deploy_log${NC}"
        echo ""
        echo -e "${WHITE}마지막 20줄:${NC}"
        tail -20 "$latest_deploy_log"
    else
        echo -e "${YELLOW}⚠️  배포 로그를 찾을 수 없습니다.${NC}"
        echo ""
        echo -e "${WHITE}사용 가능한 로그 파일들:${NC}"
        ls -la "$log_dir"/*.log 2>/dev/null || echo -e "${CYAN}  로그 파일이 없습니다.${NC}"
    fi
    echo ""
}

# 함수: Git 상태 확인
check_git_status() {
    echo -e "${PURPLE}🌿 Git 상태를 확인합니다...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    
    # 브랜치 정보
    echo -e "${WHITE}📍 브랜치 정보:${NC}"
    local current_branch=$(git branch --show-current)
    echo -e "  현재 브랜치: ${GREEN}$current_branch${NC}"
    
    # 원격 상태 확인
    echo -e "${WHITE}🔄 원격 저장소 상태:${NC}"
    git fetch --dry-run origin 2>/dev/null
    
    local behind_commits=$(git rev-list --count HEAD..origin/$current_branch 2>/dev/null || echo "0")
    local ahead_commits=$(git rev-list --count origin/$current_branch..HEAD 2>/dev/null || echo "0")
    
    if [[ "$behind_commits" -gt 0 ]]; then
        echo -e "  ${YELLOW}⚠️  원격보다 $behind_commits 커밋 뒤쳐져 있음${NC}"
        echo -e "  ${CYAN}💡 git pull origin $current_branch${NC}"
    else
        echo -e "  ${GREEN}✅ 최신 상태${NC}"
    fi
    
    if [[ "$ahead_commits" -gt 0 ]]; then
        echo -e "  ${CYAN}📤 원격보다 $ahead_commits 커밋 앞서 있음${NC}"
        echo -e "  ${CYAN}💡 git push origin $current_branch${NC}"
    fi
    
    # 작업 디렉토리 상태
    echo -e "${WHITE}📝 작업 디렉토리 상태:${NC}"
    if git diff --quiet && git diff --cached --quiet; then
        echo -e "  ${GREEN}✅ 깨끗함 (변경사항 없음)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  변경사항이 있습니다:${NC}"
        git status --porcelain | head -10
    fi
    
    # 최근 커밋들
    echo ""
    echo -e "${WHITE}📅 최근 커밋 (5개):${NC}"
    git log --oneline -5 --color=always
    echo ""
}

# 메인 함수
main() {
    local command="$1"
    local service="${2:-all}"
    
    case "$command" in
        # 빠른 별칭들
        "start-all")
            command="start"
            service="all"
            ;&
        "stop-all")
            if [[ "$command" == "stop-all" ]]; then
                command="stop"
                service="all"
            fi
            ;&
        "restart-all")
            if [[ "$command" == "restart-all" ]]; then
                command="restart"
                service="all"
            fi
            ;&
        "start-backend")
            if [[ "$command" == "start-backend" ]]; then
                command="start"
                service="backend"
            fi
            ;&
        "start-frontend")
            if [[ "$command" == "start-frontend" ]]; then
                command="start"
                service="storefront"
            fi
            ;&
        "start-docker")
            if [[ "$command" == "start-docker" ]]; then
                command="start"
                service="docker"
            fi
            ;&
        "stop-backend")
            if [[ "$command" == "stop-backend" ]]; then
                command="stop"
                service="backend"
            fi
            ;&
        "stop-frontend")
            if [[ "$command" == "stop-frontend" ]]; then
                command="stop"
                service="storefront"
            fi
            ;&
        "stop-docker")
            if [[ "$command" == "stop-docker" ]]; then
                command="stop"
                service="docker"
            fi
            ;&
        "start")
            print_header
            case "$service" in
                "all")
                    start_docker
                    sleep 3
                    start_backend
                    sleep 2
                    start_storefront
                    ;;
                "docker")
                    start_docker
                    ;;
                "backend")
                    start_backend
                    ;;
                "storefront")
                    start_storefront
                    ;;
                *)
                    echo -e "${RED}❌ 알 수 없는 서비스: $service${NC}"
                    show_usage
                    exit 1
                    ;;
            esac
            ;;
        "stop")
            print_header
            case "$service" in
                "all")
                    stop_process "storefront"
                    stop_process "backend"
                    stop_docker
                    ;;
                "docker")
                    stop_docker
                    ;;
                "backend")
                    stop_process "backend"
                    ;;
                "storefront")
                    stop_process "storefront"
                    ;;
                *)
                    echo -e "${RED}❌ 알 수 없는 서비스: $service${NC}"
                    show_usage
                    exit 1
                    ;;
            esac
            ;;
        "restart")
            print_header
            echo -e "${YELLOW}🔄 $service 재시작 중...${NC}"
            $0 stop "$service"
            sleep 2
            $0 start "$service"
            ;;
        "status")
            print_header
            echo -e "${WHITE}서비스 상태:${NC}"
            check_service_status "backend" "$BACKEND_PORT"
            check_service_status "storefront" "$STOREFRONT_PORT"
            check_docker_status
            ;;
        "logs")
            if [[ "$service" == "all" ]]; then
                echo -e "${RED}❌ 특정 서비스를 지정해주세요 (backend, storefront, docker)${NC}"
                exit 1
            fi
            show_logs "$service"
            ;;
        "health")
            print_header
            health_check
            ;;
        "ports")
            print_header
            check_ports
            ;;
        "reset")
            print_header
            reset_environment
            ;;
        "deploy")
            print_header
            run_manual_deploy
            ;;
        "cicd")
            print_header
            check_cicd_status
            ;;
        "deploy-logs")
            print_header
            show_deploy_logs
            ;;
        "git-status")
            print_header
            check_git_status
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

# 스크립트 실행
if [[ $# -eq 0 ]]; then
    show_usage
    exit 1
fi

main "$@" 