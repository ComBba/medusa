import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { ProductDTO, ProductVariantDTO } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { PriceMapperService } from "../modules/amazon-integration/services/price-mapper"
import { AmazonSPAPIClient } from "../modules/amazon-integration/services/sp-api-client"
import { AmazonPriceData, AmazonMarketplaceConfig } from "../modules/amazon-integration/types"

export type AmazonSyncPriceWorkflowInput = {
  product: ProductDTO
  variants: ProductVariantDTO[]
  pricing_data: Array<{
    variant_id: string
    sku: string
    currency_code: string
    amount: number
    compare_at_amount?: number
    price_set_id: string
    price_rules?: any[]
  }>
  marketplace_ids?: string[]
  options?: {
    force_update?: boolean
    currency?: string
    include_promotions?: boolean
    sync_type?: string
  }
}

/**
 * 가격 동기화 레코드 생성 단계
 */
const createPriceSyncRecordStep = createStep(
  "create-price-sync-record",
  async ({ 
    product, 
    variants,
    pricing_data,
    marketplace_ids,
    options = {}
  }: AmazonSyncPriceWorkflowInput, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 활성화된 마켓플레이스 조회
    const marketplaces = await amazonService.getActiveMarketplaces()
    
    // 특정 마켓플레이스가 지정된 경우 필터링
    const targetMarketplaces = marketplace_ids 
      ? marketplaces.filter(m => marketplace_ids.includes(m.marketplace_id))
      : marketplaces
      
    if (targetMarketplaces.length === 0) {
      return new StepResponse(
        { 
          syncRecords: [],
          marketplaces: [],
          product,
          variants,
          pricing_data,
          message: "No active marketplaces found"
        }, 
        null
      )
    }

    if (pricing_data.length === 0) {
      return new StepResponse(
        { 
          syncRecords: [],
          marketplaces: targetMarketplaces,
          product,
          variants,
          pricing_data: [],
          message: "No pricing data available"
        }, 
        null
      )
    }

    // 각 마켓플레이스와 variant별로 동기화 레코드 생성
    const syncRecords: any[] = []
    
    for (const marketplace of targetMarketplaces) {
      for (const priceItem of pricing_data) {
        // 기존 동기화 레코드가 있는지 확인 (force_update가 false인 경우)
        if (!options.force_update) {
          const existingRecords = await amazonService.listAmazonProductSyncs({
            medusa_product_id: product.id!,
            medusa_variant_id: priceItem.variant_id,
            amazon_marketplace_id: marketplace.marketplace_id,
            sync_type: "price"
          })
          
          // 최근 성공한 동기화가 있다면 스킵
          const recentSuccessfulSync = existingRecords.find(record => 
            record.sync_status === "completed" &&
            new Date(record.updated_at) > new Date(Date.now() - 60 * 60 * 1000) // 1시간 내
          )
          
          if (recentSuccessfulSync) {
            console.log(`Skipping price sync for ${priceItem.sku} on ${marketplace.marketplace_id} - recent successful sync exists`)
            continue
          }
        }
        
        const syncRecord = await amazonService.createProductSync({
          medusa_product_id: product.id!,
          medusa_variant_id: priceItem.variant_id,
          amazon_marketplace_id: marketplace.marketplace_id,
          sync_type: "price",
          sync_status: "pending",
          sync_attempts: 0,
          metadata: {
            pricing_data: priceItem,
            options,
            initiated_at: new Date().toISOString()
          }
        })
        
        syncRecords.push(syncRecord)
      }
    }

    return new StepResponse(
      { 
        syncRecords, 
        marketplaces: targetMarketplaces,
        product,
        variants,
        pricing_data
      },
      syncRecords.map(record => record.id)
    )
  },
  
  // 보상 함수 - 실패 시 생성된 동기화 레코드 삭제
  async (syncRecordIds, { container }) => {
    if (!syncRecordIds?.length) return
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    try {
      for (const recordId of syncRecordIds) {
        await amazonService.deleteProductSync(recordId)
      }
    } catch (error) {
      console.error("Failed to cleanup price sync records:", error)
    }
  }
)

/**
 * Amazon에 가격 정보 업데이트 단계
 */
