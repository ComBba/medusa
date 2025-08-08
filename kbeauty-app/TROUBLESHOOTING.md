# Amazon 통합 문제 해결 가이드

## "No marketplaces found" 문제 해결

### 1. 스크립트 실행 확인
```bash
npx medusa exec src/scripts/setup-amazon-integration.ts
```

예상 결과: "이미 존재하는 마켓플레이스: 9개"

### 2. API 엔드포인트 테스트
```bash
# Medusa 서버가 실행 중인 상태에서
curl -X GET http://localhost:9000/admin/amazon/marketplaces
```

### 3. 데이터베이스 직접 확인
```sql
SELECT id, marketplace_id, name, is_active 
FROM amazon_marketplace 
LIMIT 10;
```

### 4. 브라우저 네트워크 탭 확인
1. F12 → Network 탭
2. `/admin/amazon/marketplaces` 요청 확인
3. 응답 코드와 내용 확인

### 5. 캐시 문제 해결
```bash
# 브라우저 캐시 삭제
# 또는 시크릿 모드에서 테스트
```

### 6. 환경변수 확인
```bash
echo $VITE_MEDUSA_BACKEND_URL
echo $VITE_BACKEND_URL
```

기본값: `http://localhost:9000`

### 7. 모듈 등록 확인
`medusa-config.ts`에서 `amazon_integration` 모듈이 등록되어 있는지 확인

### 8. 서버 재시작
```bash
npm run dev
# 또는
yarn dev
```

## 일반적인 해결책

### A. 데이터베이스 재초기화
```bash
# 기존 데이터 삭제 후 재생성
npm run medusa migrations:revert
npm run medusa migrations:run
npx medusa exec src/scripts/setup-amazon-integration.ts
```

### B. 모듈 재빌드
```bash
npm run build
npm run dev
```

### C. 환경변수 검증
`.env` 파일에서 다음 변수들이 올바르게 설정되어 있는지 확인:
- `AMAZON_LWA_CLIENT_ID`
- `AMAZON_LWA_CLIENT_SECRET`
- `AMAZON_LWA_REFRESH_TOKEN`
- `AMAZON_SELLER_ID`

## 로그 레벨 증가
더 자세한 디버깅을 위해 `medusa-config.ts`에 추가:
```typescript
export default defineConfig({
  // ...
  logger: {
    level: "debug"
  }
})
```
