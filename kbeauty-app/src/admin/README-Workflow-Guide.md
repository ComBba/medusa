# 🚀 Amazon 워크플로우 관리 가이드

> **Admin UI에서 Amazon 통합 워크플로우를 관리하고 실행하는 완전 가이드**

## 📋 목차

1. [시스템 개요](#-시스템-개요)
2. [워크플로우 대시보드](#-워크플로우-대시보드)
3. [상품별 Enhanced 위젯](#-상품별-enhanced-위젯)
4. [API 참조](#-api-참조)
5. [사용법 가이드](#-사용법-가이드)

---

## 🌟 시스템 개요

### 새롭게 추가된 기능

**✅ 워크플로우 관리 대시보드**
- **위치**: `/app/workflows`
- **기능**: 등록된 모든 Amazon 워크플로우 목록 및 실행
- **접근**: Admin 사이드바 → "워크플로우" 메뉴

**✅ Enhanced 동기화 위젯**
- **위치**: 상품 상세 페이지 하단
- **기능**: 상품별 고급 워크플로우 실행
- **특징**: Medusa v2 표준 패턴 적용한 enhanced 워크플로우 지원

**✅ 워크플로우 실행 API**
- **엔드포인트**: `/admin/workflows/[id]/execute`
- **기능**: 프로그래밍 방식 워크플로우 실행
- **지원**: 동기/비동기 실행 모드

---

## 🎛️ 워크플로우 대시보드

### 접속 방법
```
로컬: http://localhost:9000/app/workflows
프로덕션: https://admin.kbeauty.market/app/workflows
```

### 지원 워크플로우 목록

| 워크플로우 ID | 이름 | 설명 | 버전 |
|--------------|------|------|------|
| `amazon-sync-product` | Amazon 상품 동기화 | 기본 상품 정보 동기화 | v1.0 |
| `amazon-sync-inventory` | Amazon 재고 동기화 | 재고 수량 동기화 | v1.0 |
| `amazon-sync-price` | Amazon 가격 동기화 | 가격 정보 동기화 | v1.0 |
| `amazon-sync-enhanced` | **Amazon 고급 동기화** | **Medusa v2 표준 패턴 적용** | **v2.0** ⭐ |
| `amazon-sync-all-enhanced` | **Amazon 통합 동기화** | **올인원 동기화 워크플로우** | **v2.0** ⭐ |

### 대시보드 기능

**📊 워크플로우 상태 모니터링**
- 실시간 상태 표시 (Active/Inactive/Error)
- 마지막 실행 시간 추적
- 총 실행 횟수 통계
- 카테고리별 분류 (Amazon Integration)

**▶️ 원클릭 워크플로우 실행**
- 테스트용 입력 데이터 자동 생성
- 백그라운드 비동기 실행
- 실시간 성공/실패 알림
- 실행 시간 측정

---

## 🎯 상품별 Enhanced 위젯

### 위치 및 특징
- **위치**: 상품 상세 페이지 → 하단 "Enhanced Amazon 동기화" 위젯
- **디자인**: 최신 Medusa UI 컴포넌트 사용
- **기능**: 상품별 맞춤형 워크플로우 실행

### 위젯 기능

**🌍 마켓플레이스 선택**
```
✅ 다중 마켓플레이스 선택 지원
✅ 국가코드 기반 직관적 UI (US, DE, JP, UK...)
✅ 실시간 활성 마켓플레이스 동기화
```

**⚙️ 고급 동기화 옵션**
```
🔹 상품 변형 포함       - 모든 variant 동기화 여부
🔹 이미지 동기화       - 제품 이미지 포함 여부  
🔹 강제 업데이트       - 기존 데이터 덮어쓰기 여부
```

**🚀 워크플로우 실행 버튼**
```
📘 Enhanced 동기화    - amazon-sync-enhanced 워크플로우
📗 통합 동기화        - amazon-sync-all-enhanced 워크플로우
```

---

## 📚 API 참조

### 워크플로우 목록 조회
```http
GET /admin/workflows
```

**응답 예시**:
```json
{
  "workflows": [
    {
      "id": "amazon-sync-enhanced",
      "name": "Amazon 고급 동기화 (Enhanced)",
      "description": "향상된 Amazon 동기화 워크플로우 (Medusa v2 표준 패턴 적용)",
      "category": "Amazon Integration",
      "status": "active",
      "last_executed": null,
      "execution_count": 0,
      "input_schema": {
        "product": { "type": "object", "required": true },
        "marketplace_ids": { "type": "array", "required": false },
        "options": { "type": "object", "required": false }
      }
    }
  ],
  "count": 5
}
```

### 워크플로우 실행
```http
POST /admin/workflows/{workflowId}/execute
```

**요청 예시**:
```json
{
  "input": {
    "product": { "id": "prod_123" },
    "marketplace_ids": ["ATVPDKIKX0DER"],
    "options": {
      "sync_images": true,
      "include_variants": true,
      "force_update": false
    }
  },
  "options": {
    "async": true
  }
}
```

**응답 예시** (비동기):
```json
{
  "message": "워크플로우가 백그라운드에서 실행되었습니다",
  "workflow_id": "amazon-sync-enhanced",
  "execution_id": "exec_1706234567890",
  "status": "running"
}
```

---

## 🎮 사용법 가이드

### 1. 워크플로우 대시보드에서 실행

**단계별 가이드**:
```
1. Admin 로그인 → 사이드바 "워크플로우" 클릭
2. 실행할 워크플로우 선택 (추천: amazon-sync-enhanced)
3. "실행 (테스트)" 버튼 클릭
4. 성공 토스트 알림 확인
5. 실행 상태 모니터링
```

### 2. 상품별 Enhanced 위젯 사용

**단계별 가이드**:
```
1. Products → 특정 상품 클릭
2. 페이지 하단 "Enhanced Amazon 동기화" 위젯 확인
3. 마켓플레이스 선택 (US, DE, JP 등)
4. 동기화 옵션 설정
   - 상품 변형 포함: ON (권장)
   - 이미지 동기화: ON (권장)  
   - 강제 업데이트: OFF (일반적)
5. "Enhanced 동기화" 또는 "통합 동기화" 실행
6. 백그라운드 실행 완료 대기
```

### 3. Medusa JS SDK 사용

**프로그래밍 방식 실행**:
```typescript
import { sdk } from '../admin/lib/config'

// Enhanced 워크플로우 실행
const result = await sdk.client.fetch('/admin/workflows/amazon-sync-enhanced/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    input: {
      product: { id: 'prod_123' },
      marketplace_ids: ['ATVPDKIKX0DER', 'A1PA6795UKMFR9'],
      options: {
        sync_images: true,
        include_variants: true,
        force_update: false
      }
    },
    options: { async: true }
  })
})

console.log('워크플로우 실행 결과:', result)
```

---

## 🌟 주요 차별화 특징

### **Medusa v2 표준 준수** ⭐
```
✅ when().then() 조건부 실행 패턴
✅ transform() 데이터 변환 함수  
✅ runAsStep() 워크플로우 재사용
✅ 완벽한 보상 함수 (rollback)
✅ TypeScript 타입 안전성
```

### **K-Beauty 비즈니스 최적화** 🌸
```
✅ 9개국 Amazon 마켓플레이스 지원
✅ 다중 통화 환경 대응
✅ 한국 화장품 특화 설정
✅ 실시간 상태 모니터링
```

### **사용자 친화적 Admin UI** 🎨
```
✅ 최신 Medusa UI 컴포넌트
✅ 직관적인 워크플로우 대시보드
✅ 상품별 맞춤형 동기화 위젯
✅ 실시간 성공/실패 피드백
```

---

## 🎯 다음 단계

### **확장 계획**
1. **워크플로우 스케줄링**: cron 기반 자동 실행
2. **실행 이력 관리**: 상세 로그 및 실행 기록
3. **워크플로우 모니터링**: 실시간 진행 상황 추적
4. **커스텀 워크플로우**: 사용자 정의 동기화 로직

### **성능 최적화**
1. **배치 처리**: 대량 상품 동시 동기화
2. **캐싱 전략**: 마켓플레이스 정보 캐싱
3. **Rate Limiting**: Amazon API 호출 제한 준수

---

## 📞 지원

**문의 및 지원**:
- GitHub Issues: [ComBba/medusa/issues](https://github.com/ComBba/medusa/issues)
- 개발팀: kbeauty.market Amazon Integration Team
- 문서: `README.Amazon-Integration-Guide.md`

---

**🌸 kbeauty.market Workflow Management System**  
*Empowering K-Beauty global expansion through advanced workflow automation*

---

> **최종 업데이트**: 2025-01-26  
> **버전**: 2.0.0  
> **상태**: 완전 구현 완료 ✅ Enhanced Workflows ✅ Admin Dashboard ✅  
> **준비 상태**: 100% 완료 🚀