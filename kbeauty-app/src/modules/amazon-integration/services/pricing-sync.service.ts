import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService, { PriceUpdate } from "./amazon.service"

export interface PricingSyncConfig {
  auto_sync: boolean
  batch_size: number
  currency_conversion_api?: string
  margin_percentage?: number // 기본 마진율
  min_price_threshold?: number // 최소 가격 (이하는 동기화 안함)
  max_price_variance?: number // 최대 가격 변동폭 (%)
  retry_attempts: number
}

export interface MedusaPriceData {
  product_id: string
  variant_id: string
  currency_code: string
  amount: number
  sale_amount?: number
  min_quantity?: number
  max_quantity?: number
  region_id?: string
}

export interface PriceSyncResult {
  sku: string
  marketplace_id: string
  marketplace_currency: string
  medusa_price: number
  amazon_price: number
  converted_price: number
  sync_status: 'success' | 'failed' | 'skipped'
  error_message?: string
  price_difference?: number
}

export interface CurrencyRates {
  base_currency: string
  rates: Record<string, number>
  last_updated: Date
}

/**
 * Amazon 가격 동기화 서비스
 * 
 * Medusa 가격 변경 시 Amazon 가격을 자동으로 업데이트하고,
 * 통화 변환, 마진 적용, 가격 규칙 등을 처리합니다.
 */
class PricingSyncService {
  private logger: Logger
  private amazonIntegrationService: AmazonIntegrationModuleService
  private amazonService: AmazonService
  private config: PricingSyncConfig
  private currencyRates: CurrencyRates | null = null

  constructor({
    logger,
    amazonIntegrationService,
    amazonService
  }: {
    logger: Logger
    amazonIntegrationService: AmazonIntegrationModuleService
    amazonService: AmazonService
  }) {
    this.logger = logger
    this.amazonIntegrationService = amazonIntegrationService
    this.amazonService = amazonService
    this.config = {
      auto_sync: true,
      batch_size: 25,
      margin_percentage: 10, // 기본 10% 마진
      min_price_threshold: 1.00, // $1 이상만 동기화
      max_price_variance: 50, // 50% 이상 변동 시 확인 필요
      retry_attempts: 3
    }
  }

