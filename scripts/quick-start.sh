#!/bin/bash

# kbeauty.market 퀵 스타트 스크립트
# 사용법: ./scripts/quick-start.sh

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}🌸 kbeauty.market 퀵 스타트${NC}"
echo ""

# 1. Docker 서비스 시작
echo -e "${YELLOW}1. Docker 서비스 시작...${NC}"
./scripts/kbeauty-manager.sh start docker
sleep 5

# 2. 백엔드 서버 시작
echo -e "${YELLOW}2. 백엔드 서버 시작...${NC}"
./scripts/kbeauty-manager.sh start backend
sleep 3

# 3. 스토어프론트 시작
echo -e "${YELLOW}3. 스토어프론트 시작...${NC}"
./scripts/kbeauty-manager.sh start storefront

echo ""
echo -e "${GREEN}✅ kbeauty.market이 시작되었습니다!${NC}"
echo ""
echo -e "${CYAN}📋 서비스 URL:${NC}"
echo "  - 스토어: http://kbeauty.market"
echo "  - 관리자: http://admin.kbeauty.market"
echo "  - API: http://api.kbeauty.market"
echo "  - DB: http://db.kbeauty.market"
echo ""
echo -e "${YELLOW}💡 유용한 명령어:${NC}"
echo "  - 상태 확인: ./scripts/kbeauty-manager.sh status"
echo "  - 로그 확인: ./scripts/kbeauty-manager.sh logs [service]"
echo "  - 서비스 중지: ./scripts/kbeauty-manager.sh stop all"
echo "" 