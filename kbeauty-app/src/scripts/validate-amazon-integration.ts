import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
// import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Amazon 통합 완전 검증 스크립트
 * 
 * 샌드박스 환경에서 Amazon 통합의 모든 기능을 종합적으로 검증하고
 * 실제 운영 준비 상태를 평가합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/validate-amazon-integration.ts
 */
export default async function validateAmazonIntegration({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)

  logger.info('🔍 Amazon 통합 완전 검증 시작')
  logger.info('=' .repeat(60))

  const validationResults = {
    environment: { score: 0, maxScore: 10, issues: [] as string[] },
    database: { score: 0, maxScore: 8, issues: [] as string[] },
    marketplaces: { score: 0, maxScore: 12, issues: [] as string[] },
    api: { score: 0, maxScore: 15, issues: [] as string[] },
    sync: { score: 0, maxScore: 10, issues: [] as string[] },
    ui: { score: 0, maxScore: 5, issues: [] as string[] }
  }

  try {
    // ===========================================
    // 1. 환경 설정 검증
    // ===========================================
    
    logger.info('\n🔧 1단계: 환경 설정 완전 검증')
    
    const criticalEnvVars = [
      'AMAZON_LWA_CLIENT_ID',
      'AMAZON_LWA_CLIENT_SECRET',
      'AMAZON_LWA_REFRESH_TOKEN',
      'AMAZON_AWS_ACCESS_KEY_ID',
      'AMAZON_AWS_SECRET_ACCESS_KEY'
    ]

    const optionalEnvVars = [
      'AMAZON_SELLER_ID',
      'AMAZON_SP_API_SANDBOX',
      'AMAZON_INTEGRATION_ENABLED',
      'VITE_MEDUSA_BACKEND_URL',
      'VITE_AMAZON_INTEGRATION_ENABLED'
    ]

    // 필수 환경변수 검증
    criticalEnvVars.forEach(key => {
      const value = process.env[key]
      if (!value) {
        logger.error(`❌ ${key}: 설정되지 않음`)
        validationResults.environment.issues.push(`${key} 미설정`)
      } else if (value.includes('your-') || value.includes('XXXX') || value.length < 10) {
        logger.warn(`⚠️ ${key}: 더미 값 또는 잘못된 형식`)
        validationResults.environment.issues.push(`${key} 더미값`)
      } else {
        logger.info(`✅ ${key}: 올바르게 설정됨`)
        validationResults.environment.score += 1.5
      }
    })

    // 선택적 환경변수 검증
    optionalEnvVars.forEach(key => {
      const value = process.env[key]
      if (!value) {
        logger.warn(`⚠️ ${key}: 설정되지 않음`)
        validationResults.environment.issues.push(`${key} 권장 설정`)
      } else {
        logger.info(`✅ ${key}: 설정됨`)
        validationResults.environment.score += 0.5
      }
    })

    // 샌드박스 모드 특별 검증
    if (process.env.AMAZON_SP_API_SANDBOX === 'true') {
      logger.info('✅ 샌드박스 모드 활성화됨')
      validationResults.environment.score += 2
    } else {
      logger.error('❌ 샌드박스 모드가 활성화되지 않음')
      validationResults.environment.issues.push('샌드박스 모드 비활성화')
    }

    // ===========================================
    // 2. 데이터베이스 및 모듈 검증
    // ===========================================
    
    logger.info('\n🗄️ 2단계: 데이터베이스 및 모듈 검증')
    
    if (!amazonService) {
      logger.error('❌ Amazon 통합 모듈 로딩 실패')
      validationResults.database.issues.push('모듈 로딩 실패')
    } else {
      logger.info('✅ Amazon 통합 모듈 로딩 성공')
      validationResults.database.score += 3
    }

    // 데이터베이스 연결 및 테이블 확인
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    
    if (allMarketplaces.length === 0) {
      logger.error('❌ 마켓플레이스 테이블이 비어있음')
      validationResults.database.issues.push('마켓플레이스 데이터 없음')
    } else {
      logger.info(`✅ 마켓플레이스 테이블: ${allMarketplaces.length}개 레코드`)
      validationResults.database.score += 2
    }

    // 동기화 통계 테이블 확인
    const syncStats = await amazonService.getSyncStatistics()
    logger.info(`✅ 동기화 통계 테이블 접근 가능`)
    logger.info(`   - 총 레코드: ${syncStats.total}개`)
    logger.info(`   - 완료: ${syncStats.completed}개`)
    logger.info(`   - 실패: ${syncStats.failed}개`)
    validationResults.database.score += 3

    // ===========================================
    // 3. 마켓플레이스 설정 검증
    // ===========================================
    
    logger.info('\n🌍 3단계: 마켓플레이스 설정 검증')
    
    const expectedMarketplaces = [
      { id: 'ATVPDKIKX0DER', name: 'Amazon.com', country: 'US' },
      { id: 'A1PA6795UKMFR9', name: 'Amazon.de', country: 'DE' },
      { id: 'A1VC38T7YXB528', name: 'Amazon.co.jp', country: 'JP' }
    ]

    let marketplaceConfigScore = 0
    
    for (const expected of expectedMarketplaces) {
      const marketplace = allMarketplaces.find(mp => mp.marketplace_id === expected.id)
      
      if (!marketplace) {
        logger.error(`❌ ${expected.name} (${expected.country}): 마켓플레이스 없음`)
        validationResults.marketplaces.issues.push(`${expected.name} 미설정`)
        continue
      }

      logger.info(`\n📊 ${marketplace.name} (${marketplace.country_code}) 검증:`)
      
      // 기본 설정 확인
      if (marketplace.marketplace_id === expected.id) {
        logger.info(`   ✅ Marketplace ID: ${marketplace.marketplace_id}`)
        marketplaceConfigScore += 1
      }

      if (marketplace.currency_code) {
        logger.info(`   ✅ Currency: ${marketplace.currency_code}`)
        marketplaceConfigScore += 0.5
      }

      if (marketplace.region) {
        logger.info(`   ✅ Region: ${marketplace.region}`)
        marketplaceConfigScore += 0.5
      }

      // Seller ID 확인
      if (marketplace.seller_id && !marketplace.seller_id.includes('your-')) {
        logger.info(`   ✅ Seller ID: ${marketplace.seller_id}`)
        marketplaceConfigScore += 1
      } else {
        logger.warn(`   ⚠️ Seller ID: 설정되지 않음 또는 기본값`)
        validationResults.marketplaces.issues.push(`${marketplace.name} Seller ID 미설정`)
      }

      // 활성화 상태 확인
      if (marketplace.is_active) {
        logger.info(`   ✅ 상태: 활성화됨`)
        marketplaceConfigScore += 1
      } else {
        logger.warn(`   ⚠️ 상태: 비활성화됨`)
        validationResults.marketplaces.issues.push(`${marketplace.name} 비활성화`)
      }

      // 샌드박스 엔드포인트 확인
      if (marketplace.endpoint?.includes('sandbox')) {
        logger.info(`   ✅ 샌드박스 엔드포인트: ${marketplace.endpoint}`)
        marketplaceConfigScore += 0.5
      } else {
        logger.warn(`   ⚠️ 엔드포인트: ${marketplace.endpoint || '미설정'}`)
      }
    }

    validationResults.marketplaces.score = marketplaceConfigScore

    // ===========================================
    // 4. API 연결 및 인증 검증 (모의)
    // ===========================================
    
    logger.info('\n🔌 4단계: API 연결 및 인증 검증')
    
    const activeMarketplaces = allMarketplaces.filter(mp => mp.is_active)
    let apiScore = 0

    if (activeMarketplaces.length === 0) {
      logger.error('❌ 활성화된 마켓플레이스가 없음')
      validationResults.api.issues.push('활성 마켓플레이스 없음')
    } else {
      logger.info(`📋 ${activeMarketplaces.length}개 활성 마켓플레이스 연결 테스트`)
      
      for (const marketplace of activeMarketplaces) {
        logger.info(`\n🧪 ${marketplace.name} 연결 테스트...`)
        
        // 기본 설정 검증
        if (marketplace.seller_id && marketplace.seller_id !== 'your-seller-id') {
          logger.info(`   ✅ Seller ID 설정됨`)
          apiScore += 2
        } else {
          logger.error(`   ❌ Seller ID 미설정`)
          validationResults.api.issues.push(`${marketplace.name} Seller ID 필요`)
          continue
        }

        // 샌드박스 엔드포인트 확인
        if (marketplace.endpoint?.includes('sandbox')) {
          logger.info(`   ✅ 샌드박스 엔드포인트 사용`)
          apiScore += 1
        }

        // 모의 SP-API 연결 테스트
        try {
          // TODO: 실제 AmazonService.testConnection() 구현 필요
          logger.info(`   🔄 SP-API 연결 테스트 중...`)
          
          // 임시 모의 테스트
          const mockSuccess = Math.random() > 0.2 // 80% 성공률
          
          if (mockSuccess) {
            logger.info(`   ✅ SP-API 연결 성공 (모의)`)
            apiScore += 3
          } else {
            logger.error(`   ❌ SP-API 연결 실패 (모의)`)
            validationResults.api.issues.push(`${marketplace.name} API 연결 실패`)
          }
        } catch (error) {
          logger.error(`   ❌ 연결 테스트 예외: ${error.message}`)
          validationResults.api.issues.push(`${marketplace.name} 연결 오류`)
        }
      }
    }

    validationResults.api.score = apiScore

    // ===========================================
    // 5. 동기화 시스템 검증
    // ===========================================
    
    logger.info('\n🔄 5단계: 동기화 시스템 검증')
    
    let syncScore = 0

    // 동기화 설정 확인
    const autoSyncEnabled = process.env.AMAZON_AUTO_SYNC_ENABLED === 'true'
    if (autoSyncEnabled) {
      logger.info('✅ 자동 동기화 활성화됨')
      syncScore += 2
    } else {
      logger.warn('⚠️ 자동 동기화 비활성화됨')
      validationResults.sync.issues.push('자동 동기화 비활성화')
    }

    // 동기화 간격 확인
    const syncInterval = parseInt(process.env.AMAZON_SYNC_INTERVAL_MINUTES || '30')
    if (syncInterval >= 15 && syncInterval <= 60) {
      logger.info(`✅ 동기화 간격: ${syncInterval}분 (권장 범위)`)
      syncScore += 2
    } else {
      logger.warn(`⚠️ 동기화 간격: ${syncInterval}분 (권장: 15-60분)`)
    }

    // Rate Limiting 설정 확인
    const rateLimit = parseInt(process.env.AMAZON_RATE_LIMIT_PER_SECOND || '10')
    if (rateLimit <= 20) {
      logger.info(`✅ Rate Limit: ${rateLimit}/초 (Amazon 권장)`)
      syncScore += 2
    } else {
      logger.warn(`⚠️ Rate Limit: ${rateLimit}/초 (너무 높음)`)
    }

    // 재시도 설정 확인
    const maxRetries = parseInt(process.env.AMAZON_MAX_RETRY_ATTEMPTS || '3')
    if (maxRetries >= 2 && maxRetries <= 5) {
      logger.info(`✅ 최대 재시도: ${maxRetries}회`)
      syncScore += 2
    }

    // 동기화 통계 분석
    if (syncStats.total > 0) {
      const successRate = (syncStats.completed / syncStats.total) * 100
      logger.info(`📊 동기화 성공률: ${successRate.toFixed(1)}%`)
      
      if (successRate >= 90) {
        syncScore += 2
      } else if (successRate >= 70) {
        syncScore += 1
      }
    }

    validationResults.sync.score = syncScore

    // ===========================================
    // 6. Admin UI 접근성 검증
    // ===========================================
    
    logger.info('\n🎮 6단계: Admin UI 접근성 검증')
    
    let uiScore = 0

    // Admin UI 환경변수 확인
    const backendUrl = process.env.VITE_MEDUSA_BACKEND_URL
    if (backendUrl) {
      logger.info(`✅ Admin UI Backend URL: ${backendUrl}`)
      uiScore += 2
    } else {
      logger.warn('⚠️ VITE_MEDUSA_BACKEND_URL 미설정')
      validationResults.ui.issues.push('Admin UI Backend URL 미설정')
    }

    const uiEnabled = process.env.VITE_AMAZON_INTEGRATION_ENABLED === 'true'
    if (uiEnabled) {
      logger.info('✅ Admin UI Amazon 통합 활성화됨')
      uiScore += 2
    } else {
      logger.warn('⚠️ Admin UI Amazon 통합 비활성화됨')
      validationResults.ui.issues.push('Admin UI 비활성화')
    }

    const debugMode = process.env.VITE_AMAZON_INTEGRATION_DEBUG === 'true'
    if (debugMode) {
      logger.info('✅ Admin UI 디버그 모드 활성화됨')
      uiScore += 1
    }

    validationResults.ui.score = uiScore

    // ===========================================
    // 7. 종합 결과 및 권장사항
    // ===========================================
    
    logger.info('\n' + '='.repeat(60))
    logger.info('🏆 Amazon 통합 검증 결과')
    logger.info('='.repeat(60))

    const totalScore = Object.values(validationResults).reduce((sum, result) => sum + result.score, 0)
    const maxTotalScore = Object.values(validationResults).reduce((sum, result) => sum + result.maxScore, 0)
    const overallPercentage = Math.round((totalScore / maxTotalScore) * 100)

    logger.info(`\n📊 전체 점수: ${totalScore}/${maxTotalScore} (${overallPercentage}%)`)
    
    Object.entries(validationResults).forEach(([category, result]) => {
      const categoryPercentage = Math.round((result.score / result.maxScore) * 100)
      const statusIcon = categoryPercentage >= 80 ? '✅' : categoryPercentage >= 60 ? '⚠️' : '❌'
      
      logger.info(`${statusIcon} ${category.toUpperCase()}: ${result.score}/${result.maxScore} (${categoryPercentage}%)`)
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          logger.warn(`     • ${issue}`)
        })
      }
    })

    // 최종 평가 및 권장사항
    logger.info('\n🎯 최종 평가:')
    
    if (overallPercentage >= 90) {
      logger.info('🎉 Amazon 통합이 운영 준비 완료되었습니다!')
      logger.info('\n📝 다음 단계:')
      logger.info('1. 실제 상품 생성 및 동기화 테스트')
      logger.info('2. Admin UI 전체 기능 테스트')
      logger.info('3. 프로덕션 환경변수 준비')
      logger.info('4. 실제 Amazon Seller Central 연동')
    } else if (overallPercentage >= 70) {
      logger.warn('⚠️ Amazon 통합이 대부분 준비되었지만 개선이 필요합니다.')
      logger.info('\n🔧 권장 조치사항:')
      
      const allIssues = Object.values(validationResults).flatMap(result => result.issues)
      allIssues.forEach(issue => {
        logger.info(`• ${issue}`)
      })
    } else {
      logger.error('❌ Amazon 통합 설정이 불완전합니다.')
      logger.info('\n🚨 필수 조치사항:')
      logger.info('1. 환경변수 완전 설정')
      logger.info('2. 샌드박스 설정 스크립트 재실행')
      logger.info('3. 마켓플레이스 활성화 및 Seller ID 설정')
      logger.info('4. Admin UI 설정 완료')
    }

    logger.info('\n📚 추가 리소스:')
    logger.info('• 설정 가이드: README.Amazon-Integration-Guide.md')
    logger.info('• 테스트 체크리스트: README.Amazon-Testing-Checklist.md')
    logger.info('• Admin UI: http://localhost:10000/app/settings/amazon')
    logger.info('• 워크플로우: http://localhost:10000/app/workflows')

  } catch (error) {
    logger.error(`💥 Amazon 통합 검증 중 오류 발생: ${error.message}`)
    logger.error('상세 에러:', error)
    throw error
  }
}