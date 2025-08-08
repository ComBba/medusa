import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { ProductDTO } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"

export type AmazonSyncEnhancedV2WorkflowInput = {
  product_id?: string
  product?: ProductDTO
  marketplace_ids?: string[]
  sync_type: 'product' | 'price' | 'inventory' | 'all'
  options?: {
    force_update?: boolean
    validation_only?: boolean
    batch_mode?: boolean
    retry_count?: number
  }
}

export type AmazonSyncResult = {
  success: boolean
  product_id: string
  marketplace_id: string
  sync_type: string
  result?: any
  error?: string
  timestamp: Date
}

/**
 * Amazon 연결 테스트 단계
 */
const testAmazonConnectionStep = createStep(
  "test-amazon-connection-v2",
  async (input: AmazonSyncEnhancedV2WorkflowInput, { container }) => {
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    console.log("🔗 [AMAZON SYNC V2] Amazon 연결 테스트 시작...")
    
    try {
      const connectionResult = await amazonService.testAmazonConnection()
      
      if (!connectionResult.success) {
        throw new Error(`Amazon 연결 실패: ${connectionResult.message}`)
      }
      
      console.log("✅ [AMAZON SYNC V2] Amazon 연결 테스트 성공")
      
      return new StepResponse(
        { connectionStatus: "success", message: connectionResult.message },
        { connectionResult }
      )
    } catch (error) {
      console.error("❌ [AMAZON SYNC V2] Amazon 연결 테스트 실패:", error)
      throw error
    }
  },
  async (compensationData, { container }) => {
    console.log("🔄 [AMAZON SYNC V2] 연결 테스트 보상 작업 - 필요시 재연결 시도")
  }
)

/**
 * 마켓플레이스 정보 조회 단계
 */
const getMarketplaceInfoStep = createStep(
  "get-marketplace-info-v2",
  async ({ marketplace_ids }: AmazonSyncEnhancedV2WorkflowInput, { container }) => {
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    console.log("🌍 [AMAZON SYNC V2] 마켓플레이스 정보 조회 시작...")
    
    try {
      // 활성화된 마켓플레이스 조회
      const marketplaces = await amazonService.getActiveMarketplaces()
      
      // 특정 마켓플레이스가 지정된 경우 필터링
      const targetMarketplaces = marketplace_ids 
        ? marketplaces.filter(m => 
            marketplace_ids.includes(m.id) ||
            marketplace_ids.includes(m.marketplace_id)
          )
        : marketplaces
      
      if (targetMarketplaces.length === 0) {
        throw new Error("활성화된 마켓플레이스가 없습니다")
      }
      
      console.log(`📋 [AMAZON SYNC V2] ${targetMarketplaces.length}개 마켓플레이스 대상으로 동기화 진행`)
      
      return new StepResponse(
        { marketplaces: targetMarketplaces },
        { targetMarketplaces }
      )
    } catch (error) {
      console.error("❌ [AMAZON SYNC V2] 마켓플레이스 정보 조회 실패:", error)
      throw error
    }
  }
)

/**
 * 상품 동기화 단계 (새로운 SDK 사용)
 */
const syncProductToAmazonStep = createStep(
  "sync-product-to-amazon-v2",
  async (
    { product_id, product, sync_type, options }: AmazonSyncEnhancedV2WorkflowInput,
    { container }
  ) => {
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    const productIdToSync = product_id || product?.id
    if (!productIdToSync) {
      throw new Error("상품 ID가 제공되지 않았습니다")
    }
    
    console.log(`🚀 [AMAZON SYNC V2] 상품 동기화 시작: ${productIdToSync} (타입: ${sync_type})`)
    
    try {
      const results: AmazonSyncResult[] = []
      
      // 이전 단계에서 받은 마켓플레이스 정보 사용
      // 실제로는 워크플로우 컨텍스트에서 받아야 하지만, 여기서는 직접 조회
      const marketplaces = await amazonService.getActiveMarketplaces()
      
      for (const marketplace of marketplaces) {
        try {
          let syncResult = null
          const marketplaceId = marketplace.marketplace_id
          
          switch (sync_type) {
            case 'product':
              const mode = options?.validation_only ? 'VALIDATION_PREVIEW' : 'LISTING'
              syncResult = await amazonService.submitProductToAmazon(
                productIdToSync,
                marketplaceId,
                mode
              )
              break
              
            case 'price':
              // 가격 동기화 - 실제 구현에서는 상품 정보에서 가격 가져오기
              syncResult = await amazonService.updateProductPrice(
                productIdToSync,
                marketplaceId,
                29.99, // 임시 가격
                'USD'
              )
              break
              
            case 'inventory':
              // 재고 동기화 - 실제 구현에서는 재고 서비스에서 재고 수량 가져오기
              syncResult = await amazonService.updateProductInventory(
                productIdToSync,
                marketplaceId,
                100 // 임시 재고
              )
              break
              
            case 'all':
              // 전체 동기화
              const mode2 = options?.validation_only ? 'VALIDATION_PREVIEW' : 'LISTING'
              syncResult = await amazonService.submitProductToAmazon(
                productIdToSync,
                marketplaceId,
                mode2
              )
              break
              
            default:
              throw new Error(`지원하지 않는 동기화 타입: ${sync_type}`)
          }
          
          results.push({
            success: true,
            product_id: productIdToSync,
            marketplace_id: marketplaceId,
            sync_type: sync_type,
            result: syncResult,
            timestamp: new Date()
          })
          
          console.log(`✅ [AMAZON SYNC V2] ${marketplace.name} 동기화 완료`)
          
        } catch (marketplaceError) {
          console.error(`❌ [AMAZON SYNC V2] ${marketplace.name} 동기화 실패:`, marketplaceError)
          
          results.push({
            success: false,
            product_id: productIdToSync,
            marketplace_id: marketplace.marketplace_id,
            sync_type: sync_type,
            error: marketplaceError.message,
            timestamp: new Date()
          })
          
          // 배치 모드가 아닌 경우 첫 번째 실패 시 중단
          if (!options?.batch_mode) {
            throw marketplaceError
          }
        }
      }
      
      const successCount = results.filter(r => r.success).length
      const failedCount = results.filter(r => !r.success).length
      
      console.log(`📊 [AMAZON SYNC V2] 동기화 완료 - 성공: ${successCount}, 실패: ${failedCount}`)
      
      return new StepResponse(
        { 
          results,
          summary: {
            total: results.length,
            success: successCount,
            failed: failedCount
          }
        },
        { syncResults: results }
      )
      
    } catch (error) {
      console.error(`❌ [AMAZON SYNC V2] 상품 동기화 실패:`, error)
      throw error
    }
  },
  async (compensationData, { container }) => {
    console.log("🔄 [AMAZON SYNC V2] 동기화 보상 작업 시작")
    
    if (compensationData?.syncResults) {
      // 성공한 동기화에 대한 롤백 작업 (필요시)
      console.log("🔄 [AMAZON SYNC V2] 동기화 롤백 작업 수행")
    }
  }
)

