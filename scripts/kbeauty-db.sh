#!/bin/bash

# kbeauty.market 데이터베이스 관리 스크립트
# 사용법: ./scripts/kbeauty-db.sh [command]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# 프로젝트 경로
PROJECT_ROOT="/home/barahime/github/medusa"
BACKEND_DIR="$PROJECT_ROOT/kbeauty-app"
BACKUP_DIR="$PROJECT_ROOT/.backups"

# 데이터베이스 설정
DB_HOST="localhost"
DB_PORT="10002"
DB_NAME="kbeauty_market"
DB_USER="medusa"
DB_PASSWORD="medusa"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

# 함수: 헤더 출력
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}                   🗄️  kbeauty.market 데이터베이스 관리자                 ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 함수: 사용법 출력
show_usage() {
    print_header
    echo -e "${WHITE}사용법:${NC}"
    echo -e "  ${CYAN}./scripts/kbeauty-db.sh ${YELLOW}[command]${NC}"
    echo ""
    echo -e "${WHITE}명령어:${NC}"
    echo -e "  ${GREEN}status${NC}      - 데이터베이스 연결 상태 확인"
    echo -e "  ${GREEN}connect${NC}     - 데이터베이스에 연결 (psql)"
    echo -e "  ${GREEN}migrate${NC}     - 마이그레이션 실행"
    echo -e "  ${GREEN}migrate-undo${NC} - 마지막 마이그레이션 취소"
    echo -e "  ${GREEN}seed${NC}        - 시드 데이터 삽입"
    echo -e "  ${GREEN}reset${NC}       - 데이터베이스 초기화"
    echo -e "  ${GREEN}backup${NC}      - 데이터베이스 백업"
    echo -e "  ${GREEN}restore${NC}     - 데이터베이스 복원"
    echo -e "  ${GREEN}list-backups${NC} - 백업 파일 목록"
    echo -e "  ${GREEN}tables${NC}      - 테이블 목록 확인"
    echo -e "  ${GREEN}size${NC}        - 데이터베이스 크기 확인"
    echo -e "  ${GREEN}users${NC}       - 사용자 목록 확인"
    echo -e "  ${GREEN}create-admin${NC} - 관리자 계정 생성"
    echo ""
    echo -e "${WHITE}예시:${NC}"
    echo -e "  ${CYAN}./scripts/kbeauty-db.sh migrate${NC}     # 마이그레이션 실행"
    echo -e "  ${CYAN}./scripts/kbeauty-db.sh backup${NC}      # 데이터베이스 백업"
    echo -e "  ${CYAN}./scripts/kbeauty-db.sh connect${NC}     # 데이터베이스 연결"
    echo ""
}

# 함수: 데이터베이스 연결 확인
check_db_connection() {
    echo -e "${YELLOW}🔍 데이터베이스 연결 확인 중...${NC}"
    
    if sudo docker-compose exec -T postgres pg_isready -h localhost -p 5432 -U "$DB_USER" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 데이터베이스 연결 성공${NC}"
        return 0
    else
        echo -e "${RED}❌ 데이터베이스 연결 실패${NC}"
        echo -e "${YELLOW}💡 Docker 서비스가 실행 중인지 확인하세요: sudo docker-compose ps${NC}"
        return 1
    fi
}

# 함수: 데이터베이스 연결
connect_db() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${CYAN}🔗 데이터베이스에 연결합니다...${NC}"
    echo -e "${YELLOW}💡 종료하려면 \\q 또는 exit를 입력하세요.${NC}"
    sudo docker-compose exec postgres psql -U "$DB_USER" -d "$DB_NAME"
}

# 함수: 마이그레이션 실행
run_migration() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${YELLOW}🚀 마이그레이션 실행 중...${NC}"
    
    if [[ ! -d "$BACKEND_DIR" ]]; then
        echo -e "${RED}❌ 백엔드 디렉토리를 찾을 수 없습니다: $BACKEND_DIR${NC}"
        return 1
    fi
    
    cd "$BACKEND_DIR"
    if npx medusa db:migrate; then
        echo -e "${GREEN}✅ 마이그레이션이 성공적으로 완료되었습니다.${NC}"
    else
        echo -e "${RED}❌ 마이그레이션 실행에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: 시드 데이터 삽입
run_seed() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${YELLOW}🌱 시드 데이터 삽입 중...${NC}"
    
    cd "$BACKEND_DIR"
    if npx medusa seed; then
        echo -e "${GREEN}✅ 시드 데이터가 성공적으로 삽입되었습니다.${NC}"
    else
        echo -e "${RED}❌ 시드 데이터 삽입에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: 데이터베이스 백업
