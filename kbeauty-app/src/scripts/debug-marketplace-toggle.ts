import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"

/**
 * 디버그용 마켓플레이스 토글 테스트
 * 
 * 실행 방법:
 * npx medusa exec src/scripts/debug-marketplace-toggle.ts
 */
export default async function debugMarketplaceToggle({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    logger.info("🔍 마켓플레이스 디버그 토글 테스트 시작...")
    
    // 1. 현재 모든 마켓플레이스 조회
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    logger.info(`📊 총 마켓플레이스 개수: ${allMarketplaces.length}`)
    
    // 2. US 마켓플레이스 찾기
    const usMarketplace = allMarketplaces.find(mp => mp.marketplace_id === 'ATVPDKIKX0DER')
    
    if (!usMarketplace) {
      logger.error("❌ US 마켓플레이스를 찾을 수 없습니다.")
      return
    }
    
    logger.info("🎯 US 마켓플레이스 현재 상태:")
    logger.info(`   - ID: ${usMarketplace.id}`)
    logger.info(`   - 이름: ${usMarketplace.name}`)
    logger.info(`   - 활성화: ${usMarketplace.is_active}`)
    logger.info(`   - 자동동기화: ${usMarketplace.auto_sync}`)
    logger.info(`   - 판매자ID: ${usMarketplace.seller_id}`)
    
    // 3. 토글 테스트 (현재 상태의 반대로)
    const newActiveState = !usMarketplace.is_active
    logger.info(`🔄 상태 토글 시도: ${usMarketplace.is_active} → ${newActiveState}`)
    
    // 4. 업데이트 실행
    const updateData = {
      is_active: newActiveState,
      auto_sync: true,
      seller_id: process.env.AMAZON_SELLER_ID || usMarketplace.seller_id || 'A29WXO3VK3FMZ1'
    }
    
    logger.info("📝 업데이트 데이터: " + JSON.stringify(updateData, null, 2))
    
    const updated = await amazonService.updateMarketplace(usMarketplace.id, updateData)
    
    logger.info("✅ 업데이트 결과: " + JSON.stringify(updated, null, 2))
    
    // 5. 업데이트 후 상태 확인
    const updatedMarketplaces = await amazonService.listAmazonMarketplaces({
      id: usMarketplace.id
    })
    
    if (updatedMarketplaces.length > 0) {
      const afterUpdate = updatedMarketplaces[0]
      logger.info("🔍 업데이트 후 실제 상태:")
      logger.info(`   - 활성화: ${afterUpdate.is_active} (목표: ${newActiveState})`)
      logger.info(`   - 자동동기화: ${afterUpdate.auto_sync}`)
      logger.info(`   - 판매자ID: ${afterUpdate.seller_id}`)
      
      if (afterUpdate.is_active === newActiveState) {
        logger.info("🎉 토글 성공!")
      } else {
        logger.error("❌ 토글 실패 - 상태가 변경되지 않았습니다.")
      }
    }
    
    // 6. 활성화된 마켓플레이스 확인
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    logger.info(`🟢 현재 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)
    
    activeMarketplaces.forEach(marketplace => {
      logger.info(`   - ${marketplace.name} (${marketplace.marketplace_id})`)
    })
    
  } catch (error) {
    logger.error(`💥 오류 발생: ${error.message}`)
    logger.error(error.stack)
  }
}