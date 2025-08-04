import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Admin UI 설정 진단 스크립트
 * 
 * Admin UI에서 발생하는 설정 문제를 진단하고 해결 방법을 제시합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/diagnose-admin-ui-config.ts
 */
export default async function diagnoseAdminUIConfig({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🔍 Admin UI 설정 진단 시작')
  logger.info('=' .repeat(60))

  const issues: string[] = []
  const recommendations: string[] = []

  try {
    // ===========================================
    // 1. 환경변수 검증
    // ===========================================
    
    logger.info('\n📋 1단계: 환경변수 검증')
    
    const requiredEnvVars = {
      'VITE_MEDUSA_BACKEND_URL': process.env.VITE_MEDUSA_BACKEND_URL,
      'VITE_AMAZON_INTEGRATION_ENABLED': process.env.VITE_AMAZON_INTEGRATION_ENABLED,
      'VITE_AMAZON_SELLER_ID': process.env.VITE_AMAZON_SELLER_ID,
    }

    const backendEnvVars = {
      'AMAZON_SELLER_ID': process.env.AMAZON_SELLER_ID,
      'AMAZON_INTEGRATION_ENABLED': process.env.AMAZON_INTEGRATION_ENABLED,
      'AMAZON_SP_API_SANDBOX': process.env.AMAZON_SP_API_SANDBOX,
      'MEDUSA_BACKEND_URL': process.env.MEDUSA_BACKEND_URL,
    }

    // VITE 환경변수 확인
    logger.info('\n🎮 Admin UI 환경변수 (VITE_):')
    Object.entries(requiredEnvVars).forEach(([key, value]) => {
      if (value) {
        logger.info(`✅ ${key}: ${value}`)
      } else {
        logger.error(`❌ ${key}: 설정되지 않음`)
        issues.push(`${key} 환경변수 미설정`)
      }
    })

    // 백엔드 환경변수 확인
    logger.info('\n🖥️ 백엔드 환경변수:')
    Object.entries(backendEnvVars).forEach(([key, value]) => {
      if (value) {
        logger.info(`✅ ${key}: ${value}`)
      } else {
        logger.warn(`⚠️ ${key}: 설정되지 않음`)
      }
    })

    // ===========================================
    // 2. Backend URL 검증
    // ===========================================
    
    logger.info('\n🔗 2단계: Backend URL 검증')
    
    const viteBackendUrl = process.env.VITE_MEDUSA_BACKEND_URL
    const backendUrl = process.env.MEDUSA_BACKEND_URL

    if (viteBackendUrl) {
      if (viteBackendUrl.includes('localhost') || viteBackendUrl.includes('127.0.0.1')) {
        logger.info(`✅ Admin UI가 로컬 백엔드 사용: ${viteBackendUrl}`)
      } else if (viteBackendUrl.includes('kbeauty.market')) {
        logger.warn(`⚠️ Admin UI가 프로덕션 백엔드 사용: ${viteBackendUrl}`)
        logger.warn(`   로컬 개발에서는 http://localhost:10000 사용 권장`)
        recommendations.push('VITE_MEDUSA_BACKEND_URL을 http://localhost:10000으로 설정')
      } else {
        logger.info(`ℹ️ Admin UI Backend URL: ${viteBackendUrl}`)
      }
    } else {
      logger.error(`❌ VITE_MEDUSA_BACKEND_URL이 설정되지 않음`)
      issues.push('VITE_MEDUSA_BACKEND_URL 필수 설정')
    }

    // ===========================================
    // 3. Seller ID 설정 검증
    // ===========================================
    
    logger.info('\n🆔 3단계: Seller ID 설정 검증')
    
    const viteSellerID = process.env.VITE_AMAZON_SELLER_ID
    const backendSellerID = process.env.AMAZON_SELLER_ID

    if (viteSellerID) {
      if (viteSellerID.includes('XXXX') || viteSellerID.includes('your-')) {
        logger.warn(`⚠️ VITE_AMAZON_SELLER_ID가 더미값: ${viteSellerID}`)
        recommendations.push('VITE_AMAZON_SELLER_ID를 실제 Seller ID로 교체')
      } else if (viteSellerID.startsWith('A') && viteSellerID.length >= 10) {
        logger.info(`✅ VITE_AMAZON_SELLER_ID 형식 올바름: ${viteSellerID}`)
      } else {
        logger.warn(`⚠️ VITE_AMAZON_SELLER_ID 형식 의심스러움: ${viteSellerID}`)
        recommendations.push('Amazon Seller Central에서 올바른 Seller ID 확인')
      }
    } else {
      logger.warn(`⚠️ VITE_AMAZON_SELLER_ID 설정되지 않음`)
      recommendations.push('VITE_AMAZON_SELLER_ID 설정 (Admin UI에서 기본값으로 사용)')
    }

    if (backendSellerID) {
      logger.info(`✅ 백엔드 AMAZON_SELLER_ID: ${backendSellerID}`)
    } else {
      logger.warn(`⚠️ 백엔드 AMAZON_SELLER_ID 설정되지 않음`)
    }

    // ===========================================
    // 4. 샌드박스 모드 검증
    // ===========================================
    
    logger.info('\n🧪 4단계: 샌드박스 모드 검증')
    
    const sandboxMode = process.env.AMAZON_SP_API_SANDBOX
    
    if (sandboxMode === 'true') {
      logger.info(`✅ 샌드박스 모드 활성화됨`)
    } else if (sandboxMode === 'false') {
      logger.warn(`⚠️ 프로덕션 모드 활성화됨 (개발 중에는 샌드박스 권장)`)
      recommendations.push('개발 중에는 AMAZON_SP_API_SANDBOX=true 설정')
    } else {
      logger.error(`❌ AMAZON_SP_API_SANDBOX 설정되지 않음`)
      issues.push('AMAZON_SP_API_SANDBOX 설정 필요')
    }

    // ===========================================
    // 5. 파일 존재 확인
    // ===========================================
    
    logger.info('\n📁 5단계: 설정 파일 확인')
    
    const fs = require('fs')
    const path = require('path')
    
    const projectRoot = process.cwd()
    const envFile = path.join(projectRoot, '.env')
    const envSandboxFile = path.join(projectRoot, '.env.sandbox')
    
    if (fs.existsSync(envFile)) {
      logger.info(`✅ .env 파일 존재: ${envFile}`)
      
      try {
        const envContent = fs.readFileSync(envFile, 'utf8')
        const viteLines = envContent.split('\n').filter(line => line.startsWith('VITE_'))
        
        if (viteLines.length > 0) {
          logger.info(`✅ .env 파일에 VITE_ 환경변수 ${viteLines.length}개 발견`)
        } else {
          logger.warn(`⚠️ .env 파일에 VITE_ 환경변수가 없음`)
          recommendations.push('.env 파일에 VITE_ 환경변수 추가')
        }
      } catch (error) {
        logger.warn(`⚠️ .env 파일 읽기 실패: ${error.message}`)
      }
    } else {
      logger.error(`❌ .env 파일이 존재하지 않음: ${envFile}`)
      issues.push('.env 파일 생성 필요')
    }

    if (fs.existsSync(envSandboxFile)) {
      logger.info(`✅ .env.sandbox 템플릿 존재: ${envSandboxFile}`)
    } else {
      logger.warn(`⚠️ .env.sandbox 템플릿이 없음`)
      recommendations.push('npx medusa exec src/scripts/generate-sandbox-env.ts 실행')
    }

    // ===========================================
    // 6. 종합 진단 결과
    // ===========================================
    
    logger.info('\n' + '='.repeat(60))
    logger.info('📊 Admin UI 설정 진단 결과')
    logger.info('='.repeat(60))

    if (issues.length === 0) {
      logger.info('\n🎉 모든 설정이 올바르게 구성되었습니다!')
      
      if (recommendations.length > 0) {
        logger.info('\n💡 추가 권장사항:')
        recommendations.forEach(rec => {
          logger.info(`   • ${rec}`)
        })
      }
      
      logger.info('\n📝 다음 단계:')
      logger.info('1. Admin UI 재시작: npm run dev')
      logger.info('2. 브라우저 새로고침 및 캐시 초기화')
      logger.info('3. Admin UI 접속: http://localhost:9000/app/settings/amazon')
      logger.info('4. 개발자 도구 콘솔에서 에러 확인')
      
    } else {
      logger.error('\n🚨 설정 문제가 발견되었습니다!')
      
      logger.error('\n❌ 해결해야 할 문제들:')
      issues.forEach(issue => {
        logger.error(`   • ${issue}`)
      })
      
      if (recommendations.length > 0) {
        logger.info('\n🔧 권장 해결방법:')
        recommendations.forEach(rec => {
          logger.info(`   • ${rec}`)
        })
      }
      
      logger.info('\n🛠️ 빠른 해결 방법:')
      logger.info('1. 환경변수 템플릿 재생성:')
      logger.info('   npx medusa exec src/scripts/generate-sandbox-env.ts')
      logger.info('2. 생성된 .env.sandbox를 .env로 복사:')
      logger.info('   cp .env.sandbox .env')
      logger.info('3. .env 파일에서 더미값을 실제값으로 교체')
      logger.info('4. 서버 재시작: npm run dev')
    }

    logger.info('\n📚 추가 도움말:')
    logger.info('• 환경변수 가이드: README.Amazon-Sandbox-Complete-Guide.md')
    logger.info('• Seller ID 설정: README.Amazon-Seller-ID-Fix.md')
    logger.info('• 전체 가이드: README.Amazon-Integration-Guide.md')

  } catch (error) {
    logger.error(`💥 진단 중 오류 발생: ${error.message}`)
    throw error
  }
}