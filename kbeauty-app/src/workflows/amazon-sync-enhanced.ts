import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { ProductDTO } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { ProductMapperService } from "../modules/amazon-integration/services/product-mapper"
import { AmazonSPAPIClient } from "../modules/amazon-integration/services/sp-api-client"

export type AmazonSyncEnhancedWorkflowInput = {
  product: ProductDTO
  marketplace_ids?: string[]
  options?: {
    sync_images?: boolean
    include_variants?: boolean
    force_update?: boolean
  }
}

/**
 * 마켓플레이스 검증 및 준비 단계
 */
const prepareMarketplacesStep = createStep(
  "prepare-marketplaces",
  async ({ marketplace_ids }: { marketplace_ids?: string[] }, { container }) => {
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)
    
    const marketplaces = await amazonService.getActiveMarketplaces()
    
    const targetMarketplaces = marketplace_ids 
      ? marketplaces.filter(m => marketplace_ids.includes(m.marketplace_id))
      : marketplaces
    
    return new StepResponse(
      { marketplaces: targetMarketplaces },
      { marketplaces: targetMarketplaces }
    )
  }
)

/**
 * 동기화 레코드 생성 단계
 */
const createSyncRecordsStep = createStep(
  "create-sync-records",
  async ({ 
    product, 
    marketplaces 
  }: { 
    product: ProductDTO
    marketplaces: any[] 
  }, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)
    
    type SyncRecord = {
      id: string
      medusa_product_id: string
      amazon_marketplace_id: string
      sync_status: string
      sync_type: string
      sync_attempts: number
    }
    
    const syncRecords: SyncRecord[] = []
    
    for (const marketplace of marketplaces) {
      const syncRecord = await amazonService.createAmazonProductSyncs({
        medusa_product_id: product.id!,
        amazon_marketplace_id: marketplace.marketplace_id,
        sync_status: "pending",
        sync_type: "product",
        sync_attempts: 0,
      })
      
      syncRecords.push(syncRecord as SyncRecord)
    }

    return new StepResponse(
      { syncRecords },
      syncRecords.map(record => record.id)
    )
  },
  
  // 보상 함수
  async (syncRecordIds, { container }) => {
    if (!syncRecordIds?.length) return
    
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)
    
    await amazonService.deleteAmazonProductSyncs(syncRecordIds)
  }
)

/**
 * Amazon API 제출 단계
 */
const submitToAmazonStep = createStep(
  "submit-to-amazon",
  async ({ 
    product, 
    marketplaces, 
    syncRecords,
    options = {}
  }: {
    product: ProductDTO
    marketplaces: any[]
    syncRecords: any[]
    options?: any
  }, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)
    
    type SyncResult = {
      marketplace_id: string
      success: boolean
      sku?: string
      feed_id?: string
      error?: {
        code: string
        message: string
      }
    }
    
    const results: SyncResult[] = []
    
    for (let i = 0; i < syncRecords.length; i++) {
      const syncRecord = syncRecords[i]
      const marketplace = marketplaces[i]
      
      try {
        // 상태를 processing으로 업데이트
        await amazonService.updateAmazonProductSyncs({
          id: syncRecord.id,
          sync_status: "processing",
          sync_attempts: syncRecord.sync_attempts + 1,
        })

        // 데이터 변환 (Step 내부에서는 직접 변환)
        const amazonProductData = ProductMapperService.mapMedusaToAmazon(
          product,
          marketplace
        )

        // Amazon SP-API 클라이언트 생성 및 제출
        const apiClient = new AmazonSPAPIClient({
          region: marketplace.region,
          credentials: {
            seller_id: marketplace.seller_id,
            marketplace_id: marketplace.marketplace_id,
          },
          sandbox: process.env.NODE_ENV !== 'production'
        })

        const submitResult = await apiClient.submitProductFeed([amazonProductData])
        
        if (submitResult.success) {
          await amazonService.updateAmazonProductSyncs({
            id: syncRecord.id,
            sync_status: "completed",
            amazon_sku: submitResult.sku,
            feed_submission_id: submitResult.feed_submission_id,
            last_sync_at: new Date(),
            error_message: null,
            error_code: null,
          })
          
          results.push({
            marketplace_id: marketplace.marketplace_id,
            success: true,
            sku: submitResult.sku,
            feed_id: submitResult.feed_submission_id
          })
        } else {
          await amazonService.updateAmazonProductSyncs({
            id: syncRecord.id,
            sync_status: "failed",
            error_message: submitResult.error?.message,
            error_code: submitResult.error?.code,
          })
          
          results.push({
            marketplace_id: marketplace.marketplace_id,
            success: false,
            error: submitResult.error
          })
        }
        
      } catch (error) {
        await amazonService.updateAmazonProductSyncs({
          id: syncRecord.id,
          sync_status: "failed",
          error_message: error.message,
          error_code: "UNEXPECTED_ERROR",
        })
        
        results.push({
          marketplace_id: marketplace.marketplace_id,
          success: false,
          error: {
            code: "UNEXPECTED_ERROR",
            message: error.message
          }
        })
      }
    }

    return new StepResponse({ results })
  }
)

/**
 * 개선된 Amazon 동기화 워크플로우 - Medusa v2 표준 패턴 적용
 */
export const amazonSyncEnhancedWorkflow = createWorkflow(
  "amazon-sync-enhanced",
  (input: AmazonSyncEnhancedWorkflowInput) => {
    
    // 1단계: 마켓플레이스 준비
    const marketplaceData = prepareMarketplacesStep({
      marketplace_ids: input.marketplace_ids
    })
    
    // 2단계: 조건부 실행 - when().then() 패턴 사용
    const syncResult = when(
      "check-marketplaces-available",
      marketplaceData,
      (data) => data.marketplaces.length > 0
    ).then(() => {
      
      // 3단계: 동기화 레코드 생성
      const syncRecordData = createSyncRecordsStep({
        product: input.product,
        marketplaces: marketplaceData.marketplaces
      })
      
      // 4단계: Amazon에 제출
      const submitResults = submitToAmazonStep({
        product: input.product,
        marketplaces: marketplaceData.marketplaces,
        syncRecords: syncRecordData.syncRecords,
        options: input.options || {}
      })
      
      return submitResults
    })

    return new WorkflowResponse({
      product_id: input.product.id,
      sync_results: syncResult?.results || [],
      total_marketplaces: marketplaceData.marketplaces.length,
      status: syncResult ? "completed" : "no_marketplaces"
    })
  }
)

export default amazonSyncEnhancedWorkflow 