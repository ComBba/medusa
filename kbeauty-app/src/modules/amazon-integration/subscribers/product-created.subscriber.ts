import { 
  type SubscriberConfig,
  type SubscriberArgs,
} from "@medusajs/framework"
import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService from "../services/amazon.service"

export interface ProductCreatedEventData {
  id: string
  title: string
  handle: string
  description?: string
  status: string
  thumbnail?: string
  images?: Array<{
    id: string
    url: string
  }>
  variants?: Array<{
    id: string
    title: string
    sku: string
    prices: Array<{
      currency_code: string
      amount: number
    }>
  }>
  tags?: Array<{
    id: string
    value: string
  }>
  categories?: Array<{
    id: string
    name: string
    handle: string
  }>
  metadata?: Record<string, any>
  created_at: Date
}

/**
 * 상품 생성 이벤트 구독자
 * 
 * 새로운 상품이 생성될 때 자동으로 Amazon에 등록합니다.
 * 기존 workflow 기반 처리에 추가하여 더 세밀한 제어를 제공합니다.
 */
export default async function productCreatedSubscriber({
  event,
  container,
}: SubscriberArgs<ProductCreatedEventData>) {

  const logger: Logger = container.resolve("logger")
  const amazonIntegrationService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
  const amazonService = new AmazonService({ logger })

  logger.info(`🌸 상품 생성 이벤트 수신`, {
    product_id: event.data.id,
    title: event.data.title,
    status: event.data.status,
    variants_count: event.data.variants?.length || 0
  })

  try {
    // 상품 상태가 'published'가 아니면 Amazon 동기화 스킵
    if (event.data.status !== 'published') {
      logger.info(`상품이 게시되지 않음 - Amazon 동기화 스킵`, {
        product_id: event.data.id,
        status: event.data.status
      })
      return
    }

    // SKU가 없는 변형이 있는지 확인
    const variantsWithoutSku = event.data.variants?.filter(v => !v.sku) || []
    if (variantsWithoutSku.length > 0) {
      logger.warn(`SKU가 없는 변형 발견 - Amazon 동기화 제한될 수 있음`, {
        product_id: event.data.id,
        variants_without_sku: variantsWithoutSku.length
      })
    }

    // 활성화된 Amazon 마켓플레이스 조회
    const activeMarketplaces = await amazonIntegrationService.getActiveMarketplaces()
    
    if (activeMarketplaces.length === 0) {
      logger.warn(`활성화된 Amazon 마켓플레이스가 없습니다`, {
        product_id: event.data.id
      })
      return
    }

    logger.info(`🚀 Amazon 자동 등록 시작`, {
      product_id: event.data.id,
      title: event.data.title,
      marketplaces: activeMarketplaces.map(m => m.country_code),
      auto_sync_enabled: activeMarketplaces.filter(m => m.auto_sync).length
    })

    // auto_sync가 활성화된 마켓플레이스만 대상
    const autoSyncMarketplaces = activeMarketplaces.filter(m => m.auto_sync)
    
    if (autoSyncMarketplaces.length === 0) {
      logger.info(`자동 동기화가 활성화된 마켓플레이스가 없습니다`, {
        product_id: event.data.id
      })
      return
    }

    const syncResults = []

    // 각 마켓플레이스별로 동기화 레코드 생성 및 등록 시도
    for (const marketplace of autoSyncMarketplaces) {
      try {
        logger.info(`${marketplace.name} 등록 시작`, {
          product_id: event.data.id,
          marketplace_id: marketplace.id,
          country: marketplace.country_code
        })

        // 기존 동기화 레코드가 있는지 확인
        const existingSyncs = await amazonIntegrationService.listAmazonProductSyncs({
          medusa_product_id: event.data.id,
          amazon_marketplace_id: marketplace.id
        })

        if (existingSyncs.length > 0) {
          logger.warn(`이미 동기화 레코드가 존재함`, {
            product_id: event.data.id,
            marketplace_id: marketplace.id,
            existing_status: existingSyncs[0].sync_status
          })
          continue
        }

        // 동기화 레코드 생성
        const syncRecord = await amazonIntegrationService.createAmazonProductSyncs({
          medusa_product_id: event.data.id,
          amazon_marketplace_id: marketplace.id,
          sync_status: 'pending',
          sync_attempts: 0,
        })

        // Amazon에 상품 등록 시도
        const publishResult = await amazonService.publishProduct(event.data, marketplace)
        
        if (publishResult.success) {
          // 성공 시 동기화 레코드 업데이트
          await amazonIntegrationService.updateAmazonProductSyncs([syncRecord.id], {
            sync_status: 'completed',
            amazon_sku: publishResult.sku,
            feed_submission_id: publishResult.feed_submission_id,
            last_sync_at: new Date(),
            error_message: null,
            error_code: null,
          })

          syncResults.push({
            marketplace: marketplace.country_code,
            success: true,
            sku: publishResult.sku,
            feed_id: publishResult.feed_submission_id
          })

          logger.info(`✅ ${marketplace.name} 등록 성공`, {
            product_id: event.data.id,
            sku: publishResult.sku,
            feed_id: publishResult.feed_submission_id
          })

        } else {
          // 실패 시 에러 정보 저장
          await amazonIntegrationService.updateAmazonProductSyncs([syncRecord.id], {
            sync_status: 'failed',
            sync_attempts: 1,
            error_message: publishResult.error?.message,
            error_code: publishResult.error?.code,
          })

          syncResults.push({
            marketplace: marketplace.country_code,
            success: false,
            error: publishResult.error
          })

          logger.error(`❌ ${marketplace.name} 등록 실패`, {
            product_id: event.data.id,
            error: publishResult.error?.message,
            error_code: publishResult.error?.code
          })
        }

      } catch (error) {
        syncResults.push({
          marketplace: marketplace.country_code,
          success: false,
          error: {
            code: 'UNEXPECTED_ERROR',
            message: error.message
          }
        })

        logger.error(`💥 ${marketplace.name} 등록 중 예외 발생`, {
          product_id: event.data.id,
          marketplace_id: marketplace.id,
          error: error.message,
          stack: error.stack
        })
      }
    }

    // 전체 결과 요약
    const successfulSyncs = syncResults.filter(r => r.success)
    const failedSyncs = syncResults.filter(r => !r.success)

    logger.info(`🏁 Amazon 자동 등록 완료`, {
      product_id: event.data.id,
      title: event.data.title,
      total_marketplaces: syncResults.length,
      successful: successfulSyncs.length,
      failed: failedSyncs.length,
      results: syncResults
    })

    // K-Beauty 특화 로깅
    if (successfulSyncs.length > 0) {
      const japanSuccess = successfulSyncs.find(r => r.marketplace === 'JP')
      const usSuccess = successfulSyncs.find(r => r.marketplace === 'US')
      
      if (japanSuccess && usSuccess) {
        logger.info(`🌸 K-Beauty 주요 마켓 등록 완료`, {
          product_id: event.data.id,
          title: event.data.title,
          japan_sku: japanSuccess.sku,
          us_sku: usSuccess.sku
        })
      }
    }

    // 실패한 동기화가 있는 경우 추가 알림
    if (failedSyncs.length > 0) {
      logger.error(`⚠️ 일부 Amazon 마켓플레이스 등록 실패`, {
        product_id: event.data.id,
        failed_marketplaces: failedSyncs.map(r => r.marketplace),
        errors: failedSyncs.map(r => ({
          marketplace: r.marketplace,
          error: r.error?.message
        }))
      })
    }

    // 메타데이터에 Amazon 동기화 정보 추가 (선택사항)
    if (successfulSyncs.length > 0) {
      const amazonMetadata = {
        amazon_sync_completed: true,
        amazon_marketplaces: successfulSyncs.map(r => r.marketplace),
        amazon_skus: successfulSyncs.reduce((acc, r) => {
          acc[r.marketplace] = r.sku
          return acc
        }, {} as Record<string, string>),
        synced_at: new Date().toISOString()
      }

      logger.debug(`Amazon 동기화 메타데이터 생성`, {
        product_id: event.data.id,
        metadata: amazonMetadata
      })
    }

  } catch (error) {
    logger.error(`💥 상품 생성 이벤트 처리 중 치명적 오류`, {
      product_id: event.data.id,
      title: event.data.title,
      error: error.message,
      stack: error.stack
    })
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
} 