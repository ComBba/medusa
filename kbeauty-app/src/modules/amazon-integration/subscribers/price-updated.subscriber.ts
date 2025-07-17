import { 
  type SubscriberConfig,
  type SubscriberArgs,
} from "@medusajs/framework"
import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService from "../services/amazon.service"
import PricingSyncService, { MedusaPriceData } from "../services/pricing-sync.service"

export interface PriceUpdatedEventData {
  id: string
  product_id?: string
  variant_id?: string
  price_set_id: string
  currency_code: string
  amount: number
  min_quantity?: number
  max_quantity?: number
  price_list_id?: string
  region_id?: string
  customer_group_id?: string
  previous_amount?: number
}

export interface ProductVariantUpdatedEventData {
  id: string
  product_id: string
  title: string
  sku: string
  prices: Array<{
    id: string
    currency_code: string
    amount: number
    min_quantity?: number
    max_quantity?: number
  }>
  previous_prices?: Array<{
    currency_code: string
    amount: number
  }>
}

/**
 * 가격 업데이트 이벤트 구독자
 * 
 * Medusa 가격 변경 시 Amazon 가격을 자동으로 동기화합니다.
 * - product-variant.updated (가격 변경 포함)
 * - price.created
 * - price.updated
 * - price.deleted
 */
