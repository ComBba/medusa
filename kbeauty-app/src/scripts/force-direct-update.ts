import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"

/**
 * 직접 데이터베이스 업데이트로 마켓플레이스 강제 활성화
 * 
 * 실행 방법:
 * npx medusa exec src/scripts/force-direct-update.ts
 */
export default async function forceDirectUpdate({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    logger.info("🔧 강제 직접 업데이트 시작...")
    
    // 1. 기존 마켓플레이스 조회
    const usMarketplace = (await amazonService.listAmazonMarketplaces({
      marketplace_id: 'ATVPDKIKX0DER'
    }))[0]
    
    if (!usMarketplace) {
      logger.error("❌ US 마켓플레이스를 찾을 수 없습니다.")
      return
    }
    
    logger.info("🎯 현재 상태:")
    logger.info(`   - 활성화: ${usMarketplace.is_active}`)
    logger.info(`   - 판매자ID: ${usMarketplace.seller_id}`)
    
    // 2. 다양한 업데이트 시도 방법들
    logger.info("🔄 방법 1: updateAmazonMarketplaces with exact ID")
    try {
      const result1 = await amazonService.updateAmazonMarketplaces(
        { id: usMarketplace.id },
        {
          is_active: true,
          seller_id: 'A29WXO3VK3FMZ1',
          auto_sync: true
        }
      )
      logger.info("✅ 방법 1 결과: " + JSON.stringify(result1, null, 2))
    } catch (error) {
      logger.error("❌ 방법 1 실패:", error.message)
    }
    
    // 3. 업데이트 후 확인
    const afterUpdate1 = (await amazonService.listAmazonMarketplaces({
      id: usMarketplace.id
    }))[0]
    
    logger.info("📊 방법 1 후 상태:")
    logger.info(`   - 활성화: ${afterUpdate1?.is_active}`)
    logger.info(`   - 판매자ID: ${afterUpdate1?.seller_id}`)
    
    // 4. 방법 2: marketplace_id로 필터링
    logger.info("🔄 방법 2: updateAmazonMarketplaces with marketplace_id")
    try {
      const result2 = await amazonService.updateAmazonMarketplaces(
        { marketplace_id: 'ATVPDKIKX0DER' },
        {
          is_active: true,
          seller_id: 'A29WXO3VK3FMZ1',
          auto_sync: true
        }
      )
      logger.info("✅ 방법 2 결과: " + JSON.stringify(result2, null, 2))
    } catch (error) {
      logger.error("❌ 방법 2 실패:", error.message)
    }
    
    // 5. 최종 확인
    const finalMarketplace = (await amazonService.listAmazonMarketplaces({
      marketplace_id: 'ATVPDKIKX0DER'
    }))[0]
    
    logger.info("🏁 최종 상태:")
    logger.info(`   - 활성화: ${finalMarketplace?.is_active}`)
    logger.info(`   - 판매자ID: ${finalMarketplace?.seller_id}`)
    logger.info(`   - 자동동기화: ${finalMarketplace?.auto_sync}`)
    
    // 6. 활성화된 마켓플레이스 개수 확인
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    logger.info(`🟢 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)
    
    if (finalMarketplace?.is_active) {
      logger.info("🎉 성공! 마켓플레이스가 활성화되었습니다!")
    } else {
      logger.error("❌ 실패 - 마켓플레이스가 여전히 비활성화 상태입니다.")
      
      // 디버깅 정보
      logger.info("🔍 디버깅 정보:")
      logger.info(`   - 마켓플레이스 ID: ${finalMarketplace?.id}`)
      logger.info(`   - 마켓플레이스 객체 키들: ${Object.keys(finalMarketplace || {}).join(', ')}`)
      logger.info(`   - 전체 객체: ${JSON.stringify(finalMarketplace, null, 2)}`)
    }
    
  } catch (error) {
    logger.error(`💥 오류 발생: ${error.message}`)
    logger.error(error.stack)
  }
}