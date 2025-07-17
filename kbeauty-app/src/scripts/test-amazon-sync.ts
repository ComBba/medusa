import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { amazonSyncProductWorkflow } from "../workflows/amazon-sync-product"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Amazon 동기화 테스트 스크립트
 * 
 * 첫 번째 상품을 Amazon 샌드박스 환경에서 테스트합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/test-amazon-sync.ts [product_id]
 */
export default async function testAmazonSync({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("🧪 Amazon 동기화 테스트 시작...")

  try {
    let productId = args?.[0]
    let product

    if (productId) {
      // 특정 상품 ID가 제공된 경우
      logger.info(`지정된 상품 ID로 테스트: ${productId}`)
      product = await productService.retrieveProduct(productId)
      
      if (!product) {
        logger.error(`❌ 상품을 찾을 수 없습니다: ${productId}`)
        return
      }
    } else {
      // 첫 번째 상품 자동 선택
      logger.info("첫 번째 상품 자동 선택...")
      const [products] = await productService.listAndCountProducts({}, { take: 1 })
      
      if (products.length === 0) {
        logger.error("❌ 테스트할 상품이 없습니다. 먼저 상품을 생성하세요.")
        return
      }
      
      product = products[0]
      productId = product.id
    }

    logger.info(`📦 테스트 상품: ${product.title} (ID: ${productId})`)

    // 활성 마켓플레이스 확인
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    
    if (activeMarketplaces.length === 0) {
      logger.warn("⚠️ 활성화된 Amazon 마켓플레이스가 없습니다.")
      logger.info("💡 setup-amazon-integration.ts 스크립트를 실행하고 마켓플레이스를 활성화하세요.")
      
      // 테스트용으로 임시 마켓플레이스 생성
      logger.info("🧪 테스트용 샌드박스 마켓플레이스 생성...")
      const testMarketplace = await amazonService.createAmazonMarketplaces({
        marketplace_id: "ATVPDKIKX0DER",
        country_code: "US",
        name: "Amazon.com (Test)",
        currency_code: "USD",
        region: "NA",
        endpoint: "sandbox.sellingpartnerapi-na.amazon.com",
        seller_id: "TEST_SELLER_ID",
        mws_auth_token: "TEST_AUTH_TOKEN",
        is_active: true,
        auto_sync: true,
      })
      
      logger.info(`✅ 테스트 마켓플레이스 생성 완료: ${testMarketplace.name}`)
    }

    // Amazon 동기화 워크플로우 실행
    logger.info("🚀 Amazon 동기화 워크플로우 실행...")
    
    const { result } = await amazonSyncProductWorkflow(container).run({
      input: {
        product,
        // 모든 활성 마켓플레이스에 동기화
      }
    })

    logger.info("📊 동기화 결과:")
    logger.info(`   - 상품 ID: ${result.product_id}`)
    logger.info(`   - 대상 마켓플레이스: ${result.total_marketplaces}개`)

    if (result.sync_results && result.sync_results.length > 0) {
      logger.info(`   - 동기화 결과:`)
      
      result.sync_results.forEach((syncResult: any, index: number) => {
        const status = syncResult.success ? "✅ 성공" : "❌ 실패"
        logger.info(`     ${index + 1}. 마켓플레이스 ${syncResult.marketplace_id}: ${status}`)
        
        if (syncResult.success) {
          if (syncResult.sku) {
            logger.info(`        - Amazon SKU: ${syncResult.sku}`)
          }
          if (syncResult.feed_id) {
            logger.info(`        - Feed ID: ${syncResult.feed_id}`)
          }
        } else if (syncResult.error) {
          logger.error(`        - 오류: ${syncResult.error.message}`)
        }
      })
    }

    // 동기화 상태 확인
    logger.info("\n📈 동기화 상태 확인...")
    const syncRecords = await amazonService.getProductSyncStatus(productId)
    
    if (syncRecords.length > 0) {
      logger.info(`동기화 레코드 ${syncRecords.length}개 발견:`)
      
      syncRecords.forEach((record: any, index: number) => {
        logger.info(`${index + 1}. 상태: ${record.sync_status}, 마켓플레이스: ${record.amazon_marketplace_id}`)
        if (record.error_message) {
          logger.error(`   오류: ${record.error_message}`)
        }
      })
    }

    // 통계 정보
    const statistics = await amazonService.getSyncStatistics()
    logger.info("\n📊 전체 동기화 통계:")
    logger.info(`   - 총 동기화: ${statistics.total}개`)
    logger.info(`   - 완료: ${statistics.completed}개`)
    logger.info(`   - 처리중: ${statistics.processing}개`)
    logger.info(`   - 대기중: ${statistics.pending}개`)
    logger.info(`   - 실패: ${statistics.failed}개`)

    logger.info("\n🎉 Amazon 동기화 테스트 완료!")
    
    if (process.env.NODE_ENV === 'production') {
      logger.warn("⚠️ 현재 프로덕션 환경입니다. 실제 Amazon에 상품이 등록될 수 있습니다.")
    } else {
      logger.info("💡 샌드박스 환경에서 테스트되었습니다. 실제 Amazon에는 등록되지 않았습니다.")
    }

  } catch (error) {
    logger.error("❌ Amazon 동기화 테스트 중 오류 발생:", error)
    throw error
  }
} 