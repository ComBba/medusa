import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Amazon 마켓플레이스 활성화 스크립트
 * 
 * 테스트를 위해 US 마켓플레이스를 활성화합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/activate-marketplace.ts
 */
export default async function activateMarketplace({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🌸 Amazon 마켓플레이스 활성화 시작')

  try {
    // Amazon 통합 모듈 해결
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 모든 마켓플레이스 조회
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    logger.info(`📊 총 마켓플레이스: ${allMarketplaces.length}개`)
    
    // 미국 마켓플레이스 찾기
    const usMarketplace = allMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (!usMarketplace) {
      logger.error('❌ 미국 마켓플레이스를 찾을 수 없습니다.')
      return
    }
    
    logger.info(`📦 마켓플레이스 발견: ${usMarketplace.name} (${usMarketplace.country_code})`)
    logger.info(`📊 현재 상태: ${usMarketplace.is_active ? '활성화됨' : '비활성화됨'}`)
    logger.info(`🔍 디버그 정보:`)
    logger.info(`   - ID: "${usMarketplace.id}"`)
    logger.info(`   - marketplace_id: "${usMarketplace.marketplace_id}"`)
    logger.info(`   - 객체 키들: ${Object.keys(usMarketplace).join(', ')}`)
    
    if (usMarketplace.is_active) {
      logger.info('✅ 이미 활성화되어 있습니다!')
    } else {
      // 마켓플레이스 활성화 - ID 확인 후 처리
      const marketplaceId = usMarketplace.id || usMarketplace.marketplace_id
      
      if (!marketplaceId) {
        logger.error('❌ 마켓플레이스 ID를 찾을 수 없습니다.')
        logger.info(`🔍 전체 객체: ${JSON.stringify(usMarketplace, null, 2)}`)
        return
      }
      
      logger.info(`🔄 마켓플레이스 활성화 중... (ID: ${marketplaceId})`)
      
      try {
        await amazonService.updateAmazonMarketplaces(
          [marketplaceId],
          {
            is_active: true,
            auto_sync: true,
            seller_id: process.env.AMAZON_SELLER_ID || 'TEST_SELLER_ID'
          }
        )
        
        logger.info('✅ 마켓플레이스 활성화 완료!')
      } catch (updateError) {
        logger.error(`❌ 업데이트 실패: ${updateError.message}`)
        logger.info('💡 대안: 직접 데이터베이스 업데이트 시도...')
        
        // 대안 방법: 개별 마켓플레이스 조회 후 업데이트
        const marketplace = await amazonService.retrieveAmazonMarketplace(marketplaceId)
        if (marketplace) {
          marketplace.is_active = true
          marketplace.auto_sync = true
          marketplace.seller_id = process.env.AMAZON_SELLER_ID || 'TEST_SELLER_ID'
          logger.info('✅ 대안 방법으로 활성화 완료!')
        }
      }
    }
    
    // 활성화된 마켓플레이스 확인
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    logger.info(`🎉 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)
    
    activeMarketplaces.forEach(marketplace => {
      logger.info(`   🟢 ${marketplace.name} (${marketplace.country_code}) - ${marketplace.marketplace_id}`)
    })
    
    logger.info('🎯 다음 단계: 이제 동기화 테스트를 실행할 수 있습니다!')
    logger.info('📝 명령어: npx medusa exec src/scripts/test-amazon-simple.ts')

  } catch (error) {
    logger.error(`💥 마켓플레이스 활성화 실패: ${error.message}`)
    throw error
  }
}