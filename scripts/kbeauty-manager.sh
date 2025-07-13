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

# 프로젝트 경로
PROJECT_ROOT="/home/barahime/github/medusa"
BACKEND_DIR="$PROJECT_ROOT/kbeauty-app"
STOREFRONT_DIR="$PROJECT_ROOT/kbeauty-app-storefront"

# PID 파일 디렉토리
PID_DIR="$PROJECT_ROOT/.pids"
mkdir -p "$PID_DIR"

# 로그 파일 디렉토리
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

# 서비스 포트 정의
BACKEND_PORT=10000
STOREFRONT_PORT=10004
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
    echo -e "${WHITE}서비스:${NC}"
    echo -e "  ${BLUE}all${NC}         - 모든 서비스"
    echo -e "  ${BLUE}docker${NC}      - Docker 서비스 (DB, Redis, MinIO 등)"
    echo -e "  ${BLUE}backend${NC}     - 백엔드 API 서버 (포트 $BACKEND_PORT)"
    echo -e "  ${BLUE}storefront${NC}  - 스토어프론트 (포트 $STOREFRONT_PORT)"
    echo -e "  ${BLUE}postgres${NC}    - PostgreSQL (포트 $POSTGRES_PORT)"
    echo -e "  ${BLUE}redis${NC}       - Redis (포트 $REDIS_PORT)"
    echo -e "  ${BLUE}adminer${NC}     - Adminer (포트 $ADMINER_PORT)"
    echo -e "  ${BLUE}minio${NC}       - MinIO (포트 $MINIO_API_PORT, $MINIO_CONSOLE_PORT)"
    echo ""
    echo -e "${WHITE}예시:${NC}"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh start all${NC}        # 모든 서비스 시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh restart backend${NC}  # 백엔드만 재시작"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh logs storefront${NC}  # 스토어프론트 로그 확인"
    echo -e "  ${CYAN}./scripts/kbeauty-manager.sh status${NC}           # 전체 상태 확인"
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
    nohup yarn dev --port=$STOREFRONT_PORT > "$log_file" 2>&1 &
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
            echo -e "${GREEN}✅ 실행 중 (PID: $pid, 포트: $port)${NC}"
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

# 메인 함수
main() {
    local command="$1"
    local service="${2:-all}"
    
    case "$command" in
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