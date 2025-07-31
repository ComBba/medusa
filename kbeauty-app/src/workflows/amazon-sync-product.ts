import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { ProductDTO } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { ProductMapperService } from "../modules/amazon-integration/services/product-mapper"
import { AmazonSPAPIClient } from "../modules/amazon-integration/services/sp-api-client"

export type AmazonSyncProductWorkflowInput = {
  product: ProductDTO
  marketplace_ids?: string[] // 특정 마켓플레이스만 동기화
}

/**
 * Amazon 동기화 레코드 생성 단계
 */
const createAmazonSyncRecordStep = createStep(
  "create-amazon-sync-record",
  async ({ 
    product, 
    marketplace_ids 
  }: AmazonSyncProductWorkflowInput, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 활성화된 마켓플레이스 조회
    const marketplaces = await amazonService.getActiveMarketplaces()
    
    // 특정 마켓플레이스가 지정된 경우 필터링
    const targetMarketplaces = marketplace_ids 
      ? marketplaces.filter(m => marketplace_ids.includes(m.id))
      : marketplaces
      
    if (targetMarketplaces.length === 0) {
      return new StepResponse(
        { 
          syncRecords: [],
          marketplaces: [],
          product,
          message: "No active marketplaces found"
        }, 
        null
      )
    }

    // 각 마켓플레이스별로 동기화 레코드 생성
    const syncRecords: Array<{
      id: string
      medusa_product_id: string
      amazon_marketplace_id: string
      sync_status: string
      sync_attempts: number
    }> = []
    
    for (const marketplace of targetMarketplaces) {
      const syncRecord = await amazonService.createAmazonProductSyncs({
        medusa_product_id: product.id!,
        amazon_marketplace_id: marketplace.id,
        sync_status: "pending",
        sync_attempts: 0,
      })
      
      syncRecords.push(syncRecord)
    }

    return new StepResponse(
      { 
        syncRecords, 
        marketplaces: targetMarketplaces,
        product 
      },
      syncRecords.map(record => record.id)
    )
  },
  
  // 보상 함수 - 실패 시 생성된 동기화 레코드 삭제
  async (syncRecordIds, { container }) => {
    if (!syncRecordIds?.length) return
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    try {
      await amazonService.deleteAmazonProductSyncs(syncRecordIds)
    } catch (error) {
      console.error("Failed to cleanup sync records:", error)
    }
  }
)

/**
 * Amazon API를 통한 상품 등록 단계
 */
const submitToAmazonStep = createStep(
  "submit-to-amazon",
  async ({ 
    syncRecords, 
    marketplaces, 
    product 
  }: {
    syncRecords: any[]
    marketplaces: any[]
    product: ProductDTO
    message?: string
  }, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    const results: Array<{
      marketplace_id: string
      success: boolean
      sku?: string
      feed_id?: string
      error?: { code: string; message: string }
    }> = []
    
    for (let i = 0; i < syncRecords.length; i++) {
      const syncRecord = syncRecords[i]
      const marketplace = marketplaces[i]
      
      try {
        // 동기화 상태를 'processing'으로 업데이트
        await amazonService.updateAmazonProductSyncs({
          id: syncRecord.id,
          sync_status: "processing",
          sync_attempts: syncRecord.sync_attempts + 1,
        })

        // Medusa 상품을 Amazon 포맷으로 변환
        const amazonProductData = ProductMapperService.mapMedusaToAmazon(
          product, 
          marketplace
        )

        // Amazon SP-API 클라이언트 생성
        const apiClient = new AmazonSPAPIClient({
          region: marketplace.region,
          credentials: {
            seller_id: marketplace.seller_id,
            marketplace_id: marketplace.marketplace_id,
            // TODO: 실제 인증 정보 구성 필요
          },
          sandbox: process.env.NODE_ENV !== 'production' // 개발환경에서는 샌드박스 사용
        })

        // Amazon에 상품 제출
        const submitResult = await apiClient.submitProductFeed([amazonProductData])
        
        if (submitResult.success) {
          // 성공 시 동기화 레코드 업데이트
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
            marketplace_id: marketplace.id,
            success: true,
            sku: submitResult.sku,
            feed_id: submitResult.feed_submission_id
          })
        } else {
          // 실패 시 에러 정보 저장
          await amazonService.updateAmazonProductSyncs({
            id: syncRecord.id,
            sync_status: "failed",
            error_message: submitResult.error?.message,
            error_code: submitResult.error?.code,
          })
          
          results.push({
            marketplace_id: marketplace.id,
            success: false,
            error: submitResult.error
          })
        }
        
      } catch (error) {
        // 예외 발생 시 에러 처리
        await amazonService.updateAmazonProductSyncs({
          id: syncRecord.id,
          sync_status: "failed",
          error_message: error.message,
          error_code: "UNEXPECTED_ERROR",
        })
        
        results.push({
          marketplace_id: marketplace.id,
          success: false,
          error: {
            code: "UNEXPECTED_ERROR",
            message: error.message
          }
        })
      }
    }

    return new StepResponse(results)
  }
)

/**
 * Amazon 상품 동기화 워크플로우
 */
export const amazonSyncProductWorkflow = createWorkflow(
  "amazon-sync-product",
  (input: AmazonSyncProductWorkflowInput) => {
    
    // 1단계: 동기화 레코드 생성
    const syncRecordStep = createAmazonSyncRecordStep(input)
    
    // 2단계: Amazon에 상품 제출
    const submitResults = submitToAmazonStep(syncRecordStep)

    return new WorkflowResponse({
      product_id: input.product.id,
      sync_results: submitResults,
      total_marketplaces: 0, // TODO: workflow data에서 marketplaces 길이 가져오기
    })
  }
)

export default amazonSyncProductWorkflow 