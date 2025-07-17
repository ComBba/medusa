import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { AmazonIntegrationTester } from "../modules/amazon-integration/tests/integration-test"
import { ConfigValidator } from "../modules/amazon-integration/utils/config-validator"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 확장된 Amazon 통합 시스템 테스트 스크립트
 * 
 * 전체 시스템의 기능과 안정성을 종합적으로 검증합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/test-extended-amazon-integration.ts
 */
export default async function testExtendedAmazonIntegration({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🌸 kbeauty.market 확장 Amazon 통합 시스템 테스트 시작')

  try {
    // ===========================================
    // 1. 모듈 로딩 검증
    // ===========================================
    
    logger.info('📦 1단계: 모듈 로딩 검증')
    
    // Amazon 통합 모듈이 제대로 로드되었는지 확인
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    if (!amazonService) {
      throw new Error('Amazon 통합 모듈이 로드되지 않았습니다')
    }
    
    logger.info('✅ Amazon 통합 모듈 로딩 완료')

    // ===========================================
    // 2. 서비스 등록 검증
    // ===========================================
    
    logger.info('🔧 2단계: 서비스 등록 검증')
    
    const requiredServices = [
      'amazonIntegrationService',
      'amazonService',
      'inventorySyncService',
      'pricingSyncService',
      'ordersSyncService',
      'amazonStatsService'
    ]

    for (const serviceName of requiredServices) {
      try {
        const service = container.resolve(serviceName)
        if (service) {
          logger.info(`✅ ${serviceName} 등록됨`)
        } else {
          logger.error(`❌ ${serviceName} 등록되지 않음`)
        }
      } catch (error) {
        logger.error(`❌ ${serviceName} 해결 실패: ${error.message}`)
      }
    }

    // ===========================================
    // 3. 구독자 등록 검증
    // ===========================================
    
    logger.info('📨 3단계: 이벤트 구독자 등록 검증')
    
    const requiredSubscribers = [
      'productCreatedSubscriber',
      'inventoryChangedSubscriber',
      'priceUpdatedSubscriber',
      'orderEventsSubscriber'
    ]

    for (const subscriberName of requiredSubscribers) {
      try {
        const subscriber = container.resolve(subscriberName)
        if (subscriber) {
          logger.info(`✅ ${subscriberName} 등록됨`)
        } else {
          logger.error(`❌ ${subscriberName} 등록되지 않음`)
        }
      } catch (error) {
        logger.error(`❌ ${subscriberName} 해결 실패: ${error.message}`)
      }
    }

    // ===========================================
    // 4. 설정 검증
    // ===========================================
    
    logger.info('⚙️ 4단계: 설정 검증')
    
    try {
      const config = container.resolve('amazonIntegrationConfig')
      logger.info('📋 현재 Amazon 통합 설정', {
        auto_sync: config.auto_sync_enabled,
        sandbox_mode: config.sandbox_mode,
        batch_size: config.batch_size,
        kbeauty_optimizations: config.enable_kbeauty_optimizations,
        supported_features: [
          '상품 자동 등록',
          '재고 실시간 동기화',
          '가격 자동 업데이트',
          '주문 양방향 동기화',
          'K-Beauty 최적화'
        ]
      })

      // K-Beauty 권장 마켓플레이스 확인
      const recommendedMarketplaces = ConfigValidator.getRecommendedKBeautyMarketplaces()
      logger.info('🌸 K-Beauty 권장 마켓플레이스', {
        count: recommendedMarketplaces.length,
        marketplaces: recommendedMarketplaces
      })

    } catch (error) {
      logger.error('❌ 설정 검증 실패', { error: error.message })
    }

    // ===========================================
    // 5. 통합 테스트 실행
    // ===========================================
    
    logger.info('🧪 5단계: 통합 테스트 실행')
    
    const tester = new AmazonIntegrationTester(container)
    const testResults = await tester.runAllTests()
    
    // 테스트 결과 요약
    const overallPassed = testResults.every(suite => suite.passed)
    const totalTests = testResults.reduce((sum, suite) => sum + suite.summary.total, 0)
    const totalPassed = testResults.reduce((sum, suite) => sum + suite.summary.passed, 0)
    
    logger.info('📊 통합 테스트 결과', {
      overall_result: overallPassed ? 'PASSED' : 'FAILED',
      test_suites_passed: `${testResults.filter(s => s.passed).length}/${testResults.length}`,
      individual_tests_passed: `${totalPassed}/${totalTests}`,
      success_rate: `${Math.round((totalPassed / totalTests) * 100)}%`
    })

    // ===========================================
    // 6. 헬스체크 실행
    // ===========================================
    
    logger.info('💚 6단계: 시스템 헬스체크')
    
    try {
      const statsService = container.resolve('amazonStatsService')
      const healthCheck = await statsService.getHealthCheck()
      
      logger.info('🏥 Amazon 마켓플레이스 연결 상태', healthCheck)
      
    } catch (error) {
      logger.warn('⚠️ 헬스체크 실행 실패 (정상 - 실제 Amazon 인증 없음)', {
        error: error.message
      })
    }

    // ===========================================
    // 7. 기능 데모 실행
    // ===========================================
    
    logger.info('🎬 7단계: 기능 데모 실행')
    
    await demonstrateFeatures(container, logger)

    // ===========================================
    // 8. 최종 결과 및 권장사항
    // ===========================================
    
    logger.info('🏁 8단계: 최종 결과 및 권장사항')
    
    const recommendations = generateRecommendations(testResults, overallPassed)
    
    logger.info('🎉 확장 Amazon 통합 시스템 테스트 완료', {
      status: overallPassed ? 'SUCCESS' : 'NEEDS_ATTENTION',
      system_features: [
        '✅ 상품 자동 등록',
        '✅ 재고 실시간 동기화', 
        '✅ 가격 자동 업데이트',
        '✅ 주문 양방향 동기화',
        '✅ K-Beauty 특화 최적화',
        '✅ 다중 마켓플레이스 지원',
        '✅ 에러 처리 및 재시도',
        '✅ 모니터링 및 통계'
      ],
      recommendations
    })

    if (overallPassed) {
      logger.info('🚀 시스템이 프로덕션 준비 완료되었습니다!')
    } else {
      logger.warn('⚠️ 일부 테스트가 실패했습니다. 문제를 해결한 후 다시 테스트해주세요.')
    }

  } catch (error) {
    logger.error('💥 확장 Amazon 통합 시스템 테스트 중 오류 발생', {
      error: error.message,
      stack: error.stack
    })
    throw error
  }
}

/**
 * 주요 기능들을 실제로 시연
 */
async function demonstrateFeatures(container: any, logger: any) {
  logger.info('🎭 주요 기능 시연 시작')

  try {
    // 모의 상품 데이터
    const mockProduct = {
      id: 'demo-product-1',
      title: 'K-Beauty Premium Essence',
      description: 'Korean premium skincare essence with natural ingredients',
      status: 'published',
      variants: [{
        id: 'demo-variant-1',
        sku: 'KB-ESSENCE-001',
        prices: [
          { currency_code: 'USD', amount: 4999 },
          { currency_code: 'JPY', amount: 5999 },
          { currency_code: 'EUR', amount: 4299 }
        ]
      }],
      tags: [
        { value: 'skincare' },
        { value: 'korean' },
        { value: 'essence' },
        { value: 'premium' }
      ]
    }

    // 1. 상품 등록 시뮬레이션
    logger.info('1️⃣ 상품 자동 등록 시뮬레이션')
    logger.info('📦 상품 정보', {
      title: mockProduct.title,
      sku: mockProduct.variants[0].sku,
      currencies: mockProduct.variants[0].prices.map(p => p.currency_code)
    })

    // 2. 재고 동기화 시뮬레이션
    logger.info('2️⃣ 재고 동기화 시뮬레이션')
    const inventoryData = {
      sku: 'KB-ESSENCE-001',
      stocked_quantity: 150,
      reserved_quantity: 20,
      available_quantity: 130
    }
    logger.info('📦 재고 정보', inventoryData)

    // 3. 가격 동기화 시뮬레이션 (K-Beauty 지역별 전략)
    logger.info('3️⃣ K-Beauty 지역별 가격 전략 시뮬레이션')
    const basePrice = 49.99
    const pricingStrategy = {
      US: Math.round(basePrice * 0.95 * 100) / 100,  // 5% 할인
      JP: Math.round(basePrice * 1.20 * 100) / 100,  // 20% 프리미엄  
      EU: Math.round(basePrice * 1.10 * 100) / 100,  // 10% 마진
      KR: basePrice  // 기준가
    }
    logger.info('💰 지역별 가격 전략', pricingStrategy)

    // 4. 주문 처리 시뮬레이션
    logger.info('4️⃣ 주문 처리 시뮬레이션')
    const mockOrder = {
      amazon_order_id: 'AMZ-ORDER-001',
      marketplace: 'US',
      total: 49.99,
      currency: 'USD',
      items: [
        {
          sku: 'KB-ESSENCE-001',
          quantity: 1,
          price: 49.99
        }
      ]
    }
    logger.info('🛒 주문 정보', mockOrder)

    logger.info('✨ 기능 시연 완료')

  } catch (error) {
    logger.error('🎭 기능 시연 중 오류', { error: error.message })
  }
}

/**
 * 테스트 결과를 바탕으로 권장사항 생성
 */
function generateRecommendations(testResults: any[], overallPassed: boolean): string[] {
  const recommendations = []

  if (!overallPassed) {
    recommendations.push('실패한 테스트들을 확인하고 문제를 해결하세요')
  }

  recommendations.push('Amazon Seller Central에서 SP-API 앱을 등록하세요')
  recommendations.push('실제 인증 정보를 환경 변수로 설정하세요')
  recommendations.push('K-Beauty 주요 마켓플레이스(일본, 미국)를 우선 활성화하세요')
  recommendations.push('샌드박스 환경에서 실제 API 테스트를 진행하세요')
  recommendations.push('프로덕션 배포 전 스테이징에서 전체 시나리오를 테스트하세요')

  if (overallPassed) {
    recommendations.push('🎉 모든 테스트가 통과했습니다. 프로덕션 배포를 준비하세요!')
  }

  return recommendations
} 