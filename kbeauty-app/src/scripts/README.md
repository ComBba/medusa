# 🛠 Amazon Integration Scripts

K-Beauty 프로젝트의 Amazon SP-API 통합을 위한 관리 스크립트 모음입니다.

## 📋 스크립트 목록

### 🔧 설정 및 초기화
| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `setup-amazon-integration.ts` | Amazon 통합 초기 설정 | `npm run exec src/scripts/setup-amazon-integration.ts` |
| `setup-amazon-sandbox.ts` | Amazon 샌드박스 환경 설정 | `npm run exec src/scripts/setup-amazon-sandbox.ts` |
| `generate-sandbox-env.ts` | 샌드박스 환경 변수 생성 | `npm run exec src/scripts/generate-sandbox-env.ts` |

### 🔍 테스트 및 검증
| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `test-amazon-api-connection.ts` | Amazon SP-API 연결 테스트 | `npm run exec src/scripts/test-amazon-api-connection.ts` |
| `test-amazon-sandbox.ts` | 샌드박스 환경 종합 테스트 | `npm run exec src/scripts/test-amazon-sandbox.ts` |
| `test-amazon-health.ts` | Amazon 서비스 상태 체크 | `npm run exec src/scripts/test-amazon-health.ts` |
| `test-amazon-simple.ts` | 기본 Amazon API 테스트 | `npm run exec src/scripts/test-amazon-simple.ts` |
| `test-amazon-sync.ts` | 동기화 기능 테스트 | `npm run exec src/scripts/test-amazon-sync.ts` |
| `test-extended-amazon-integration.ts` | 확장 통합 기능 테스트 | `npm run exec src/scripts/test-extended-amazon-integration.ts` |
| `simple-sandbox-test.ts` | 간단한 샌드박스 테스트 | `npm run exec src/scripts/simple-sandbox-test.ts` |

### 🌍 마켓플레이스 관리
| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `activate-marketplace.ts` | 마켓플레이스 활성화 | `npm run exec src/scripts/activate-marketplace.ts` |
| `force-activate-marketplace.ts` | 강제 마켓플레이스 활성화 | `npm run exec src/scripts/force-activate-marketplace.ts` |
| `simple-activate.ts` | 간단한 마켓플레이스 활성화 | `npm run exec src/scripts/simple-activate.ts` |
| `fix-marketplace-activation.ts` | 마켓플레이스 활성화 문제 해결 | `npm run exec src/scripts/fix-marketplace-activation.ts` |

### 🔧 디버깅 및 수정
| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `debug-marketplace-toggle.ts` | 마켓플레이스 토글 디버그 | `npm run exec src/scripts/debug-marketplace-toggle.ts` |
| `diagnose-admin-ui-config.ts` | Admin UI 설정 진단 | `npm run exec src/scripts/diagnose-admin-ui-config.ts` |
| `validate-amazon-integration.ts` | 통합 상태 검증 | `npm run exec src/scripts/validate-amazon-integration.ts` |

### 💾 데이터베이스 관리
| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `raw-sql-activate.ts` | 원시 SQL로 활성화 | `npm run exec src/scripts/raw-sql-activate.ts` |
| `direct-db-activate.ts` | 직접 DB 활성화 | `npm run exec src/scripts/direct-db-activate.ts` |
| `force-direct-update.ts` | 강제 직접 업데이트 | `npm run exec src/scripts/force-direct-update.ts` |

### 📊 데이터 시드
| 스크립트 | 설명 | 사용법 |
|---------|------|--------|
| `seed.ts` | 초기 데이터 생성 | `npm run seed` |

## 🚀 일반적인 사용 워크플로우

### 1. 초기 설정
```bash
# Amazon 통합 초기 설정
npm run exec src/scripts/setup-amazon-integration.ts

# 샌드박스 환경 설정
npm run exec src/scripts/setup-amazon-sandbox.ts
```

### 2. 연결 테스트
```bash
# API 연결 테스트
npm run exec src/scripts/test-amazon-api-connection.ts

# 전체 기능 테스트
npm run exec src/scripts/test-amazon-sandbox.ts
```

### 3. 마켓플레이스 활성화
```bash
# 마켓플레이스 활성화
npm run exec src/scripts/activate-marketplace.ts

# 활성화 확인
npm run exec src/scripts/validate-amazon-integration.ts
```

### 4. 문제 해결
```bash
# 통합 상태 진단
npm run exec src/scripts/validate-amazon-integration.ts

# 마켓플레이스 문제 해결
npm run exec src/scripts/fix-marketplace-activation.ts
```

## 📝 스크립트 실행 규칙

### 명령어 형식
```bash
npm run exec src/scripts/[스크립트명].ts [인수1] [인수2]
```

### 환경 변수 확인
스크립트 실행 전 `.env` 파일에서 다음 변수들이 설정되어 있는지 확인하세요:
- `AMAZON_LWA_CLIENT_ID`
- `AMAZON_LWA_CLIENT_SECRET`
- `AMAZON_LWA_REFRESH_TOKEN`
- `AMAZON_SELLER_ID`
- `AMAZON_SP_API_SANDBOX`

### 로깅 및 출력
모든 스크립트는 상세한 로그를 제공하며, 에러 발생 시 문제 해결 가이드를 표시합니다.

## ⚠️ 주의사항

1. **샌드박스 환경**: 테스트 시에는 반드시 `AMAZON_SP_API_SANDBOX=true` 설정
2. **Rate Limiting**: Amazon SP-API 호출 제한을 준수하여 스크립트 실행
3. **데이터 백업**: 데이터베이스 관련 스크립트 실행 전 백업 권장
4. **환경 분리**: 개발/스테이징/프로덕션 환경을 명확히 구분하여 사용

## 🔗 관련 문서

- [Amazon 통합 가이드](../../README.Amazon-Integration-Guide.md)
- [Amazon 샌드박스 완전 가이드](../../README.Amazon-Sandbox-Complete-Guide.md)
- [Amazon 테스팅 체크리스트](../../README.Amazon-Testing-Checklist.md)