backup_db() {
    if ! check_db_connection; then
        return 1
    fi
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/kbeauty_backup_$timestamp.sql"
    
    echo -e "${YELLOW}💾 데이터베이스 백업 중...${NC}"
    
    if sudo docker-compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$backup_file"; then
        echo -e "${GREEN}✅ 백업이 완료되었습니다: $backup_file${NC}"
        
        # 백업 파일 크기 표시
        local size=$(du -h "$backup_file" | cut -f1)
        echo -e "${CYAN}📊 백업 파일 크기: $size${NC}"
        
        # 10개 이상의 백업 파일이 있으면 가장 오래된 것 삭제
        local backup_count=$(ls -1 "$BACKUP_DIR"/kbeauty_backup_*.sql 2>/dev/null | wc -l)
        if [[ $backup_count -gt 10 ]]; then
            echo -e "${YELLOW}🧹 오래된 백업 파일 정리 중...${NC}"
            ls -1t "$BACKUP_DIR"/kbeauty_backup_*.sql | tail -n +11 | xargs rm -f
        fi
    else
        echo -e "${RED}❌ 백업에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: 데이터베이스 복원
restore_db() {
    if [[ $# -eq 0 ]]; then
        echo -e "${CYAN}📋 사용 가능한 백업 파일:${NC}"
        list_backups
        echo ""
        read -p "복원할 백업 파일명을 입력하세요: " backup_filename
    else
        backup_filename="$1"
    fi
    
    local backup_file="$BACKUP_DIR/$backup_filename"
    
    if [[ ! -f "$backup_file" ]]; then
        echo -e "${RED}❌ 백업 파일을 찾을 수 없습니다: $backup_file${NC}"
        return 1
    fi
    
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${YELLOW}⚠️  데이터베이스를 복원하면 현재 데이터가 모두 삭제됩니다.${NC}"
    read -p "계속하시겠습니까? [y/N]: " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}복원이 취소되었습니다.${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}🔄 데이터베이스 복원 중...${NC}"
    
    # 기존 연결 종료
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1
    
    # 데이터베이스 삭제 및 재생성
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" > /dev/null
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" > /dev/null
    
    # 백업 복원
    if sudo docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < "$backup_file" > /dev/null; then
        echo -e "${GREEN}✅ 데이터베이스 복원이 완료되었습니다.${NC}"
    else
        echo -e "${RED}❌ 데이터베이스 복원에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: 백업 파일 목록
list_backups() {
    echo -e "${CYAN}📋 백업 파일 목록:${NC}"
    
    if ls "$BACKUP_DIR"/kbeauty_backup_*.sql > /dev/null 2>&1; then
        ls -lht "$BACKUP_DIR"/kbeauty_backup_*.sql | awk '{print $9, "(" $5 ", " $6 " " $7 " " $8 ")"}'
    else
        echo -e "${YELLOW}백업 파일이 없습니다.${NC}"
    fi
}

# 함수: 테이블 목록 확인
show_tables() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${CYAN}📊 테이블 목록:${NC}"
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\\dt"
}

# 함수: 데이터베이스 크기 확인
show_db_size() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${CYAN}📏 데이터베이스 크기:${NC}"
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            pg_database.datname as database_name,
            pg_size_pretty(pg_database_size(pg_database.datname)) as size
        FROM pg_database 
        WHERE pg_database.datname = '$DB_NAME';
    "
    
    echo -e "\n${CYAN}📊 테이블별 크기:${NC}"
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10;
    "
}

# 함수: 사용자 목록 확인
show_users() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${CYAN}👥 등록된 사용자 목록:${NC}"
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT id, email, first_name, last_name, created_at 
        FROM \"user\" 
        ORDER BY created_at DESC 
        LIMIT 10;
    " 2>/dev/null || echo -e "${YELLOW}사용자 테이블을 찾을 수 없습니다. 마이그레이션을 먼저 실행하세요.${NC}"
}

# 함수: 관리자 계정 생성
create_admin() {
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${YELLOW}👤 관리자 계정 생성${NC}"
    
    read -p "이메일: " admin_email
    read -s -p "비밀번호: " admin_password
    echo
    read -p "이름: " admin_first_name
    read -p "성: " admin_last_name
    
    cd "$BACKEND_DIR"
    if npx medusa user --email "$admin_email" --password "$admin_password" --first-name "$admin_first_name" --last-name "$admin_last_name"; then
        echo -e "${GREEN}✅ 관리자 계정이 생성되었습니다.${NC}"
        echo -e "${CYAN}🔗 관리자 로그인: http://admin.kbeauty.market${NC}"
    else
        echo -e "${RED}❌ 관리자 계정 생성에 실패했습니다.${NC}"
        return 1
    fi
}

# 함수: 데이터베이스 초기화
reset_db() {
    echo -e "${YELLOW}⚠️  데이터베이스를 초기화하면 모든 데이터가 삭제됩니다.${NC}"
    read -p "계속하시겠습니까? [y/N]: " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}초기화가 취소되었습니다.${NC}"
        return 0
    fi
    
    if ! check_db_connection; then
        return 1
    fi
    
    echo -e "${YELLOW}🔄 데이터베이스 초기화 중...${NC}"
    
    # 기존 연결 종료
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1
    
    # 데이터베이스 삭제 및 재생성
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" > /dev/null
    sudo docker-compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" > /dev/null
    
    echo -e "${GREEN}✅ 데이터베이스가 초기화되었습니다.${NC}"
    echo -e "${CYAN}💡 이제 마이그레이션을 실행하세요: ./scripts/kbeauty-db.sh migrate${NC}"
}

# 메인 함수
main() {
    local command="$1"
    
    case "$command" in
        "status")
            print_header
            check_db_connection
            ;;
        "connect")
            print_header
            connect_db
            ;;
        "migrate")
            print_header
            run_migration
            ;;
        "seed")
            print_header
            run_seed
            ;;
        "backup")
            print_header
            backup_db
            ;;
        "restore")
            print_header
            restore_db "$2"
            ;;
        "list-backups")
            print_header
            list_backups
            ;;
        "tables")
            print_header
            show_tables
            ;;
        "size")
            print_header
            show_db_size
            ;;
        "users")
            print_header
            show_users
            ;;
        "create-admin")
            print_header
            create_admin
            ;;
        "reset")
            print_header
            reset_db
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