const updateAmazonPriceStep = createStep(
  "update-amazon-price",
  async ({ 
    syncRecords, 
    marketplaces, 
    product,
    variants,
    pricing_data
  }: {
    syncRecords: any[]
    marketplaces: any[]
    product: ProductDTO
    variants: ProductVariantDTO[]
    pricing_data: any[]
    message?: string
  }, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    if (!syncRecords?.length) {
      return new StepResponse({
        results: [],
        skipped: true,
        message: "No sync records to process"
      })
    }
    
    const results: Array<{
      marketplace_id: string
      variant_id: string
      sku: string
      success: boolean
      feed_id?: string
      currency: string
      previous_price?: number
      new_price: number
      compare_at_price?: number
      error?: { code: string; message: string }
    }> = []
    
    // 마켓플레이스별로 그룹화
    const recordsByMarketplace = syncRecords.reduce((acc, record) => {
      const marketplaceId = record.amazon_marketplace_id
      if (!acc[marketplaceId]) {
        acc[marketplaceId] = []
      }
      acc[marketplaceId].push(record)
      return acc
    }, {})
    
    for (const [marketplaceId, records] of Object.entries(recordsByMarketplace) as [string, any[]][]) {
      const marketplace = marketplaces.find(m => m.marketplace_id === marketplaceId)
      if (!marketplace) {
        console.error(`Marketplace not found: ${marketplaceId}`)
        continue
      }
      
      try {
        // Amazon SP-API 클라이언트 생성
        const apiClient = new AmazonSPAPIClient({
          region: marketplace.region,
          credentials: {
            seller_id: marketplace.seller_id,
            marketplace_id: marketplace.marketplace_id,
          },
          sandbox: process.env.NODE_ENV !== 'production'
        })

        // 가격 업데이트 데이터 준비
        const priceUpdates: AmazonPriceData[] = []
        
        for (const record of records) {
          const priceItem = pricing_data.find(price => price.variant_id === record.medusa_variant_id)
          const variant = variants.find(v => v.id === record.medusa_variant_id)
          
          if (!priceItem || !variant) {
            console.error(`Price or variant not found for record ${record.id}`)
            continue
          }
          
          // 동기화 상태를 'processing'으로 업데이트
          await amazonService.updateProductSync(record.id, {
            sync_status: "processing",
            sync_attempts: record.sync_attempts + 1,
          })

          // 마켓플레이스 통화에 맞게 가격 변환
          const marketplaceCurrency = marketplace.currency_code || 'USD'
          let convertedPrice = priceItem.amount
          let convertedCompareAtPrice = priceItem.compare_at_amount
          
          // 통화 변환이 필요한 경우
          if (priceItem.currency_code !== marketplaceCurrency) {
            // TODO: 실제 환율 변환 로직 구현
            console.warn(`Currency conversion needed: ${priceItem.currency_code} -> ${marketplaceCurrency}`)
            // 임시로 환율 1.0 사용
            convertedPrice = priceItem.amount
            convertedCompareAtPrice = priceItem.compare_at_amount
          }

          // Amazon 가격 형식으로 변환
          const amazonPriceData = PriceMapperService.mapMedusaToAmazon(
            {
              ...priceItem,
              amount: convertedPrice,
              compare_at_amount: convertedCompareAtPrice,
              currency_code: marketplaceCurrency
            },
            variant,
            marketplace
          )
          
          priceUpdates.push(amazonPriceData)
        }

        // Amazon에 가격 업데이트 제출
        const submitResult = await apiClient.submitPriceFeed(priceUpdates)
        
        if (submitResult.success) {
          // 성공 시 모든 레코드 업데이트
          for (const record of records) {
            const priceItem = pricing_data.find(price => price.variant_id === record.medusa_variant_id)
            const variant = variants.find(v => v.id === record.medusa_variant_id)
            
            await amazonService.updateProductSync(record.id, {
              sync_status: "completed",
              feed_submission_id: submitResult.feed_submission_id,
              last_sync_at: new Date(),
              error_message: null,
              error_code: null,
              metadata: {
                ...record.metadata,
                feed_result: submitResult,
                completed_at: new Date().toISOString()
              }
            })
            
            results.push({
              marketplace_id: marketplaceId,
              variant_id: record.medusa_variant_id,
              sku: variant?.sku || 'unknown',
              success: true,
              feed_id: submitResult.feed_submission_id,
              currency: priceItem?.currency_code || 'USD',
              new_price: priceItem?.amount || 0,
              compare_at_price: priceItem?.compare_at_amount
            })
          }
        } else {
          // 실패 시 모든 레코드에 에러 정보 저장
          for (const record of records) {
            const priceItem = pricing_data.find(price => price.variant_id === record.medusa_variant_id)
            const variant = variants.find(v => v.id === record.medusa_variant_id)
            
            await amazonService.updateProductSync(record.id, {
              sync_status: "failed",
              error_message: submitResult.error?.message,
              error_code: submitResult.error?.code,
            })
            
            results.push({
              marketplace_id: marketplaceId,
              variant_id: record.medusa_variant_id,
              sku: variant?.sku || 'unknown',
              success: false,
              currency: priceItem?.currency_code || 'USD',
              new_price: priceItem?.amount || 0,
              error: submitResult.error
            })
          }
        }
        
      } catch (error) {
        // 예외 발생 시 해당 마켓플레이스의 모든 레코드에 에러 처리
        for (const record of records) {
          const priceItem = pricing_data.find(price => price.variant_id === record.medusa_variant_id)
          const variant = variants.find(v => v.id === record.medusa_variant_id)
          
          await amazonService.updateProductSync(record.id, {
            sync_status: "failed",
            error_message: error.message,
            error_code: "UNEXPECTED_ERROR",
          })
          
          results.push({
            marketplace_id: marketplaceId,
            variant_id: record.medusa_variant_id,
            sku: variant?.sku || 'unknown',
            success: false,
            currency: priceItem?.currency_code || 'USD',
            new_price: priceItem?.amount || 0,
            error: {
              code: "UNEXPECTED_ERROR",
              message: error.message
            }
          })
        }
      }
    }

    return new StepResponse({ results })
  }
)

/**
 * Amazon 가격 동기화 워크플로우
 */
export const amazonSyncPriceWorkflow = createWorkflow(
  "amazon-sync-price",
  (input: AmazonSyncPriceWorkflowInput) => {
    
    // 1단계: 가격 동기화 레코드 생성
    const syncRecordStep = createPriceSyncRecordStep(input)
    
    // 2단계: Amazon에 가격 정보 업데이트
    const updateResults = updateAmazonPriceStep(syncRecordStep)

    return new WorkflowResponse({
      product_id: input.product.id,
      variants_count: input.variants.length,
      pricing_updates: updateResults,
      sync_options: input.options
    })
  }
)

export default amazonSyncPriceWorkflow