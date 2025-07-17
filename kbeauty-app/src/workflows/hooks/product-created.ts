import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { amazonSyncProductWorkflow } from "../amazon-sync-product"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 상품 생성 후 Amazon 동기화 자동 실행
 * 
 * Medusa의 createProductsWorkflow에서 productsCreated 훅을 소비하여
 * 상품이 생성될 때마다 자동으로 Amazon에 등록되도록 합니다.
 */
createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    
    logger.info(`🌸 kbeauty.market: Amazon 동기화 시작 - ${products.length}개 상품`)
    
    // 각 상품에 대해 Amazon 동기화 워크플로우 실행
    for (const product of products) {
      try {
        logger.info(`Amazon 동기화 시작: ${product.title} (ID: ${product.id})`)
        
        // Amazon 동기화 워크플로우 실행
        const { result } = await amazonSyncProductWorkflow(container).run({
          input: {
            product,
            // additional_data에서 특정 마켓플레이스 ID가 지정된 경우 사용
            marketplace_ids: additional_data?.amazon_marketplace_ids
          }
        })
        
        logger.info(`✅ Amazon 동기화 완료: ${product.title}`, {
          product_id: result.product_id,
          total_marketplaces: result.total_marketplaces,
          sync_results: result.sync_results
        })
        
        // 성공한 동기화 개수 집계
        const successfulSyncs = result.sync_results?.filter(r => r.success).length || 0
        const failedSyncs = result.sync_results?.filter(r => !r.success).length || 0
        
        if (successfulSyncs > 0) {
          logger.info(`📈 ${product.title}: ${successfulSyncs}개 마켓플레이스에 성공적으로 등록`)
        }
        
        if (failedSyncs > 0) {
          logger.warn(`⚠️ ${product.title}: ${failedSyncs}개 마켓플레이스 등록 실패`)
          
          // 실패한 동기화에 대한 상세 로그
          result.sync_results?.forEach(syncResult => {
            if (!syncResult.success) {
              logger.error(`Amazon 동기화 실패 - Marketplace: ${syncResult.marketplace_id}`, {
                error: syncResult.error
              })
            }
          })
        }
        
      } catch (error) {
        logger.error(`❌ Amazon 동기화 중 오류 발생: ${product.title}`, {
          product_id: product.id,
          error: error.message,
          stack: error.stack
        })
        
        // 워크플로우 실행 실패는 상품 생성을 중단시키지 않음
        // 대신 로그만 남기고 계속 진행
        continue
      }
    }
    
    logger.info(`🎉 kbeauty.market: Amazon 동기화 완료 - 총 ${products.length}개 상품 처리`)
  }
) 