  /**
   * 단일 상품의 가격을 Amazon에 동기화
   */
  async syncProductPricing(
    productId: string,
    priceData: MedusaPriceData[]
  ): Promise<PriceSyncResult[]> {
    this.logger.info(`가격 동기화 시작 - Product: ${productId}`)

    try {
      // 해당 상품의 Amazon 동기화 레코드 조회
      const syncRecords = await this.amazonIntegrationService.getProductSyncStatus(productId)
      
      if (!syncRecords || syncRecords.length === 0) {
        this.logger.warn(`Amazon 동기화 레코드가 없습니다 - Product: ${productId}`)
        return []
      }

      // 완료된 동기화만 처리
      const completedSyncs = syncRecords.filter(record => 
        record.sync_status === 'completed' && record.amazon_sku
      )

      if (completedSyncs.length === 0) {
        this.logger.warn(`완료된 Amazon 동기화가 없습니다 - Product: ${productId}`)
        return []
      }

      const results: PriceSyncResult[] = []

      // 각 마켓플레이스별로 가격 동기화
      for (const syncRecord of completedSyncs) {
        try {
          const marketplace = await this.amazonIntegrationService.retrieveAmazonMarketplace(
            syncRecord.amazon_marketplace_id
          )

          if (!marketplace || !marketplace.is_active) {
            this.logger.warn(`비활성 마켓플레이스 - Marketplace: ${syncRecord.amazon_marketplace_id}`)
            continue
          }

          // 해당 마켓플레이스 통화에 맞는 가격 찾기
          const matchingPrice = priceData.find(price => 
            price.currency_code === marketplace.currency_code
          ) || priceData.find(price => price.currency_code === 'USD') // 기본값

          if (!matchingPrice) {
            this.logger.warn(`가격 정보를 찾을 수 없습니다 - Product: ${productId}, Currency: ${marketplace.currency_code}`)
            continue
          }

          // 통화 변환
          const convertedPrice = await this.convertCurrency(
            matchingPrice.amount,
            matchingPrice.currency_code,
            marketplace.currency_code
          )

          // 마진 적용
          const finalPrice = this.applyMargin(convertedPrice, this.config.margin_percentage || 0)

          // 최소 가격 확인
          if (finalPrice < (this.config.min_price_threshold || 0)) {
            results.push({
              sku: syncRecord.amazon_sku!,
              marketplace_id: marketplace.marketplace_id,
              marketplace_currency: marketplace.currency_code,
              medusa_price: matchingPrice.amount,
              amazon_price: 0,
              converted_price: finalPrice,
              sync_status: 'skipped',
              error_message: '최소 가격 임계값 미만'
            })
            continue
          }

          // 세일 가격 처리
          const salePrice = matchingPrice.sale_amount 
            ? this.applyMargin(
                await this.convertCurrency(
                  matchingPrice.sale_amount,
                  matchingPrice.currency_code,
                  marketplace.currency_code
                ),
                this.config.margin_percentage || 0
              )
            : undefined

          // Amazon 가격 업데이트
          const priceUpdate: PriceUpdate = {
            sku: syncRecord.amazon_sku!,
            marketplace_id: marketplace.marketplace_id,
            listing_price: finalPrice,
            currency_code: marketplace.currency_code,
            sale_price: salePrice,
            minimum_seller_allowed_price: finalPrice * 0.8, // 80% 하한선
            maximum_seller_allowed_price: finalPrice * 1.5  // 150% 상한선
          }

          const updateResult = await this.amazonService.updatePricing([priceUpdate], marketplace)

          if (updateResult.success && updateResult.results.length > 0) {
            const result = updateResult.results[0]
            results.push({
              sku: syncRecord.amazon_sku!,
              marketplace_id: marketplace.marketplace_id,
              marketplace_currency: marketplace.currency_code,
              medusa_price: matchingPrice.amount,
              amazon_price: finalPrice,
              converted_price: finalPrice,
              sync_status: result.success ? 'success' : 'failed',
              error_message: result.success ? undefined : result.error,
              price_difference: Math.abs(matchingPrice.amount - finalPrice)
            })

            this.logger.info(`가격 동기화 완료 - SKU: ${syncRecord.amazon_sku}, Marketplace: ${marketplace.country_code}, Price: ${finalPrice}, Currency: ${marketplace.currency_code}`)
          } else {
            results.push({
              sku: syncRecord.amazon_sku!,
              marketplace_id: marketplace.marketplace_id,
              marketplace_currency: marketplace.currency_code,
              medusa_price: matchingPrice.amount,
              amazon_price: 0,
              converted_price: finalPrice,
              sync_status: 'failed',
              error_message: '가격 업데이트 실패'
            })
          }

        } catch (error) {
          results.push({
            sku: syncRecord.amazon_sku || 'unknown',
            marketplace_id: syncRecord.amazon_marketplace_id,
            marketplace_currency: 'unknown',
            medusa_price: 0,
            amazon_price: 0,
            converted_price: 0,
            sync_status: 'failed',
            error_message: error.message
          })

          this.logger.error(`가격 동기화 실패 - Sync Record: ${syncRecord.id}, Error: ${error.message}`)
        }
      }

      return results
    } catch (error) {
      this.logger.error(`가격 동기화 처리 중 오류 - Product: ${productId}, Error: ${error.message}`)
      return []
    }
  }

