import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../modules/amazon-integration/service"
import { amazonSyncProductWorkflow } from "../../../../workflows/amazon-sync-product"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/amazon/sync
 * Amazon 동기화 상태 및 통계 조회
 */
export const GET = async (
  req: MedusaRequest<{}, { 
    marketplace_id?: string
    status?: string 
    limit?: number
    offset?: number
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    const { marketplace_id, status, limit = 50, offset = 0 } = req.query
    
    // 필터 구성
    const filters: any = {}
    if (marketplace_id) filters.amazon_marketplace_id = marketplace_id
    if (status) filters.sync_status = status
    
    // 동기화 레코드 조회
    const syncRecords = await amazonService.listAmazonProductSyncs(filters)
    
    // 페이지네이션
    const paginatedRecords = syncRecords.slice(offset, offset + limit)
    
    // 통계 정보
    const statistics = await amazonService.getSyncStatistics(marketplace_id)
    
    // 활성 마켓플레이스 목록
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    
    res.json({
      sync_records: paginatedRecords,
      statistics,
      active_marketplaces: activeMarketplaces.length,
      pagination: {
        total: syncRecords.length,
        limit,
        offset,
        has_more: syncRecords.length > offset + limit
      }
    })
    
  } catch (error) {
    res.status(500).json({
      message: "동기화 상태 조회 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * POST /admin/amazon/sync
 * 수동 Amazon 동기화 실행
 */
export const POST = async (
  req: MedusaRequest<{
    product_id: string
    marketplace_ids?: string[]
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  
  try {
    const { product_id, marketplace_ids } = req.body
    
    if (!product_id) {
      return res.status(400).json({
        message: "product_id는 필수입니다"
      })
    }
    
    // 상품 조회
    const product = await productService.retrieveProduct(product_id)
    
    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다"
      })
    }
    
    // Amazon 동기화 워크플로우 실행
    const { result } = await amazonSyncProductWorkflow(req.scope).run({
      input: {
        product,
        marketplace_ids
      }
    })
    
    res.json({
      message: "Amazon 동기화가 시작되었습니다",
      result
    })
    
  } catch (error) {
    res.status(500).json({
      message: "동기화 실행 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * PUT /admin/amazon/sync/retry
 * 실패한 동기화 재시도
 */
export const PUT = async (
  req: MedusaRequest<{
    sync_record_ids?: string[]
    marketplace_id?: string
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  
  try {
    const { sync_record_ids, marketplace_id } = req.body
    
    let recordsToRetry = []
    
    if (sync_record_ids?.length) {
      // 특정 동기화 레코드들 재시도
      recordsToRetry = await amazonService.listAmazonProductSyncs({
        id: sync_record_ids
      })
    } else if (marketplace_id) {
      // 특정 마켓플레이스의 실패한 동기화들 재시도
      recordsToRetry = await amazonService.listAmazonProductSyncs({
        amazon_marketplace_id: marketplace_id,
        sync_status: "failed"
      })
    } else {
      // 모든 실패한 동기화 재시도
      recordsToRetry = await amazonService.getFailedSyncs()
    }
    
    if (recordsToRetry.length === 0) {
      return res.json({
        message: "재시도할 동기화 레코드가 없습니다",
        retried_count: 0
      })
    }
    
    let successCount = 0
    let errorCount = 0
    
    // 각 동기화 레코드에 대해 재시도
    for (const syncRecord of recordsToRetry) {
      try {
        // 상품 조회
        const product = await productService.retrieveProduct(syncRecord.medusa_product_id)
        
        if (!product) {
          errorCount++
          continue
        }
        
        // 동기화 재시도
        await amazonSyncProductWorkflow(req.scope).run({
          input: {
            product,
            marketplace_ids: [syncRecord.amazon_marketplace_id]
          }
        })
        
        successCount++
        
      } catch (error) {
        console.error(`동기화 재시도 실패: ${syncRecord.id}`, error)
        errorCount++
      }
    }
    
    res.json({
      message: `${successCount}개 동기화 재시도 완료, ${errorCount}개 실패`,
      retried_count: successCount,
      error_count: errorCount,
      total_attempted: recordsToRetry.length
    })
    
  } catch (error) {
    res.status(500).json({
      message: "동기화 재시도 중 오류 발생", 
      error: error.message
    })
  }
} 