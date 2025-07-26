import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 간단한 Amazon 통합 테스트
 * 
 * 현재 사용 가능한 기능만으로 Amazon 통합 상태를 확인합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/test-amazon-simple.ts
 */
export default async function testAmazonSimple({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🌸 Amazon 통합 간단 테스트 시작')

  try {
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 1. 모듈 로딩 확인
    logger.info('📦 1단계: 모듈 및 서비스 확인')
    logger.info('✅ Amazon 통합 모듈 로딩 완료')
    
    // 2. 데이터베이스 연결 및 마켓플레이스 확인
    logger.info('🗄️ 2단계: 데이터베이스 및 마켓플레이스 상태')
    
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    
    logger.info(`📊 총 마켓플레이스: ${allMarketplaces.length}개`)
    logger.info(`✅ 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)
    
    // 마켓플레이스 목록 상세 출력
    logger.info('📋 마켓플레이스 목록:')
    allMarketplaces.forEach(marketplace => {
      const status = marketplace.is_active ? '🟢 활성' : '⚪ 비활성'
      logger.info(`   ${status} ${marketplace.name} (${marketplace.country_code})`)
      logger.info(`      └ ID: ${marketplace.marketplace_id}`)
      logger.info(`      └ 통화: ${marketplace.currency_code}`)
      logger.info(`      └ 엔드포인트: ${marketplace.endpoint}`)
    })

    // 3. 환경 변수 설정 상태
    logger.info('⚙️ 3단계: 환경 변수 설정 상태')
    
    const envStatus = {
      'AMAZON_INTEGRATION_ENABLED': process.env.AMAZON_INTEGRATION_ENABLED,
      'AMAZON_SP_API_SANDBOX': process.env.AMAZON_SP_API_SANDBOX,
      'AMAZON_AUTO_SYNC_ENABLED': process.env.AMAZON_AUTO_SYNC_ENABLED,
      'AMAZON_LWA_CLIENT_ID': process.env.AMAZON_LWA_CLIENT_ID ? '설정됨' : '미설정',
      'AMAZON_LWA_CLIENT_SECRET': process.env.AMAZON_LWA_CLIENT_SECRET ? '설정됨' : '미설정',
      'AMAZON_SELLER_ID': process.env.AMAZON_SELLER_ID || '미설정'
    }

    Object.entries(envStatus).forEach(([key, value]) => {
      const isConfigured = value && value !== '미설정' && !value.startsWith('your-')
      const status = isConfigured ? '✅' : '⚠️'
      logger.info(`   ${status} ${key}: ${value}`)
    })

    // 4. 동기화 통계
    logger.info('📊 4단계: 동기화 통계')
    
    const syncStats = await amazonService.getSyncStatistics()
    logger.info('📈 동기화 현황:')
    logger.info(`   - 총 레코드: ${syncStats.total}개`)
    logger.info(`   - 대기 중: ${syncStats.pending}개`)
    logger.info(`   - 진행 중: ${syncStats.processing}개`)
    logger.info(`   - 완료: ${syncStats.completed}개`)
    logger.info(`   - 실패: ${syncStats.failed}개`)
    logger.info(`   - 취소: ${syncStats.cancelled}개`)

    // 5. 실패한 동기화 확인
    const failedSyncs = await amazonService.getFailedSyncs()
    const pendingSyncs = await amazonService.getPendingSyncs()
    
    logger.info(`🔴 실패한 동기화: ${failedSyncs.length}개`)
    logger.info(`⏳ 대기 중인 동기화: ${pendingSyncs.length}개`)

    // 6. 시스템 준비 상태 평가
    logger.info('🎯 5단계: 시스템 준비 상태 평가')
    
    const readinessCheck = {
      module_loaded: true,
      database_connected: allMarketplaces.length > 0,
      marketplaces_configured: allMarketplaces.length >= 9, // 9개 마켓플레이스 예상
      some_marketplace_active: activeMarketplaces.length > 0,
      integration_enabled: process.env.AMAZON_INTEGRATION_ENABLED === 'true',
      sandbox_mode: process.env.AMAZON_SP_API_SANDBOX === 'true',
      credentials_set: !!(process.env.AMAZON_LWA_CLIENT_ID && !process.env.AMAZON_LWA_CLIENT_ID.startsWith('your-'))
    }

    logger.info('📋 준비 상태 체크리스트:')
    Object.entries(readinessCheck).forEach(([key, value]) => {
      const status = value ? '✅' : '❌'
      const description = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      logger.info(`   ${status} ${description}`)
    })

    // 7. 권장 사항 및 다음 단계
    logger.info('📝 6단계: 권장 사항 및 다음 단계')
    
    const recommendations = []
    
    if (!readinessCheck.some_marketplace_active) {
      recommendations.push('관리자 패널에서 최소 1개 마켓플레이스를 활성화하세요')
    }
    
    if (!readinessCheck.credentials_set) {
      recommendations.push('Amazon SP-API 자격 증명을 .env 파일에 설정하세요')
      recommendations.push('Amazon Seller Central에서 SP-API 앱을 등록하세요')
    }
    
    if (!readinessCheck.integration_enabled) {
      recommendations.push('AMAZON_INTEGRATION_ENABLED=true로 설정하세요')
    }
    
    if (recommendations.length > 0) {
      logger.info('🔧 권장 사항:')
      recommendations.forEach((rec, index) => {
        logger.info(`   ${index + 1}. ${rec}`)
      })
    } else {
      logger.info('🎉 모든 기본 설정이 완료되었습니다!')
    }

    // 개발 가이드
    logger.info('📚 개발 가이드:')
    logger.info('   1. 상품 생성 시 자동으로 Amazon 동기화가 시작됩니다')
    logger.info('   2. 재고/가격 변경 시 실시간 동기화됩니다')
    logger.info('   3. 관리자 패널에서 동기화 상태를 모니터링할 수 있습니다')
    logger.info('   4. 샌드박스 모드에서 안전하게 테스트하세요')
    
    // 최종 결과
    const overallScore = Object.values(readinessCheck).filter(Boolean).length
    const totalChecks = Object.keys(readinessCheck).length
    const percentage = Math.round((overallScore / totalChecks) * 100)
    
    logger.info(`\n🏆 전체 준비도: ${overallScore}/${totalChecks} (${percentage}%)`)
    
    if (percentage >= 80) {
      logger.info('🎉 Amazon 통합 시스템이 거의 준비되었습니다!')
    } else if (percentage >= 60) {
      logger.info('⚠️ Amazon 통합 시스템이 부분적으로 준비되었습니다.')
    } else {
      logger.info('🔧 Amazon 통합 시스템 설정이 더 필요합니다.')
    }

  } catch (error) {
    logger.error('💥 Amazon 통합 테스트 실패:', {
      error: error.message,
      stack: error.stack
    })
    throw error
  }
} 