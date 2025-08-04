# 🚨 Amazon Admin UI 콘솔 에러 해결 가이드

> **Seller ID 설정 문제 및 Admin UI 콘솔 에러 완전 해결**

## 🎯 문제 개요

사용자가 겪고 있는 문제들:
1. ❌ Seller ID 설정이 저장되지 않음
2. ❌ 마켓플레이스 활성화 안됨  
3. ❌ 401 Unauthorized 에러
4. ❌ DOM nesting 경고
5. ❌ 프로덕션 API 호출 문제

## 🔍 에러 분석

### 콘솔 에러 분석
```javascript
// 1. 프로덕션 API 호출 문제
GET https://api.kbeauty.market/admin/users/me 401 (Unauthorized)

// 2. Seller ID null 전송
{seller_id: null, mws_auth_token: undefined, is_active: true, auto_sync: true}

// 3. DOM nesting 경고
Warning: validateDOMNesting(...): <p> cannot appear as a descendant of <p>
```

### 근본 원인
1. **Backend URL 설정 오류**: `VITE_BACKEND_URL` 대신 `VITE_MEDUSA_BACKEND_URL` 사용해야 함
2. **환경변수 누락**: Admin UI용 VITE_ 환경변수 설정 부족
3. **Seller ID 로직 오류**: 빈 값 처리 로직 문제
4. **하드코딩된 API URL**: 컴포넌트에서 프로덕션 URL 하드코딩

## ✅ 해결된 문제들

### 1. Backend URL 설정 수정 ✅
```typescript
// 이전 (문제)
baseUrl: import.meta.env.VITE_BACKEND_URL || "/",

// 수정 후 (해결)
baseUrl: import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:10000",
```

### 2. Seller ID 저장 로직 개선 ✅
```typescript
// 이전 (문제): null 전송
if (!data.seller_id) {
  updateData.seller_id = null
}

// 수정 후 (해결): 유효한 값만 전송
if (data.seller_id && data.seller_id.trim() !== "" && data.seller_id !== defaultSellerID) {
  updateData.seller_id = data.seller_id.trim()
}
```

### 3. API 호출 개선 ✅
```typescript
// 이전 (문제): 하드코딩된 프로덕션 URL
const response = await fetch('https://api.kbeauty.market/admin/amazon/test-connection', {
  // ...
})

// 수정 후 (해결): SDK 사용
const data = await amazonSyncClient.testConnection(marketplace.marketplace_id)
```

### 4. DOM nesting 문제 해결 ✅
```tsx
<!-- 이전 (문제): p 태그 중첩 -->
<Text className="text-xs text-medusa-fg-subtle">
  설명 텍스트
</Text>

<!-- 수정 후 (해결): div 사용 -->
<div className="text-xs text-medusa-fg-subtle">
  설명 텍스트
</div>
```

## 🛠️ 설정 방법

### 1단계: 환경변수 업데이트

```bash
# 최신 환경변수 템플릿 생성
npx medusa exec src/scripts/generate-sandbox-env.ts

# .env 파일 업데이트
cp .env.sandbox .env
```

### 필수 환경변수 설정
```bash
# .env 파일에 다음 내용 추가/수정

# 🎮 Admin UI 환경변수 (VITE_ 접두사 필수!)
VITE_MEDUSA_BACKEND_URL=http://localhost:10000
VITE_AMAZON_INTEGRATION_ENABLED=true  
VITE_AMAZON_SELLER_ID=A3YOUR_ACTUAL_SELLER_ID

# 🖥️ 백엔드 환경변수
AMAZON_SELLER_ID=A3YOUR_ACTUAL_SELLER_ID
AMAZON_SP_API_SANDBOX=true
AMAZON_INTEGRATION_ENABLED=true
```

### 2단계: 설정 진단 실행

```bash
# Admin UI 설정 진단
npx medusa exec src/scripts/diagnose-admin-ui-config.ts
```

**예상 결과**:
```
🔍 Admin UI 설정 진단 시작
✅ VITE_MEDUSA_BACKEND_URL: http://localhost:10000
✅ VITE_AMAZON_SELLER_ID: A3YOUR_SELLER_ID
✅ Admin UI가 로컬 백엔드 사용
🎉 모든 설정이 올바르게 구성되었습니다!
```

### 3단계: 서버 재시작

```bash
# 백엔드 서버 재시작 (중요!)
npm run dev

# 브라우저 캐시 초기화
# Chrome: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
```

### 4단계: Admin UI 테스트

```bash
# Admin UI 접속
http://localhost:9000/app/settings/amazon

# 브라우저 개발자 도구 > 콘솔 탭에서 확인해야 할 것들:
✅ Backend URL이 localhost:10000으로 호출됨
✅ 401 Unauthorized 에러 사라짐
✅ DOM nesting 경고 사라짐
✅ Seller ID 저장 성공 로그
```

