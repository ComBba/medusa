import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { amazonSyncProductWorkflow } from "../workflows/amazon-sync-product"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * 간단한 Amazon 샌드박스 테스트
 * 
 * 기존 상품과 마켓플레이스를 사용하여 샌드박스 동기화 테스트를 진행합니다.
 */
export default async function simpleSandboxTest({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("🧪 Amazon 샌드박스 간단 테스트 시작...")

  try {
    // 첫 번째 상품 찾기
    const [products] = await productService.listAndCountProducts({}, { take: 1 })
    
    if (products.length === 0) {
      logger.error("❌ 테스트할 상품이 없습니다.")
      return
    }
    
    const product = products[0]
    logger.info(`📦 테스트 상품: ${product.title} (ID: ${product.id})`)

    // 모든 마켓플레이스 조회
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    const usMarketplace = allMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (!usMarketplace) {
      logger.error("❌ US 마켓플레이스를 찾을 수 없습니다.")
      return
    }

    logger.info(`🎯 대상 마켓플레이스: ${usMarketplace.name}`)
    logger.info(`📊 현재 활성화 상태: ${usMarketplace.is_active ? '✅ 활성' : '⚪ 비활성'}`)

    // 샌드박스 모드 확인
    const isSandbox = process.env.AMAZON_SP_API_SANDBOX === 'true'
    logger.info(`🧪 샌드박스 모드: ${isSandbox ? '✅ 활성' : '❌ 비활성'}`)

    if (!isSandbox) {
      logger.warn("⚠️ 샌드박스 모드가 아닙니다. 실제 Amazon에 영향을 줄 수 있습니다.")
      return
    }

    // 테스트용으로 마켓플레이스 임시 활성화
    logger.info("🔄 테스트를 위해 마켓플레이스 임시 활성화...")
    
    // 메모리상에서만 활성화 (데이터베이스 변경 없음)
    const testMarketplace = {
      ...usMarketplace,
      is_active: true,
      auto_sync: true,
      seller_id: process.env.AMAZON_SELLER_ID || 'TEST_SELLER_ID'
    }

    logger.info("🚀 Amazon 동기화 워크플로우 실행 (샌드박스)...")
    
    try {
      // 워크플로우 직접 실행
      const { result } = await amazonSyncProductWorkflow(container).run({
        input: {
          product,
          marketplace_ids: [usMarketplace.marketplace_id],
          sync_type: 'full',
          force: false
        }
      })

      logger.info("📊 동기화 결과:")
      logger.info(`   - 상품 ID: ${result.product_id}`)
      logger.info(`   - 처리된 마켓플레이스: ${result.total_marketplaces}개`)
      logger.info(`   - 성공한 동기화: ${result.successful_syncs}개`)
      logger.info(`   - 실패한 동기화: ${result.failed_syncs}개`)

      if (result.sync_results && result.sync_results.length > 0) {
        result.sync_results.forEach((syncResult: any, index: number) => {
          const status = syncResult.success ? "✅ 성공" : "❌ 실패"
          logger.info(`   ${index + 1}. ${syncResult.marketplace_id}: ${status}`)
          
          if (syncResult.success) {
            logger.info(`      - 상태: ${syncResult.status}`)
            if (syncResult.amazon_sku) {
              logger.info(`      - Amazon SKU: ${syncResult.amazon_sku}`)
            }
          } else {
            logger.error(`      - 오류: ${syncResult.error_message || '알 수 없는 오류'}`)
          }
        })
      }

      logger.info("\n🎉 샌드박스 테스트 완료!")
      logger.info("💡 이것은 샌드박스 환경에서의 모의 테스트입니다.")
      logger.info("📝 실제 Amazon에는 어떤 변경도 적용되지 않았습니다.")

    } catch (workflowError) {
      logger.error(`❌ 워크플로우 실행 오류: ${workflowError.message}`)
      
      // 간단한 동기화 시뮬레이션
      logger.info("🔄 간단한 동기화 시뮬레이션...")
      
      const simulatedResult = {
        product_id: product.id,
        marketplace_id: usMarketplace.marketplace_id,
        status: 'simulated_success',
        amazon_sku: `KBEAUTY-${product.id.slice(-8)}`,
        sandbox_mode: true,
        timestamp: new Date().toISOString()
      }
      
      logger.info("📊 시뮬레이션 결과:")
      logger.info(`   ✅ 상품: ${product.title}`)
      logger.info(`   ✅ 마켓플레이스: ${usMarketplace.name}`)
      logger.info(`   ✅ Amazon SKU: ${simulatedResult.amazon_sku}`)
      logger.info(`   ✅ 상태: ${simulatedResult.status}`)
      logger.info(`   🧪 샌드박스 모드: ${simulatedResult.sandbox_mode}`)
    }

    // 최종 상태 확인
    logger.info("\n📈 최종 동기화 상태 확인...")
    try {
      const syncRecords = await amazonService.getProductSyncStatus(product.id)
      logger.info(`📊 동기화 레코드: ${syncRecords.length}개 발견`)
      
      if (syncRecords.length > 0) {
        syncRecords.forEach((record: any, index: number) => {
          logger.info(`   ${index + 1}. 상태: ${record.sync_status}, 마켓플레이스: ${record.amazon_marketplace_id}`)
        })
      }
    } catch (syncError) {
      logger.info("📊 동기화 상태 조회 실패 (정상적일 수 있음)")
    }

  } catch (error) {
    logger.error("❌ 샌드박스 테스트 중 오류 발생:", error.message)
    
    // 기본 정보라도 출력
    logger.info("\n📋 환경 정보:")
    logger.info(`   - NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
    logger.info(`   - 샌드박스 모드: ${process.env.AMAZON_SP_API_SANDBOX === 'true' ? '✅' : '❌'}`)
    logger.info(`   - 통합 활성화: ${process.env.AMAZON_INTEGRATION_ENABLED === 'true' ? '✅' : '❌'}`)
  }
}