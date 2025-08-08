# CORS 문제 해결 가이드

## 현재 해결된 내용:
✅ API 엔드포인트 `/admin/amazon/marketplaces/[id]` 생성
✅ CORS 헤더 모든 API 엔드포인트에 추가
✅ OPTIONS preflight 요청 처리
✅ TypeScript 에러 수정

## 추가 확인사항:

### 1. 서버가 제대로 재시작되었는지 확인
```bash
curl -I https://api.kbeauty.market/admin/amazon/marketplaces
```
응답에 `Access-Control-Allow-Origin` 헤더가 있어야 함

### 2. 환경변수 확인
`.env` 파일에 다음 내용 추가 (필요시):
```
ADMIN_CORS=https://admin.kbeauty.market,http://admin.kbeauty.market
STORE_CORS=https://admin.kbeauty.market,http://admin.kbeauty.market
AUTH_CORS=https://admin.kbeauty.market,http://admin.kbeauty.market
```

### 3. 네트워크 탭에서 확인
- F12 → Network 탭
- OPTIONS 요청이 200 응답을 받는지 확인
- POST 요청이 성공하는지 확인

### 4. 로컬에서 테스트
```bash
# 로컬 환경에서 테스트
curl -X POST http://localhost:9000/admin/amazon/marketplaces/[ID] \
  -H "Content-Type: application/json" \
  -d '{"is_active": true}'
```

### 5. SSL/TLS 문제일 경우
- Mixed content (HTTP/HTTPS) 확인
- SSL 인증서 문제 확인

## 성공 지표:
- ✅ CORS 에러 없음
- ✅ 토글 스위치 정상 작동
- ✅ 마켓플레이스 상태 업데이트 성공
- ✅ "Active/Inactive" 상태 변경 확인