## 🧪 테스트 절차

### 1. 콘솔 에러 확인
브라우저 개발자 도구에서 다음 로그가 나타나야 합니다:

```javascript
// ✅ 올바른 로그
Performing request to: http://localhost:10000/admin/amazon/marketplaces
Updating marketplace: 01K12KANKA92JZA05HP8MDYCE7 {seller_id: "A3SANDBOX123456789"}

// ❌ 문제가 있는 로그  
Performing request to: https://api.kbeauty.market/admin/... (프로덕션 URL)
{seller_id: null} (null 전송)
```

### 2. Seller ID 저장 테스트

1. **마켓플레이스 편집 모달 열기**
   - Amazon 설정 페이지에서 연필 아이콘 클릭
   
2. **환경변수 기본값 확인**
   ```
   Seller ID * (환경변수: A3YOUR...)
   ┌─────────────────────────────────────┐
   │ 기본값: A3YOUR_ACTUAL_SELLER_ID     │
   └─────────────────────────────────────┘
   ```

3. **저장 테스트**
   - 다른 값 입력 후 저장
   - 콘솔에서 전송 데이터 확인
   ```javascript
   Updating marketplace: ID {seller_id: "새로운값", ...}
   ```

### 3. 마켓플레이스 활성화 테스트

```bash
# 1. Seller ID 설정 완료 후
# 2. 마켓플레이스 토글 스위치 활성화
# 3. 상태가 "Active"로 변경되는지 확인
# 4. "Setup Required" 배지가 사라지는지 확인
```

## 🔧 문제 해결

### 여전히 프로덕션 API 호출하는 경우

```bash
# 1. 환경변수 확인
echo $VITE_MEDUSA_BACKEND_URL
# 출력: http://localhost:10000

# 2. .env 파일 직접 확인
grep VITE_MEDUSA_BACKEND_URL .env
# 출력: VITE_MEDUSA_BACKEND_URL=http://localhost:10000

# 3. 서버 완전 재시작
pkill -f "node.*medusa"
npm run dev
```

### Seller ID가 여전히 null로 전송되는 경우

```bash
# 브라우저 개발자 도구 > 콘솔에서 확인
console.log('Environment:', import.meta.env.VITE_AMAZON_SELLER_ID)

# 값이 없으면 환경변수 재설정
echo "VITE_AMAZON_SELLER_ID=A3YOUR_ACTUAL_SELLER_ID" >> .env
```

### 401 Unauthorized 지속되는 경우

```bash
# 1. 로그인 상태 확인
# Admin UI에서 로그아웃 후 재로그인

# 2. 세션 쿠키 삭제
# 브라우저 개발자 도구 > Application > Cookies > 모두 삭제

# 3. 백엔드 서버 완전 재시작
```

## 📊 성공 기준

### ✅ 모든 것이 정상 작동하는 상태

1. **콘솔 로그**:
   ```javascript
   ✅ localhost:10000 API 호출
   ✅ seller_id: "실제값" 전송
   ✅ DOM nesting 경고 없음
   ✅ 401 에러 없음
   ```

2. **Admin UI**:
   ```
   ✅ Seller ID 필드에 환경변수 기본값 표시
   ✅ Seller ID 저장 성공
   ✅ 마켓플레이스 활성화 가능
   ✅ "Setup Required" 배지 사라짐
   ```

3. **기능 테스트**:
   ```
   ✅ 연결 테스트 버튼 작동
   ✅ 동기화 상태 표시
   ✅ 마켓플레이스 목록 로딩
   ```

## 🎯 다음 단계

성공적으로 설정 완료 후:

1. **상품 생성 및 동기화 테스트**
2. **워크플로우 대시보드 테스트**  
3. **실제 Amazon SP-API 연결 테스트**
4. **프로덕션 환경 준비**

## 📞 지원

문제가 지속되는 경우:

1. **진단 스크립트 실행**:
   ```bash
   npx medusa exec src/scripts/diagnose-admin-ui-config.ts
   ```

2. **상세 로그 확인**:
   ```bash
   DEBUG=medusa:* npm run dev
   ```

3. **관련 문서**:
   - `README.Amazon-Seller-ID-Fix.md`
   - `README.Amazon-Sandbox-Complete-Guide.md`

---

**🌸 kbeauty.market Technical Support**  
*Solving complex integration challenges with precision*

---

> **최종 업데이트**: 2025-01-26  
> **해결 상태**: ✅ 완전 해결  
> **테스트 상태**: ✅ 검증 완료  
> **지원 상태**: 24/7 준비 완료 🚀