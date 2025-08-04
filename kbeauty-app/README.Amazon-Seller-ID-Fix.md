# 🔧 Amazon Seller ID 설정 문제 해결 가이드

> **환경변수 기본값과 데이터베이스 저장 로직 개선**

## 🎯 개요

Amazon 통합 시스템에서 Seller ID 설정이 저장되지 않는 문제를 해결하고, 환경변수를 기본값으로 사용하되 사용자가 변경하면 데이터베이스에 저장하는 로직을 구현했습니다.

## ✅ 해결된 문제들

### 1. **Seller ID 저장 실패 문제**
- **원인**: API 파라미터 이름 불일치 (`mws_token` vs `mws_auth_token`)
- **해결**: Admin UI에서 API 엔드포인트가 기대하는 필드명으로 변환

### 2. **환경변수 기본값 로직 부재**
- **원인**: 환경변수를 기본값으로 사용하는 로직이 없음
- **해결**: 환경변수 우선순위 로직 구현

### 3. **MWS Auth Token Password 필드 오류**
- **원인**: `type="password"`로 설정된 MWS 토큰 필드
- **해결**: 토글 가능한 보안 입력 필드로 변경

## 🔄 개선된 로직

### 환경변수 우선순위

```typescript
// 1. DB에 저장된 값이 있으면 우선 사용
if (marketplace.seller_id && marketplace.seller_id !== 'your-seller-id') {
  return marketplace.seller_id
}

// 2. 환경변수 기본값 사용
const envSellerID = import.meta.env.VITE_AMAZON_SELLER_ID
return envSellerID || ""
```

### 변경사항 감지 및 저장

```typescript
// Seller ID: 기본값과 다르면 DB에 저장
if (data.seller_id && data.seller_id !== defaultSellerID) {
  updateData.seller_id = data.seller_id
} else if (!data.seller_id) {
  // 빈 값으로 설정한 경우 명시적으로 null 전송
  updateData.seller_id = null
}
```

## 🛠️ 필수 환경변수 설정

Admin UI에서 환경변수를 사용하려면 반드시 `VITE_` 접두사를 붙여야 합니다:

```bash
# .env 파일에 추가
VITE_AMAZON_SELLER_ID=A3YOUR_ACTUAL_SELLER_ID
```

## 🎮 사용법

### 1단계: 환경변수 설정

```bash
# 환경변수 템플릿 재생성 (업데이트된 버전)
npx medusa exec src/scripts/generate-sandbox-env.ts

# .env 파일에서 VITE_AMAZON_SELLER_ID 설정
VITE_AMAZON_SELLER_ID=A3YOUR_SANDBOX_SELLER_ID
```

### 2단계: Admin UI에서 확인

1. Admin UI 접속: `http://localhost:10000/app/settings/amazon`
2. 마켓플레이스의 연필 아이콘 클릭
3. Seller ID 필드에서 환경변수 기본값 확인
4. 필요시 다른 값으로 변경하고 저장

### 3단계: 동작 확인

```
📊 Seller ID 필드 표시 예시:
┌─────────────────────────────────────────┐
│ Seller ID *                             │
│ (환경변수: A3SAND...)                    │
│ ┌─────────────────────────────────────┐ │
│ │ 기본값: A3SANDBOX123456789          │ │
│ └─────────────────────────────────────┘ │
│ 환경변수 기본값이 설정되어 있습니다.      │
│ 다른 값을 입력하면 데이터베이스에        │
│ 저장됩니다.                            │
└─────────────────────────────────────────┘
```

## 🔐 MWS Auth Token 개선사항

### 보안 입력 필드

- **이전**: 단순 `type="password"` 필드
- **개선**: 토글 가능한 보안 필드 (👁️/🙈 버튼)
- **자동완성 방지**: `autoComplete="off"` 설정

### 사용법

```
┌─────────────────────────────────────────┐
│ MWS Auth Token (선택사항)               │
│ ┌─────────────────────────────────────┐ │
│ │ ••••••••••••••••••••••••••••••••  👁️│ │
│ └─────────────────────────────────────┘ │
│ 대부분의 경우 SP-API만으로 충분하므로    │
│ 비워두셔도 됩니다.                      │
└─────────────────────────────────────────┘
```

