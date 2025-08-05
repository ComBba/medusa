import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 강제로 마켓플레이스 활성화
 * 
 * 데이터베이스 레벨에서 직접 마켓플레이스를 활성화합니다.
 */
export default async function forceActivateMarketplace({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("🔧 강제 마켓플레이스 활성화 시작...")

  try {
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 모든 마켓플레이스 조회
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    const usMarketplace = allMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (!usMarketplace) {
      logger.error("❌ US 마켓플레이스를 찾을 수 없습니다.")
      return
    }

    logger.info(`🎯 대상 마켓플레이스: ${usMarketplace.name}`)
    logger.info(`📊 현재 상태: ${usMarketplace.is_active ? '활성' : '비활성'}`)
    logger.info(`🆔 마켓플레이스 ID: ${usMarketplace.id}`)

    if (usMarketplace.is_active) {
      logger.info("✅ 이미 활성화되어 있습니다!")
      return
    }

    // 데이터베이스 직접 업데이트 시도
    logger.info("🔄 데이터베이스 직접 업데이트 시도...")
    
    // 서비스 메서드를 통한 업데이트 시도
    logger.info("🔄 서비스 메서드를 통한 업데이트 시도...")
    
    try {
      const updated = await amazonService.updateAmazonMarketplaces(
        { id: usMarketplace.id }, 
        {
          is_active: true,
          auto_sync: true,
          seller_id: process.env.AMAZON_SELLER_ID || 'A29WXO3VK3FMZ1'
        }
      )
      
      if (updated) {
        logger.info("✅ 서비스 메서드로 업데이트 성공!")
      }
    } catch (serviceError) {
      logger.error(`❌ 서비스 메서드 실패: ${serviceError.message}`)
      
      // 대안: updateMarketplace 메서드 시도
      logger.info("🔄 updateMarketplace 메서드 시도...")
      try {
        const directUpdate = await amazonService.updateMarketplace(usMarketplace.id, {
          is_active: true,
          auto_sync: true,
          seller_id: process.env.AMAZON_SELLER_ID || 'A29WXO3VK3FMZ1'
        })
        logger.info("✅ updateMarketplace 메서드로 업데이트 성공!")
      } catch (directError) {
        logger.error(`❌ updateMarketplace 메서드도 실패: ${directError.message}`)
      }
    }

    // 결과 확인
    logger.info("🔍 업데이트 결과 확인...")
    const updatedMarketplaces = await amazonService.listAmazonMarketplaces()
    const updatedUsMarketplace = updatedMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (updatedUsMarketplace) {
      logger.info(`📊 업데이트 후 상태: ${updatedUsMarketplace.is_active ? '✅ 활성' : '❌ 비활성'}`)
      logger.info(`🔄 자동 동기화: ${updatedUsMarketplace.auto_sync ? '✅ 활성' : '❌ 비활성'}`)
      logger.info(`👤 판매자 ID: ${updatedUsMarketplace.seller_id}`)
    }

    // 활성 마켓플레이스 수 확인
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    logger.info(`🎉 총 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)

    if (activeMarketplaces.length > 0) {
      logger.info("🎊 성공! 이제 동기화 테스트를 실행할 수 있습니다!")
      logger.info("📝 다음 명령어: npx medusa exec src/scripts/simple-sandbox-test.ts")
    } else {
      logger.warn("⚠️ 여전히 활성화된 마켓플레이스가 없습니다.")
      logger.info("💡 Admin UI를 통해 수동으로 확인해보세요.")
    }

  } catch (error) {
    logger.error(`💥 오류 발생: ${error.message}`)
    logger.info("🚧 다른 방법을 시도해보세요.")
  }
}