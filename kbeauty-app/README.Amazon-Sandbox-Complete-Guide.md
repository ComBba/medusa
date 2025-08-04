# 🧪 Amazon 샌드박스 완전 가이드

> **Medusa.js 2.0 기반 Amazon 통합 시스템 샌드박스 테스트 완전 가이드**

## 🎯 개요

이 가이드는 Medusa.js 2.0 기반의 kbeauty.market Amazon 통합 시스템을 샌드박스 환경에서 완전히 테스트하는 방법을 제공합니다. 모든 설정부터 실제 동기화 테스트까지 단계별로 안내합니다.

## 📋 목차

1. [시작하기 전에](#-시작하기-전에)
2. [환경 설정](#-환경-설정)
3. [샌드박스 초기화](#-샌드박스-초기화)
4. [테스트 실행](#-테스트-실행)
5. [Admin UI 사용](#-admin-ui-사용)
6. [문제 해결](#-문제-해결)
7. [다음 단계](#-다음-단계)

---

## 🚀 시작하기 전에

### 필수 준비사항

1. **Amazon Developer 계정** - SP-API 앱 등록용
2. **Amazon Seller Central 계정** - 샌드박스 셀러 ID 확인용  
3. **AWS 계정** - SP-API 접근용 IAM 사용자 생성
4. **로컬 개발 환경** - Medusa.js 2.0 프로젝트 실행 중

### 사전 확인

```bash
# 1. Medusa 서버가 실행 중인지 확인
curl http://localhost:10000/admin/auth

# 2. 데이터베이스 연결 확인
npx medusa db:migrate

# 3. Amazon 통합 모듈 등록 확인
grep -r "amazon_integration" medusa-config.ts
```

---

## ⚙️ 환경 설정

### 1단계: 환경변수 템플릿 생성

```bash
# 샌드박스 환경변수 템플릿 생성
npx medusa exec src/scripts/generate-sandbox-env.ts

# 생성된 템플릿을 .env로 복사
cp .env.sandbox .env
```

### 2단계: Amazon Developer Console 설정

1. **SP-API 앱 등록**
   - [Amazon Developer Console](https://developer.amazon.com/settings/console/registration) 접속
   - 새 SP-API 애플리케이션 생성
   - LWA Client ID, Client Secret 복사

2. **Refresh Token 생성**
   - SP-API 앱에서 "Generate Refresh Token" 클릭
   - 생성된 Refresh Token 복사

### 3단계: AWS IAM 설정

1. **IAM 사용자 생성**
   ```bash
   # AWS CLI 설치 후
   aws iam create-user --user-name sp-api-sandbox-user
   ```

2. **정책 연결**
   - `AmazonSellingPartnerAPIRole` 정책 연결
   - 또는 커스텀 SP-API 정책 생성

3. **Access Key 생성**
   ```bash
   aws iam create-access-key --user-name sp-api-sandbox-user
   ```

### 4단계: 환경변수 설정

`.env` 파일을 열고 다음 값들을 실제 값으로 교체:

```bash
# LWA 설정 (Amazon Developer Console에서 복사)
AMAZON_LWA_CLIENT_ID=amzn1.application-oa2-client.실제값
AMAZON_LWA_CLIENT_SECRET=실제값
AMAZON_LWA_REFRESH_TOKEN=Atzr|실제값

# AWS 자격 증명 (AWS Console에서 복사)
AMAZON_AWS_ACCESS_KEY_ID=AKIA실제값
AMAZON_AWS_SECRET_ACCESS_KEY=실제값

# Seller ID (Amazon Seller Central에서 확인)
AMAZON_SELLER_ID=A3실제값

# 샌드박스 모드 (반드시 true)
AMAZON_SP_API_SANDBOX=true
```

---

## 🛠️ 샌드박스 초기화

### 1단계: 샌드박스 환경 설정

```bash
# Amazon 샌드박스 환경 초기화
npx medusa exec src/scripts/setup-amazon-sandbox.ts
```

**예상 결과:**
```
🧪 Amazon 샌드박스 환경 설정 시작...
✅ 환경변수 검증 완료
🔄 Amazon.com (Sandbox) - 샌드박스 설정으로 업데이트됨
🔄 Amazon.de (Sandbox) - 샌드박스 설정으로 업데이트됨
🔄 Amazon.co.jp (Sandbox) - 샌드박스 설정으로 업데이트됨

🎉 Amazon 샌드박스 환경 설정 완료!
📊 총 샌드박스 마켓플레이스: 3개
```

### 2단계: 기본 헬스체크

```bash
# 시스템 상태 확인
npx medusa exec src/scripts/test-amazon-health.ts
```

**예상 결과:**
```
🌸 Amazon 통합 시스템 헬스체크 시작
✅ Amazon 통합 모듈 로딩 완료
📊 총 마켓플레이스: 9개
✅ 활성화된 마켓플레이스: 3개
✅ 설정 완료 (8/8)
🎉 Amazon 통합 시스템이 테스트 준비 완료되었습니다!
```

---

## 🧪 테스트 실행

### 3단계: 샌드박스 종합 테스트

```bash
# 샌드박스 전용 테스트 실행
npx medusa exec src/scripts/test-amazon-sandbox.ts
```

**예상 결과:**
```
🧪 Amazon 샌드박스 통합 테스트 시작
⚙️ 1단계: 샌드박스 환경 설정 검증
✅ AMAZON_LWA_CLIENT_ID: 설정됨
✅ AMAZON_SP_API_SANDBOX: 설정됨

🌍 3단계: 샌드박스 마켓플레이스 상세 검증
🟢 Amazon.com (Sandbox) (US)
   ✅ Seller ID: A3SANDBOX123456789
   ✅ 샌드박스 엔드포인트: sandbox.sellingpartnerapi-na.amazon.com

📊 샌드박스 준비도: 10/12 (83%)
🎉 샌드박스 환경이 테스트 준비 완료되었습니다!
```

### 4단계: 완전 통합 검증

```bash
# 전체 시스템 검증
npx medusa exec src/scripts/validate-amazon-integration.ts
```

**예상 결과:**
```
🔍 Amazon 통합 완전 검증 시작
✅ ENVIRONMENT: 9/10 (90%)
✅ DATABASE: 8/8 (100%)
✅ MARKETPLACES: 10/12 (83%)
⚠️ API: 12/15 (80%)
✅ SYNC: 8/10 (80%)
✅ UI: 5/5 (100%)

📊 전체 점수: 52/60 (87%)
🎉 Amazon 통합이 운영 준비 완료되었습니다!
```

---

## 🎮 Admin UI 사용

### 5단계: Admin UI 접속

1. **Amazon 설정 페이지 접속**
   ```
   http://localhost:10000/app/settings/amazon
   ```

2. **주요 기능 테스트**
   - ✅ 마켓플레이스 목록 확인
   - ✅ Seller ID 설정 (연필 아이콘 클릭)
   - ✅ 마켓플레이스 활성화/비활성화 토글
   - ✅ 연결 테스트 버튼 클릭

3. **워크플로우 대시보드 접속**
   ```
   http://localhost:10000/app/workflows
   ```

4. **상품별 동기화 테스트**
   - 테스트 상품 생성
   - 상품 상세 페이지 하단 Amazon 동기화 위젯 확인
   - 개별/전체 동기화 테스트

### Admin UI 샘플 화면

```
📊 Amazon Integration Dashboard
┌─────────────────────────────────────────┐
│ 동기화 상태: 🟢 정상                      │
│ 활성 마켓플레이스: 3개                    │
│ 최근 동기화: 2분 전                       │
└─────────────────────────────────────────┘

🌍 Marketplaces
┌─────────────────┬──────────┬─────────────┐
│ Name            │ Status   │ Actions     │
├─────────────────┼──────────┼─────────────┤
│ Amazon.com (US) │ 🟢 Active │ ✏️ 🧪 🔄   │
│ Amazon.de (DE)  │ 🟢 Active │ ✏️ 🧪 🔄   │
│ Amazon.co.jp    │ 🟢 Active │ ✏️ 🧪 🔄   │
└─────────────────┴──────────┴─────────────┘
```

---

## 🔧 문제 해결

### 자주 발생하는 문제들

#### 1. Seller ID 설정 문제
```bash
⚠️ Seller ID: 설정되지 않음 또는 기본값
```

**해결책:**
1. Amazon Seller Central → Settings → Account Info
2. Merchant Token (Seller ID) 복사
3. Admin UI에서 각 마켓플레이스의 연필 아이콘 클릭
4. Seller ID 필드에 실제 값 입력

#### 2. Dialog 접근성 경고
```bash
Warning: Missing Description or aria-describedby for DialogContent
```

**해결책:** ✅ 이미 수정됨
- Drawer.Title 및 Drawer.Description 컴포넌트 추가
- aria-describedby 속성 설정

#### 3. 환경변수 미설정
```bash
❌ AMAZON_LWA_CLIENT_ID: 설정되지 않음
```

**해결책:**
```bash
# 환경변수 템플릿 재생성
npx medusa exec src/scripts/generate-sandbox-env.ts

# .env 파일 확인 및 수정
cat .env | grep AMAZON_LWA_CLIENT_ID
```

#### 4. 샌드박스 모드 비활성화
```bash
❌ AMAZON_SP_API_SANDBOX가 true로 설정되지 않았습니다
```

**해결책:**
```bash
# .env 파일에서 확인
echo "AMAZON_SP_API_SANDBOX=true" >> .env

# 서버 재시작
npm run dev
```

### 디버깅 명령어

```bash
# 환경변수 확인
env | grep AMAZON

# 데이터베이스 상태 확인
npx medusa db:show

# 모듈 로딩 확인
npx medusa modules:list | grep amazon

# 로그 레벨 증가
DEBUG=medusa:* npx medusa exec src/scripts/test-amazon-sandbox.ts
```

---

## 🚀 다음 단계

### 성공적인 샌드박스 테스트 후

1. **실제 상품 동기화 테스트**
   ```bash
   # 테스트 상품 생성
   curl -X POST http://localhost:10000/admin/products \
     -H "Content-Type: application/json" \
     -d '{"title":"Test K-Beauty Product","status":"published"}'
   
   # Admin UI에서 동기화 테스트
   ```

2. **워크플로우 시스템 테스트**
   - 워크플로우 대시보드에서 각 워크플로우 실행
   - 상품별 Enhanced 동기화 위젯 테스트
   - 배치 동기화 테스트

3. **프로덕션 준비**
   ```bash
   # 프로덕션 환경변수 준비
   cp .env.sandbox .env.production
   
   # 샌드박스 -> 프로덕션 변경사항
   AMAZON_SP_API_SANDBOX=false
   # 실제 프로덕션 자격 증명으로 교체
   ```

4. **실제 Amazon Seller Central 연동**
   - 실제 SP-API 앱으로 전환
   - 프로덕션 마켓플레이스 활성화
   - 실제 상품 동기화 시작

### 성능 최적화

```bash
# 동기화 간격 조정 (프로덕션)
AMAZON_SYNC_INTERVAL_MINUTES=15

# Rate Limiting 조정
AMAZON_RATE_LIMIT_PER_SECOND=10

# 배치 크기 최적화
AMAZON_BATCH_SIZE=25
```

---

## 📚 추가 리소스

### 관련 문서
- 📖 [통합 가이드](README.Amazon-Integration-Guide.md)
- 📋 [테스트 체크리스트](README.Amazon-Testing-Checklist.md)
- 🛠️ [워크플로우 가이드](README-Workflow-Guide.md)

### API 참조
- 🔗 [Amazon SP-API 공식 문서](https://developer-docs.amazon.com/sp-api/)
- 🔗 [Medusa.js v2 문서](https://v2-docs.medusajs.com/)

### Admin UI 접속 링크
- 🎮 [Amazon 설정](http://localhost:10000/app/settings/amazon)
- 🔄 [워크플로우 대시보드](http://localhost:10000/app/workflows)
- 📊 [일반 관리자 패널](http://localhost:10000/app)

---

## 🎯 성공 기준

### ✅ 샌드박스 테스트 완료 조건

- [ ] 모든 환경변수 올바르게 설정
- [ ] 3개 주요 마켓플레이스 활성화 (US, DE, JP)  
- [ ] Seller ID 모든 마켓플레이스에 설정
- [ ] Admin UI 정상 접속 및 기능 동작
- [ ] 연결 테스트 성공
- [ ] 테스트 상품 동기화 성공
- [ ] 워크플로우 시스템 정상 동작

### 📊 점수 기준
- **90% 이상**: 🎉 운영 준비 완료
- **70-89%**: ⚠️ 개선 필요하지만 테스트 가능
- **70% 미만**: ❌ 추가 설정 필요

---

**🌸 kbeauty.market Amazon Integration Team**  
*Making K-Beauty accessible worldwide through seamless Amazon integration*

---

> **최종 업데이트**: 2025-01-26  
> **버전**: 2.0.0  
> **테스트 환경**: Medusa.js 2.0 + Amazon SP-API Sandbox ✅  
> **준비 상태**: 완전 구현 완료 🚀