export default async function priceUpdatedSubscriber({
  event,
  container,
}: SubscriberArgs<PriceUpdatedEventData | ProductVariantUpdatedEventData>) {

  const logger: Logger = container.resolve("logger")
  const amazonIntegrationService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
  const amazonService = new AmazonService({ logger })
  const pricingSyncService = new PricingSyncService({
    logger,
    amazonIntegrationService,
    amazonService
  })

  logger.info(`💰 가격 변경 이벤트 수신`, {
    event_name: event.name,
    data_id: event.data.id,
    product_id: event.data.product_id
  })

  try {
    let productId: string | undefined
    let priceData: MedusaPriceData[] = []

    // 이벤트 타입별 데이터 추출
    if (event.name.includes('product-variant.updated')) {
      const variantData = event.data as ProductVariantUpdatedEventData
      productId = variantData.product_id
      
      // 가격 변경이 있는지 확인
      const currentPrices = variantData.prices || []
      const previousPrices = variantData.previous_prices || []
      
      let hasSignificantPriceChange = false
      
      // 가격 변경 확인
      for (const currentPrice of currentPrices) {
        const previousPrice = previousPrices.find(p => p.currency_code === currentPrice.currency_code)
        
        if (!previousPrice || Math.abs(currentPrice.amount - previousPrice.amount) >= 100) { // 1 단위 이상 변경
          hasSignificantPriceChange = true
          break
        }
      }

      if (!hasSignificantPriceChange) {
        logger.debug(`의미있는 가격 변경이 없음`, {
          variant_id: variantData.id,
          product_id: variantData.product_id
        })
        return
      }

      // 가격 데이터 변환
      priceData = currentPrices.map(price => ({
        product_id: variantData.product_id,
        variant_id: variantData.id,
        currency_code: price.currency_code,
        amount: price.amount / 100, // cents to units
        min_quantity: price.min_quantity,
        max_quantity: price.max_quantity
      }))

      logger.info(`🔄 상품 변형 가격 업데이트 감지`, {
        variant_id: variantData.id,
        product_id: variantData.product_id,
        price_count: priceData.length,
        currencies: priceData.map(p => p.currency_code)
      })

    } else {
      // price.* 이벤트들
      const priceEventData = event.data as PriceUpdatedEventData
      
      if (!priceEventData.product_id) {
        logger.debug(`상품 ID가 없는 가격 이벤트 스킵`, {
          price_id: priceEventData.id
        })
        return
      }

      productId = priceEventData.product_id

      // 가격 변경량 확인
      const previousAmount = priceEventData.previous_amount || 0
      const currentAmount = priceEventData.amount
      const amountDifference = Math.abs(currentAmount - previousAmount)

      if (amountDifference < 100) { // 1 단위 미만 변경은 스킵
        logger.debug(`가격 변경량이 임계값 미만`, {
          price_id: priceEventData.id,
          previous: previousAmount / 100,
          current: currentAmount / 100,
          difference: amountDifference / 100
        })
        return
      }

      priceData = [{
        product_id: priceEventData.product_id,
        variant_id: priceEventData.variant_id || '',
        currency_code: priceEventData.currency_code,
        amount: priceEventData.amount / 100, // cents to units
        min_quantity: priceEventData.min_quantity,
        max_quantity: priceEventData.max_quantity,
        region_id: priceEventData.region_id
      }]

      logger.info(`💲 개별 가격 업데이트 감지`, {
        price_id: priceEventData.id,
        product_id: priceEventData.product_id,
        currency: priceEventData.currency_code,
        amount: priceEventData.amount / 100,
        previous_amount: previousAmount / 100
      })
    }

    if (!productId || priceData.length === 0) {
      logger.debug(`처리할 가격 데이터가 없음`, {
        product_id: productId,
        price_data_count: priceData.length
      })
      return
    }

    // Amazon과 동기화된 상품인지 확인
    const syncRecords = await amazonIntegrationService.getProductSyncStatus(productId)
    
    if (!syncRecords || syncRecords.length === 0) {
      logger.debug(`Amazon 동기화되지 않은 상품의 가격 변경`, {
        product_id: productId
      })
      return
    }

    // 완료된 동기화만 대상
    const completedSyncs = syncRecords.filter(record => 
      record.sync_status === 'completed' && record.amazon_sku
    )

    if (completedSyncs.length === 0) {
      logger.debug(`완료된 Amazon 동기화가 없는 상품의 가격 변경`, {
        product_id: productId
      })
      return
    }

    logger.info(`🚀 Amazon 가격 동기화 시작`, {
      product_id: productId,
      price_data_count: priceData.length,
      sync_records: completedSyncs.length,
      currencies: [...new Set(priceData.map(p => p.currency_code))]
    })

    // Amazon 가격 동기화 실행
    const syncResults = await pricingSyncService.syncProductPricing(
      productId,
      priceData
    )

    // 결과 로깅
    const successfulSyncs = syncResults.filter(r => r.sync_status === 'success')
    const failedSyncs = syncResults.filter(r => r.sync_status === 'failed')
    const skippedSyncs = syncResults.filter(r => r.sync_status === 'skipped')

    if (successfulSyncs.length > 0) {
      logger.info(`✅ Amazon 가격 동기화 성공`, {
        product_id: productId,
        successful_marketplaces: successfulSyncs.length,
        failed_marketplaces: failedSyncs.length,
        skipped_marketplaces: skippedSyncs.length,
        results: successfulSyncs.map(r => ({
          sku: r.sku,
          marketplace: r.marketplace_id,
          currency: r.marketplace_currency,
          price: r.amazon_price
        }))
      })
    }

    if (failedSyncs.length > 0) {
      logger.error(`❌ Amazon 가격 동기화 일부 실패`, {
        product_id: productId,
        failed_count: failedSyncs.length,
        errors: failedSyncs.map(r => ({
          sku: r.sku,
          marketplace: r.marketplace_id,
          error: r.error_message
        }))
      })
    }

    if (skippedSyncs.length > 0) {
      logger.warn(`⏭️ Amazon 가격 동기화 일부 스킵`, {
        product_id: productId,
        skipped_count: skippedSyncs.length,
        reasons: skippedSyncs.map(r => ({
          sku: r.sku,
          marketplace: r.marketplace_id,
          reason: r.error_message
        }))
      })
    }

    // K-Beauty 특화 가격 전략 적용 여부 확인
    if (successfulSyncs.length > 0) {
      const japanSync = successfulSyncs.find(r => r.marketplace_id.includes('JP'))
      const usSync = successfulSyncs.find(r => r.marketplace_id.includes('US'))
      
      if (japanSync && usSync) {
        const priceDifference = Math.abs(japanSync.amazon_price - usSync.amazon_price)
        const percentageDiff = (priceDifference / usSync.amazon_price) * 100
        
        logger.info(`🌸 K-Beauty 지역별 가격 전략 적용됨`, {
          product_id: productId,
          us_price: usSync.amazon_price,
          jp_price: japanSync.amazon_price,
          difference_percentage: Math.round(percentageDiff * 100) / 100
        })
      }
    }

    logger.info(`🏁 가격 변경 이벤트 처리 완료`, {
      product_id: productId,
      total_syncs: syncResults.length,
      successful: successfulSyncs.length,
      failed: failedSyncs.length,
      skipped: skippedSyncs.length
    })

  } catch (error) {
    logger.error(`💥 가격 변경 이벤트 처리 중 오류`, {
      event_name: event.name,
      data_id: event.data.id,
      product_id: event.data.product_id,
      error: error.message,
      stack: error.stack
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "product-variant.updated",
    "price.created",
    "price.updated", 
    "price.deleted"
  ],
} 