## 📊 저장 로직

### 변경사항 감지

```typescript
// 1. Seller ID 변경 감지
if (data.seller_id && data.seller_id !== defaultSellerID) {
  updateData.seller_id = data.seller_id // DB에 저장
}

// 2. MWS Token 변경 감지  
if (data.mws_auth_token !== (marketplace.mws_auth_token || "")) {
  updateData.mws_token = data.mws_auth_token // DB에 저장
}

// 3. 변경사항이 있는 경우에만 API 호출
if (Object.keys(updateData).length > 0) {
  await amazonSyncClient.updateMarketplace(marketplace.id, updateData)
}
```

### API 호출 로그

```javascript
// 브라우저 콘솔에서 확인 가능
console.log('Submitting marketplace update:', updateData)
console.log('Update result:', result)
```

## 🧪 테스트 방법

### 1. 환경변수 기본값 테스트

```bash
# 1. VITE_AMAZON_SELLER_ID 설정
echo "VITE_AMAZON_SELLER_ID=A3SANDBOX123456789" >> .env

# 2. Admin UI 재시작
npm run dev

# 3. Admin UI에서 Seller ID 필드 확인
# 환경변수 값이 기본값으로 표시되는지 확인
```

### 2. 저장 기능 테스트

```bash
# 1. Admin UI에서 Seller ID 변경
# 2. 브라우저 개발자 도구 > 콘솔 탭 열기
# 3. 저장 버튼 클릭
# 4. 콘솔에서 다음 로그 확인:
#    - "Submitting marketplace update: {...}"
#    - "Update result: {...}"
```

### 3. 데이터베이스 확인

```bash
# Adminer 접속하여 확인
http://localhost:10008

# amazon_marketplace 테이블에서 seller_id 컬럼 확인
SELECT id, marketplace_id, seller_id, name FROM amazon_marketplace;
```

## 🔧 문제 해결

### Seller ID가 여전히 저장되지 않는 경우

1. **브라우저 콘솔 확인**
   ```javascript
   // 에러 메시지 확인
   // Network 탭에서 API 호출 상태 확인
   ```

2. **환경변수 확인**
   ```bash
   # VITE_ 접두사 확인
   grep VITE_AMAZON_SELLER_ID .env
   ```

3. **API 엔드포인트 확인**
   ```bash
   # API 로그 확인
   curl -X POST http://localhost:10000/admin/amazon/marketplaces/MARKETPLACE_ID \
     -H "Content-Type: application/json" \
     -d '{"seller_id":"TEST123456789"}'
   ```

### MWS Token 필드 오류

```bash
# 브라우저 콘솔에서 password input 관련 오류 확인
# autoComplete="off" 설정으로 해결됨
```

## 📚 관련 파일

### 수정된 파일들

1. **Admin UI 컴포넌트**
   - `src/admin/routes/settings/amazon/components/marketplace-edit-form.tsx`
   - `src/admin/lib/config.ts`

2. **환경변수 템플릿**
   - `src/scripts/generate-sandbox-env.ts`

3. **문서**
   - `README.Amazon-Seller-ID-Fix.md` (새로 생성)

### API 엔드포인트 (기존 유지)
- `src/api/admin/amazon/marketplaces/[id]/route.ts`
- `src/api/admin/amazon/marketplaces/route.ts`

## 🎯 다음 단계

1. **프로덕션 환경변수 설정**
   ```bash
   VITE_AMAZON_SELLER_ID=YOUR_ACTUAL_PRODUCTION_SELLER_ID
   ```

2. **마켓플레이스별 개별 Seller ID 지원**
   - 현재는 전역 기본값 사용
   - 향후 마켓플레이스별 환경변수 지원 가능

3. **보안 강화**
   - Seller ID 암호화 저장
   - API 토큰 보안 개선

---

**🌸 kbeauty.market Amazon Integration Team**  
*Making seller ID management seamless and secure*

---

> **최종 업데이트**: 2025-01-26  
> **해결 상태**: ✅ 완료  
> **테스트 상태**: ✅ 검증 완료