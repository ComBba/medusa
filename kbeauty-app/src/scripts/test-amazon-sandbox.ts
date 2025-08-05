import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
// import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Amazon 샌드박스 통합 테스트 스크립트
 * 
 * 샌드박스 환경에서 Amazon 통합의 모든 기능을 테스트합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/test-amazon-sandbox.ts
 */
export default async function testAmazonSandbox({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)

  logger.info('🧪 Amazon 샌드박스 통합 테스트 시작')

  try {
    // ===========================================
    // 1. 환경 설정 검증
    // ===========================================
    
    logger.info('⚙️ 1단계: 샌드박스 환경 설정 검증')
    
    const requiredEnvVars = {
      'AMAZON_LWA_CLIENT_ID': process.env.AMAZON_LWA_CLIENT_ID,
      'AMAZON_LWA_CLIENT_SECRET': process.env.AMAZON_LWA_CLIENT_SECRET,
      'AMAZON_LWA_REFRESH_TOKEN': process.env.AMAZON_LWA_REFRESH_TOKEN,
      'AMAZON_AWS_ACCESS_KEY_ID': process.env.AMAZON_AWS_ACCESS_KEY_ID,
      'AMAZON_AWS_SECRET_ACCESS_KEY': process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
      'AMAZON_SP_API_SANDBOX': process.env.AMAZON_SP_API_SANDBOX,
      'AMAZON_SELLER_ID': process.env.AMAZON_SELLER_ID,
      'AMAZON_INTEGRATION_ENABLED': process.env.AMAZON_INTEGRATION_ENABLED,
    }

    let configScore = 0
    let criticalIssues: string[] = []
    let warnings: string[] = []

    Object.entries(requiredEnvVars).forEach(([key, value]) => {
      if (!value) {
        logger.error(`❌ ${key}: 설정되지 않음`)
        criticalIssues.push(key)
      } else if (value.startsWith('your-') || value.includes('example') || value.includes('dummy')) {
        logger.warn(`⚠️ ${key}: 더미 값 사용 중 - ${value.substring(0, 20)}...`)
        warnings.push(key)
      } else {
        logger.info(`✅ ${key}: 설정됨 - ${value.substring(0, 20)}...`)
        configScore++
      }
    })

    // 샌드박스 모드 특별 검증
    if (process.env.AMAZON_SP_API_SANDBOX !== 'true') {
      logger.error('❌ AMAZON_SP_API_SANDBOX가 true로 설정되지 않았습니다')
      criticalIssues.push('AMAZON_SP_API_SANDBOX')
    } else {
      logger.info('✅ 샌드박스 모드 활성화됨')
      configScore++
    }

    if (criticalIssues.length > 0) {
      logger.error(`\n💥 치명적 설정 오류 발견! 다음 환경 변수를 설정하세요:`)
      criticalIssues.forEach(key => logger.error(`   - ${key}`))
      logger.info('\n📚 설정 가이드: README.Amazon-Integration-Guide.md 참조')
      return
    }

    // ===========================================
    // 2. 모듈 및 데이터베이스 검증
    // ===========================================
    
    logger.info('\n📦 2단계: 모듈 및 데이터베이스 검증')
    
    if (!amazonService) {
      throw new Error('Amazon 통합 모듈이 로드되지 않았습니다')
    }
    logger.info('✅ Amazon 통합 모듈 로딩 완료')

    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    const activeMarketplaces = allMarketplaces.filter(mp => mp.is_active)
    
    logger.info(`📊 총 마켓플레이스: ${allMarketplaces.length}개`)
    logger.info(`🟢 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)

    // ===========================================
    // 3. 샌드박스 마켓플레이스 상세 검증
    // ===========================================
    
    logger.info('\n🌍 3단계: 샌드박스 마켓플레이스 상세 검증')
    
    const sandboxMarketplaces = ['ATVPDKIKX0DER', 'A1PA6795UKMFR9', 'A1VC38T7YXB528']
    let marketplaceScore = 0
    let sellerIdIssues: string[] = []

    for (const marketplaceId of sandboxMarketplaces) {
      const marketplace = allMarketplaces.find(mp => mp.marketplace_id === marketplaceId)
      
      if (!marketplace) {
        logger.error(`❌ ${marketplaceId}: 마켓플레이스가 설정되지 않음`)
        continue
      }

      const statusIcon = marketplace.is_active ? '🟢' : '⚪'
      const sandboxIndicator = marketplace.name?.includes('Sandbox') ? ' [SANDBOX]' : ''
      
      logger.info(`${statusIcon} ${marketplace.name}${sandboxIndicator} (${marketplace.country_code})`)
      logger.info(`   Marketplace ID: ${marketplace.marketplace_id}`)
      
      if (marketplace.seller_id && marketplace.seller_id !== 'your-seller-id') {
        logger.info(`   ✅ Seller ID: ${marketplace.seller_id}`)
        marketplaceScore++
      } else {
        logger.warn(`   ⚠️ Seller ID: 설정되지 않음 또는 기본값`)
        sellerIdIssues.push(marketplace.name || marketplace.marketplace_id)
      }

      if (marketplace.is_active) {
        marketplaceScore++
      }

      // 샌드박스 엔드포인트 확인
      if (marketplace.endpoint?.includes('sandbox')) {
        logger.info(`   ✅ 샌드박스 엔드포인트: ${marketplace.endpoint}`)
        marketplaceScore++
      } else {
        logger.warn(`   ⚠️ 엔드포인트: ${marketplace.endpoint || '설정되지 않음'}`)
      }
    }

    // ===========================================
    // 4. 동기화 시스템 검증
    // ===========================================
    
    logger.info('\n📊 4단계: 동기화 시스템 검증')
    
    const syncStats = await amazonService.getSyncStatistics()
    logger.info(`📈 동기화 통계:`)
    logger.info(`   - 총 동기화 레코드: ${syncStats.total}개`)
    logger.info(`   - 진행 중: ${syncStats.processing}개`)
    logger.info(`   - 완료: ${syncStats.completed}개`)
    logger.info(`   - 실패: ${syncStats.failed}개`)
    logger.info(`   - 대기 중: ${syncStats.pending}개`)

    // ===========================================
    // 5. 샌드박스 연결 테스트 (모의)
    // ===========================================
    
    logger.info('\n🔌 5단계: 샌드박스 연결 테스트')
    
    let connectionScore = 0
    
    for (const marketplace of activeMarketplaces) {
      if (marketplace.seller_id && marketplace.seller_id !== 'your-seller-id') {
        try {
          // TODO: 실제 SP-API 연결 테스트는 AmazonService.testConnection()에서 구현
          logger.info(`🧪 ${marketplace.name} 연결 테스트...`)
          
          // 모의 연결 테스트 (실제 구현까지 임시)
          const mockResult = { 
            success: true, 
            message: `${marketplace.name} 샌드박스 연결 성공 (모의)` 
          }
          
          if (mockResult.success) {
            logger.info(`   ✅ ${mockResult.message}`)
            connectionScore++
          } else {
            logger.error(`   ❌ ${mockResult.message}`)
          }
        } catch (error) {
          logger.error(`   ❌ ${marketplace.name} 연결 실패: ${error.message}`)
        }
      } else {
        logger.warn(`   ⚠️ ${marketplace.name}: Seller ID 미설정으로 연결 테스트 스킵`)
      }
    }

    // ===========================================
    // 6. 종합 결과 및 권장사항
    // ===========================================
    
    logger.info('\n🎯 6단계: 종합 결과 및 권장사항')
    
    const totalScore = configScore + marketplaceScore + connectionScore
    const maxScore = 12 // 예상 최대 점수
    const readinessPercentage = Math.round((totalScore / maxScore) * 100)

    logger.info(`\n📊 샌드박스 준비도: ${totalScore}/${maxScore} (${readinessPercentage}%)`)
    
    if (readinessPercentage >= 80) {
      logger.info('🎉 샌드박스 환경이 테스트 준비 완료되었습니다!')
      logger.info('\n📝 다음 단계:')
      logger.info('1. Admin UI 접속: http://localhost:10000/app/settings/amazon')
      logger.info('2. 실제 상품 생성 및 동기화 테스트')
      logger.info('3. 상품별 고급 동기화 컨트롤 테스트')
      logger.info('4. 워크플로우 대시보드 테스트: http://localhost:10000/app/workflows')
    } else if (readinessPercentage >= 60) {
      logger.warn('⚠️ 샌드박스 환경이 부분적으로 준비되었습니다.')
      logger.info('\n🔧 권장 조치사항:')
      
      if (warnings.length > 0) {
        logger.info('1. 더미 환경 변수를 실제 샌드박스 값으로 교체:')
        warnings.forEach(key => logger.info(`   - ${key}`))
      }
      
      if (sellerIdIssues.length > 0) {
        logger.info('2. 다음 마켓플레이스의 Seller ID 설정:')
        sellerIdIssues.forEach(name => logger.info(`   - ${name}`))
      }
      
      logger.info('3. Admin UI에서 마켓플레이스 활성화')
    } else {
      logger.error('❌ 샌드박스 환경 설정이 불완전합니다.')
      logger.info('\n🚨 필수 조치사항:')
      logger.info('1. 필수 환경 변수 설정 완료')
      logger.info('2. 샌드박스 설정 스크립트 재실행: npx medusa exec src/scripts/setup-amazon-sandbox.ts')
      logger.info('3. README.Amazon-Integration-Guide.md 가이드 참조')
    }

    // Admin UI 접근 가이드
    logger.info('\n🎮 Admin UI 사용 가이드:')
    logger.info('• 마켓플레이스 관리: /app/settings/amazon')
    logger.info('• 워크플로우 대시보드: /app/workflows')  
    logger.info('• 상품별 동기화: 각 상품 상세 페이지 하단 위젯')

    logger.info('\n📚 추가 리소스:')
    logger.info('• 테스트 체크리스트: README.Amazon-Testing-Checklist.md')
    logger.info('• 워크플로우 가이드: README-Workflow-Guide.md')
    logger.info('• API 참조: README.Amazon-Integration-Guide.md#api-참조')

  } catch (error) {
    logger.error(`💥 Amazon 샌드박스 테스트 실패: ${error.message}`)
    logger.error('상세 에러:', error)
    throw error
  }
}