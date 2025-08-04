import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as fs from "fs"
import * as path from "path"

/**
 * Amazon 샌드박스 환경변수 템플릿 생성 스크립트
 * 
 * 개발자가 쉽게 샌드박스 테스트를 시작할 수 있도록
 * 샘플 환경변수 파일을 생성합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/generate-sandbox-env.ts
 */
export default async function generateSandboxEnv({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🧪 Amazon 샌드박스 환경변수 템플릿 생성 시작...')

  const envTemplate = `# 🧪 Amazon 통합 샌드박스 테스트 환경 설정
# 이 파일을 .env로 복사하여 사용하세요: cp .env.sandbox .env
# ⚠️ 주의: 아래 값들을 Amazon Developer Console에서 발급받은 실제 샌드박스 자격 증명으로 교체하세요

# Database Configuration
DATABASE_URL=postgres://medusa:medusa@localhost:10002/kbeauty_market

# Redis Configuration  
REDIS_URL=redis://localhost:10003

# Server Configuration
PORT=10000
HOST=0.0.0.0

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-sandbox
COOKIE_SECRET=your-super-secret-cookie-key-sandbox

# Admin Configuration
ADMIN_PATH=/app
ADMIN_CORS=http://localhost:10000,http://localhost:9000
STORE_CORS=http://localhost:10004

# Backend URL for Admin UI
MEDUSA_BACKEND_URL=http://localhost:10000

# ===== AMAZON SP-API 샌드박스 설정 =====
# 🔥 중요: 이 값들을 Amazon Developer Console에서 실제 값으로 교체하세요

# LWA (Login with Amazon) 설정 - Amazon Developer Console에서 발급
AMAZON_LWA_CLIENT_ID=amzn1.application-oa2-client.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AMAZON_LWA_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AMAZON_LWA_REFRESH_TOKEN=Atzr|XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# AWS 자격 증명 (SP-API 접근용) - AWS Console에서 발급
AMAZON_AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AMAZON_AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AMAZON_AWS_REGION=us-east-1

# Amazon SP-API 설정
AMAZON_SP_API_REGION=na
AMAZON_SP_API_SANDBOX=true

# 샌드박스 테스트용 Seller ID - Amazon Seller Central에서 확인
AMAZON_SELLER_ID=A3XXXXXXXXXXXXXXX

# Amazon 통합 모듈 설정
AMAZON_INTEGRATION_ENABLED=true
AMAZON_AUTO_SYNC_ENABLED=true
AMAZON_SYNC_INTERVAL_MINUTES=30
AMAZON_MAX_RETRY_ATTEMPTS=3
AMAZON_RATE_LIMIT_PER_SECOND=10

# Admin UI 환경 변수 (VITE_ 접두사 필수)
VITE_MEDUSA_BACKEND_URL=http://localhost:10000
VITE_AMAZON_INTEGRATION_ENABLED=true
VITE_AMAZON_INTEGRATION_DEBUG=true
VITE_AMAZON_SELLER_ID=A3XXXXXXXXXXXXXXX

# ⚠️ 중요: Admin UI 개발 시 아래 설정을 사용하세요
# 로컬 개발: http://localhost:10000
# 프로덕션: https://api.kbeauty.market

# 테스트용 마켓플레이스 설정 (주요 3개국)
AMAZON_MARKETPLACE_IDS=ATVPDKIKX0DER,A1PA6795UKMFR9,A1VC38T7YXB528

# Environment
NODE_ENV=development

# ===== 📋 설정 가이드 =====
# 
# 1. Amazon Developer Console 설정:
#    - https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html
#    - 새 보안 프로필 생성
#    - LWA_CLIENT_ID, LWA_CLIENT_SECRET 복사
#
# 2. Amazon Seller Central 설정:  
#    - https://sellercentral.amazon.com/
#    - Apps & Services → Develop apps
#    - SP-API 앱 생성 및 승인
#    - Refresh Token 생성
#
# 3. AWS Console 설정:
#    - https://console.aws.amazon.com/iam/
#    - SP-API 전용 IAM 사용자 생성
#    - 적절한 권한 정책 연결
#    - Access Key 생성 및 복사
#
# 4. Seller ID 확인:
#    - Seller Central → Settings → Account Info
#    - Merchant Token (Seller ID) 복사
#
# ===== 🧪 테스트 순서 =====
#
# 1. 환경변수 설정 완료 후:
#    npx medusa exec src/scripts/setup-amazon-sandbox.ts
#
# 2. 샌드박스 테스트 실행:
#    npx medusa exec src/scripts/test-amazon-sandbox.ts
#
# 3. Admin UI 접속:
#    http://localhost:10000/app/settings/amazon
#
# 4. 연결 테스트 및 상품 동기화 테스트
#
# ===== 🔒 보안 참고사항 =====
#
# - 이 파일을 .gitignore에 추가하세요
# - 샌드박스 자격 증명도 실제 자격 증명과 동일하게 보안 관리하세요
# - 프로덕션 배포 시 반드시 AMAZON_SP_API_SANDBOX=false로 변경하세요
# - 환경변수는 서버 재시작 후 적용됩니다`

  try {
    // 프로젝트 루트 경로 찾기
    const projectRoot = process.cwd()
    const envSandboxPath = path.join(projectRoot, '.env.sandbox')
    const envExamplePath = path.join(projectRoot, '.env.example')
    
    // .env.sandbox 파일 생성
    fs.writeFileSync(envSandboxPath, envTemplate)
    logger.info(`✅ .env.sandbox 파일이 생성되었습니다: ${envSandboxPath}`)
    
    // .env.example 파일이 있다면 백업
    if (fs.existsSync(envExamplePath)) {
      const backupPath = path.join(projectRoot, '.env.example.backup')
      fs.copyFileSync(envExamplePath, backupPath)
      logger.info(`💾 기존 .env.example을 백업했습니다: ${backupPath}`)
    }
    
    // .env.example 업데이트
    fs.writeFileSync(envExamplePath, envTemplate)
    logger.info(`🔄 .env.example 파일이 업데이트되었습니다: ${envExamplePath}`)

    logger.info(`\n🎉 Amazon 샌드박스 환경변수 템플릿 생성 완료!`)
    
    logger.info(`\n📝 다음 단계:`)
    logger.info(`1. .env.sandbox 파일을 .env로 복사:`)
    logger.info(`   cp .env.sandbox .env`)
    logger.info(`\n2. Amazon Developer Console에서 SP-API 앱 등록`)
    logger.info(`3. .env 파일의 더미 값들을 실제 샌드박스 자격 증명으로 교체`)
    logger.info(`4. 샌드박스 설정 스크립트 실행:`)
    logger.info(`   npx medusa exec src/scripts/setup-amazon-sandbox.ts`)
    logger.info(`\n5. 샌드박스 테스트 실행:`)
    logger.info(`   npx medusa exec src/scripts/test-amazon-sandbox.ts`)

    logger.info(`\n🔐 보안 알림:`)
    logger.info(`- .env 파일을 .gitignore에 추가하세요`)
    logger.info(`- 샌드박스 자격 증명도 안전하게 관리하세요`)
    logger.info(`- 절대 공개 저장소에 자격 증명을 업로드하지 마세요`)

    logger.info(`\n📚 추가 가이드:`)
    logger.info(`- 통합 가이드: README.Amazon-Integration-Guide.md`)
    logger.info(`- 테스트 체크리스트: README.Amazon-Testing-Checklist.md`)
    logger.info(`- 워크플로우 가이드: README-Workflow-Guide.md`)

  } catch (error) {
    logger.error(`❌ 환경변수 템플릿 생성 중 오류 발생:`, error)
    throw error
  }
}