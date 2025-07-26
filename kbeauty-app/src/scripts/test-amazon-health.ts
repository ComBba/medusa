import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Amazon 통합 시스템 헬스체크 테스트
 * 
 * 기본적인 설정과 연결 상태를 확인합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/test-amazon-health.ts
 */
export default async function testAmazonHealth({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🌸 Amazon 통합 시스템 헬스체크 시작')

  try {
    // ===========================================
    // 1. 모듈 로딩 검증
    // ===========================================
    
    logger.info('📦 1단계: 모듈 로딩 검증')
    
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    if (!amazonService) {
      throw new Error('Amazon 통합 모듈이 로드되지 않았습니다')
    }
    
    logger.info('✅ Amazon 통합 모듈 로딩 완료')

    // ===========================================
    // 2. 데이터베이스 연결 및 마켓플레이스 확인
    // ===========================================
    
    logger.info('🗄️ 2단계: 데이터베이스 및 마켓플레이스 확인')
    
    const marketplaces = await amazonService.getActiveMarketplaces()
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    
    logger.info(`📊 총 마켓플레이스: ${allMarketplaces.length}개`)
    logger.info(`✅ 활성화된 마켓플레이스: ${marketplaces.length}개`)
    
    // 마켓플레이스 목록 출력
    allMarketplaces.forEach(marketplace => {
      logger.info(`   ${marketplace.is_active ? '🟢' : '⚪'} ${marketplace.name} (${marketplace.country_code}) - ${marketplace.marketplace_id}`)
    })

    // ===========================================
    // 3. 환경 변수 설정 확인
    // ===========================================
    
    logger.info('⚙️ 3단계: 환경 변수 설정 확인')
    
    const envVars = {
      'AMAZON_LWA_CLIENT_ID': process.env.AMAZON_LWA_CLIENT_ID,
      'AMAZON_LWA_CLIENT_SECRET': process.env.AMAZON_LWA_CLIENT_SECRET,
      'AMAZON_LWA_REFRESH_TOKEN': process.env.AMAZON_LWA_REFRESH_TOKEN,
      'AMAZON_AWS_ACCESS_KEY_ID': process.env.AMAZON_AWS_ACCESS_KEY_ID,
      'AMAZON_AWS_SECRET_ACCESS_KEY': process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
      'AMAZON_SELLER_ID': process.env.AMAZON_SELLER_ID,
      'AMAZON_SP_API_SANDBOX': process.env.AMAZON_SP_API_SANDBOX,
      'AMAZON_INTEGRATION_ENABLED': process.env.AMAZON_INTEGRATION_ENABLED,
    }

    let configuredCount = 0
    let missingConfig = []

    Object.entries(envVars).forEach(([key, value]) => {
      if (value && value !== 'your-' + key.toLowerCase().replace(/_/g, '-')) {
        logger.info(`✅ ${key}: 설정됨`)
        configuredCount++
      } else {
        logger.info(`⚠️ ${key}: 미설정 또는 기본값`)
        missingConfig.push(key)
      }
    })

    // ===========================================
    // 4. 동기화 상태 확인
    // ===========================================
    
    logger.info('📊 4단계: 동기화 상태 확인')
    
    const syncStats = await amazonService.getSyncStatistics()
    logger.info(`📈 동기화 통계:`)
    logger.info(`   - 총 동기화 레코드: ${syncStats.total}개`)
    logger.info(`   - 진행 중: ${syncStats.processing}개`)
    logger.info(`   - 완료: ${syncStats.completed}개`)
    logger.info(`   - 실패: ${syncStats.failed}개`)
    logger.info(`   - 대기 중: ${syncStats.pending}개`)

    // ===========================================
    // 5. 종합 결과
    // ===========================================
    
    logger.info('🎯 5단계: 종합 결과')
    
    const healthScore = {
      moduleLoaded: true,
      databaseConnected: allMarketplaces.length > 0,
      configurationComplete: configuredCount >= 6, // 최소 6개 필수 설정
      sandboxMode: process.env.AMAZON_SP_API_SANDBOX === 'true',
      readyForTesting: configuredCount >= 6 && process.env.AMAZON_SP_API_SANDBOX === 'true'
    }

    logger.info('📋 헬스체크 결과:')
    logger.info(`   ${healthScore.moduleLoaded ? '✅' : '❌'} 모듈 로딩`)
    logger.info(`   ${healthScore.databaseConnected ? '✅' : '❌'} 데이터베이스 연결`)
    logger.info(`   ${healthScore.configurationComplete ? '✅' : '⚠️'} 설정 완료 (${configuredCount}/8)`)
    logger.info(`   ${healthScore.sandboxMode ? '✅' : '⚠️'} 샌드박스 모드`)
    logger.info(`   ${healthScore.readyForTesting ? '✅' : '❌'} 테스트 준비`)

    if (healthScore.readyForTesting) {
      logger.info('\n🎉 Amazon 통합 시스템이 테스트 준비 완료되었습니다!')
      logger.info('📝 다음 단계: npx medusa exec src/scripts/test-amazon-sync.ts')
    } else {
      logger.info('\n⚠️ Amazon 통합 시스템 설정이 완료되지 않았습니다.')
      if (missingConfig.length > 0) {
        logger.info('🔧 다음 환경 변수를 설정하세요:')
        missingConfig.forEach(key => {
          logger.info(`   - ${key}`)
        })
      }
      logger.info('📚 설정 가이드: README.amazon-integration.md 참조')
    }

  } catch (error) {
    logger.error('💥 Amazon 통합 시스템 헬스체크 실패:', {
      error: error.message,
      stack: error.stack
    })
    throw error
  }
} 