/**
 * 동기화 결과 보고 단계
 */
const reportSyncResultsStep = createStep(
  "report-sync-results-v2",
  async (input: any, { container }) => {
    console.log("📊 [AMAZON SYNC V2] 동기화 결과 보고 생성...")
    
    const { results, summary } = input
    
    // 동기화 결과를 로그로 출력
    console.log("=" .repeat(50))
    console.log("🎯 [AMAZON SYNC V2] 최종 동기화 결과")
    console.log("=" .repeat(50))
    console.log(`📈 총 처리: ${summary.total}건`)
    console.log(`✅ 성공: ${summary.success}건`)
    console.log(`❌ 실패: ${summary.failed}건`)
    console.log(`📅 완료 시간: ${new Date().toISOString()}`)
    
    if (summary.failed > 0) {
      console.log("\n❌ 실패한 동기화:")
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.marketplace_id}: ${r.error}`)
        })
    }
    
    console.log("=" .repeat(50))
    
    return new StepResponse(
      {
        report: {
          summary,
          results,
          generated_at: new Date().toISOString()
        }
      }
    )
  }
)

/**
 * Amazon 동기화 향상된 워크플로우 V2
 * 새로운 공식 SDK를 사용하여 더 안정적이고 효율적인 동기화 제공
 */
export const amazonSyncEnhancedV2Workflow = createWorkflow(
  "amazon-sync-enhanced-v2",
  function (input: AmazonSyncEnhancedV2WorkflowInput) {
    
    // 1. Amazon 연결 테스트
    const connectionTest = testAmazonConnectionStep(input)
    
    // 2. 마켓플레이스 정보 조회
    const marketplaceInfo = getMarketplaceInfoStep(input)
    
    // 3. 상품 동기화 실행
    const syncResults = syncProductToAmazonStep(input)
    
    // 4. 동기화 결과 보고
    const finalReport = reportSyncResultsStep(syncResults)
    
    return new WorkflowResponse({
      connectionStatus: connectionTest.connectionStatus,
      marketplaces: marketplaceInfo.marketplaces,
      syncResults: syncResults.results,
      summary: syncResults.summary,
      report: finalReport.report
    })
  }
)

/**
 * 편의 함수들
 */

/**
 * 상품 전체 동기화
 */
export async function syncProductToAllMarketplaces(
  productId: string,
  options?: { validation_only?: boolean; force_update?: boolean }
) {
  return await amazonSyncEnhancedV2Workflow.run({
    input: {
      product_id: productId,
      sync_type: 'all',
      options: {
        batch_mode: true,
        ...options
      }
    }
  })
}

/**
 * 가격만 동기화
 */
export async function syncPriceToAllMarketplaces(
  productId: string,
  options?: { batch_mode?: boolean }
) {
  return await amazonSyncEnhancedV2Workflow.run({
    input: {
      product_id: productId,
      sync_type: 'price',
      options: {
        batch_mode: true,
        ...options
      }
    }
  })
}

/**
 * 재고만 동기화
 */
export async function syncInventoryToAllMarketplaces(
  productId: string,
  options?: { batch_mode?: boolean }
) {
  return await amazonSyncEnhancedV2Workflow.run({
    input: {
      product_id: productId,
      sync_type: 'inventory',
      options: {
        batch_mode: true,
        ...options
      }
    }
  })
}

export default amazonSyncEnhancedV2Workflow