  /**
   * 배치로 여러 상품의 가격 동기화
   */
  async syncBatchPricing(
    updates: Array<{
      productId: string
      priceData: MedusaPriceData[]
    }>
  ): Promise<PriceSyncResult[]> {
    this.logger.info(`배치 가격 동기화 시작 - Count: ${updates.length}`)

    const allResults: PriceSyncResult[] = []
    const batches = this.chunkArray(updates, this.config.batch_size)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      this.logger.info(`배치 ${i + 1}/${batches.length} 처리 중 - Size: ${batch.length}`)

      // 배치 내 동시 처리
      const batchPromises = batch.map(update => 
        this.syncProductPricing(update.productId, update.priceData)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value)
        } else {
          this.logger.error(`배치 아이템 처리 실패 - Product: ${batch[index].productId}, Error: ${result.reason}`)
        }
      })

      // 배치 간 잠시 대기 (API 레이트 리밋 방지)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }

    this.logger.info(`배치 가격 동기화 완룼 - Total: ${updates.length}, Success: ${allResults.filter(r => r.sync_status === 'success').length}, Failed: ${allResults.filter(r => r.sync_status === 'failed').length}, Skipped: ${allResults.filter(r => r.sync_status === 'skipped').length}`)

    return allResults
  }

  /**
   * 통화 변환
   */
  private async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount
    }

    try {
      // 환율 정보가 없거나 오래된 경우 새로 가져오기
      if (!this.currencyRates || this.isRatesStale()) {
        await this.updateCurrencyRates()
      }

      if (!this.currencyRates?.rates[toCurrency]) {
        this.logger.warn(`환율 정보 없음 - From: ${fromCurrency}, To: ${toCurrency}`)
        return amount // 변환 실패 시 원래 금액 반환
      }

      const rate = this.currencyRates.rates[toCurrency]
      const convertedAmount = amount * rate

      this.logger.debug(`통화 변환 - Amount: ${amount}, From: ${fromCurrency}, To: ${toCurrency}, Rate: ${rate}, Converted: ${convertedAmount}`)

      return Math.round(convertedAmount * 100) / 100 // 소수점 둘째 자리까지
    } catch (error) {
      this.logger.error(`통화 변환 실패 - Amount: ${amount}, From: ${fromCurrency}, To: ${toCurrency}, Error: ${error.message}`)
      return amount
    }
  }

  /**
   * 환율 정보 업데이트
   */
  private async updateCurrencyRates(): Promise<void> {
    try {
      if (this.config.currency_conversion_api) {
        // 외부 API 사용
        const response = await fetch(this.config.currency_conversion_api)
        const data = await response.json()
        
        this.currencyRates = {
          base_currency: data.base || 'USD',
          rates: data.rates || {},
          last_updated: new Date()
        }
      } else {
        // 기본 환율 (실제 운영에서는 실시간 API 사용 권장)
        this.currencyRates = {
          base_currency: 'USD',
          rates: {
            'USD': 1.0,
            'EUR': 0.85,
            'GBP': 0.73,
            'JPY': 110.0,
            'CAD': 1.25,
            'AUD': 1.35,
            'KRW': 1300.0
          },
          last_updated: new Date()
        }
      }

      this.logger.info(`환율 정보 업데이트 완료 - Base: ${this.currencyRates.base_currency}, Currencies: ${Object.keys(this.currencyRates.rates).length}`)
    } catch (error) {
      this.logger.error(`환율 정보 업데이트 실패: ${error.message}`)
    }
  }

  /**
   * 환율 정보가 오래되었는지 확인
   */
  private isRatesStale(): boolean {
    if (!this.currencyRates?.last_updated) return true
    
    const oneHour = 60 * 60 * 1000
    const timeDiff = Date.now() - this.currencyRates.last_updated.getTime()
    
    return timeDiff > oneHour
  }

  /**
   * 마진 적용
   */
  private applyMargin(price: number, marginPercentage: number): number {
    const marginMultiplier = 1 + (marginPercentage / 100)
    return Math.round(price * marginMultiplier * 100) / 100
  }

  /**
   * Amazon에서 현재 가격을 조회하여 Medusa와 비교
   */
  async comparePricingLevels(
    productId: string
  ): Promise<Array<{
    sku: string
    marketplace: string
    marketplace_currency: string
    medusa_price: number
    amazon_price: number
    difference: number
    difference_percentage: number
    needs_sync: boolean
  }>> {
    try {
      const syncRecords = await this.amazonIntegrationService.getProductSyncStatus(productId)
      const completedSyncs = syncRecords.filter(record => 
        record.sync_status === 'completed' && record.amazon_sku
      )

      const comparisons: Array<{
        sku: string
        marketplace: string
        marketplace_currency: string
        medusa_price: number
        amazon_price: number
        difference: number
        difference_percentage: number
        needs_sync: boolean
      }> = []

      for (const syncRecord of completedSyncs) {
        const marketplace = await this.amazonIntegrationService.retrieveAmazonMarketplace(
          syncRecord.amazon_marketplace_id
        )

        if (!marketplace) continue

        // Amazon 가격 조회
        const pricingResult = await this.amazonService.getCurrentPricing(
          [syncRecord.amazon_sku!],
          marketplace
        )

        if (pricingResult.success && pricingResult.pricing.length > 0) {
          const amazonPricing = pricingResult.pricing[0]
          const amazonPrice = amazonPricing.listing_price || 0

          // TODO: Medusa 가격 조회 로직 (실제 구현에서는 pricing service 사용)
          const medusaPrice = 99.99 // 임시값

          const difference = medusaPrice - amazonPrice
          const differencePercentage = amazonPrice > 0 
            ? Math.abs(difference / amazonPrice) * 100 
            : 100

          const needsSync = differencePercentage > (this.config.max_price_variance || 10)

          comparisons.push({
            sku: syncRecord.amazon_sku!,
            marketplace: marketplace.country_code,
            marketplace_currency: marketplace.currency_code,
            medusa_price: medusaPrice,
            amazon_price: amazonPrice,
            difference,
            difference_percentage: differencePercentage,
            needs_sync: needsSync
          })
        }
      }

      return comparisons
    } catch (error) {
      this.logger.error(`가격 수준 비교 실패 - Product: ${productId}, Error: ${error.message}`)
      return []
    }
  }

  /**
   * 가격 동기화 설정 업데이트
   */
  updateConfig(newConfig: Partial<PricingSyncConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.logger.info(`가격 동기화 설정 업데이트 - Config: ${JSON.stringify(this.config)}`)
  }

  /**
   * 배열을 청크로 분할
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 가격 동기화 통계 조회
   */
  async getPricingSyncStats(): Promise<{
    total_synced_products: number
    out_of_sync_count: number
    average_price_difference: number
    last_sync_check: Date | null
    currency_rates: CurrencyRates | null
    config: PricingSyncConfig
  }> {
    try {
      const totalSynced = await this.amazonIntegrationService.listAmazonProductSyncs({
        sync_status: 'completed'
      })

      return {
        total_synced_products: totalSynced.length,
        out_of_sync_count: 0, // TODO: 실제 계산 로직
        average_price_difference: 0, // TODO: 실제 계산 로직
        last_sync_check: new Date(),
        currency_rates: this.currencyRates,
        config: this.config
      }
    } catch (error) {
      this.logger.error(`가격 동기화 통계 조회 실패: ${error.message}`)
      return {
        total_synced_products: 0,
        out_of_sync_count: 0,
        average_price_difference: 0,
        last_sync_check: null,
        currency_rates: null,
        config: this.config
      }
    }
  }

  /**
   * 특정 마켓플레이스의 가격 규칙 적용
   */
  async applyMarketplaceSpecificPricing(
    basePrice: number,
    marketplace: any
  ): Promise<number> {
    // K-Beauty 특화 가격 조정
    let adjustedPrice = basePrice

    switch (marketplace.country_code) {
      case 'JP':
        // 일본은 K-Beauty 프리미엄 적용 (+20%)
        adjustedPrice = basePrice * 1.20
        break
      case 'US':
        // 미국은 경쟁력 있는 가격 (-5%)
        adjustedPrice = basePrice * 0.95
        break
      case 'KR':
        // 한국은 원가 기준
        adjustedPrice = basePrice
        break
      default:
        // 기타 지역은 기본 마진 적용
        adjustedPrice = basePrice * 1.10
    }

    return Math.round(adjustedPrice * 100) / 100
  }
}

export default PricingSyncService 