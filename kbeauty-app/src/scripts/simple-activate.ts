import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 간단한 Amazon 마켓플레이스 활성화 스크립트
 * 
 * 직접적인 방법으로 마켓플레이스를 활성화합니다.
 */
export default async function simpleActivate({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info('🌸 간단한 마켓플레이스 활성화 시작')

  try {
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 현재 상태 확인
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    
    logger.info(`📊 총 마켓플레이스: ${allMarketplaces.length}개`)
    logger.info(`✅ 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)
    
    // 모든 마켓플레이스 상태 출력
    logger.info('📋 마켓플레이스 목록:')
    allMarketplaces.forEach((marketplace, index) => {
      const status = marketplace.is_active ? '🟢 활성' : '⚪ 비활성'
      logger.info(`   ${index + 1}. ${status} ${marketplace.name} (${marketplace.country_code}) - ID: ${marketplace.id}`)
    })
    
    // 이미 활성화된 경우
    if (activeMarketplaces.length > 0) {
      logger.info('🎉 이미 활성화된 마켓플레이스가 있습니다!')
      return
    }
    
    // 다른 방법으로 활성화 시도 - 개별 업데이트
    logger.info('🔄 개별 업데이트 방식으로 시도...')
    
    const usMarketplace = allMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (usMarketplace) {
      logger.info(`🎯 대상 마켓플레이스: ${usMarketplace.name}`)
      
      // 직접 속성 변경
      logger.info('🔧 속성 직접 변경 중...')
      usMarketplace.is_active = true
      usMarketplace.auto_sync = true
      usMarketplace.seller_id = process.env.AMAZON_SELLER_ID || 'TEST_SELLER_ID'
      
      logger.info('✅ 속성 변경 완료!')
      logger.info(`   - is_active: ${usMarketplace.is_active}`)
      logger.info(`   - auto_sync: ${usMarketplace.auto_sync}`)
      logger.info(`   - seller_id: ${usMarketplace.seller_id}`)
    }
    
    // 최종 확인
    logger.info('🔍 최종 확인...')
    const finalActiveMarketplaces = await amazonService.getActiveMarketplaces()
    logger.info(`🎉 최종 활성화된 마켓플레이스: ${finalActiveMarketplaces.length}개`)
    
    if (finalActiveMarketplaces.length > 0) {
      logger.info('🎊 성공! 이제 테스트를 진행할 수 있습니다!')
      logger.info('📝 다음 명령어: npx medusa exec src/scripts/test-amazon-simple.ts')
    } else {
      logger.warn('⚠️ 활성화가 완료되지 않았습니다.')
      logger.info('💡 Admin UI를 통해 수동으로 활성화를 시도해보세요.')
      logger.info('🌐 URL: http://localhost:10000/app/settings/amazon')
    }

  } catch (error) {
    logger.error(`💥 오류 발생: ${error.message}`)
    logger.info('🚧 현재 상태로도 많은 기능을 테스트할 수 있습니다.')
    logger.info('📝 테스트 명령어: npx medusa exec src/scripts/test-amazon-health.ts')
  }
}