// @ts-nocheck - 임시 타입 체크 비활성화 (점진적 개선 예정)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { amazonSyncProductWorkflow } from "../../../../../workflows/amazon-sync-product"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/amazon/sync/product
 * 상품 정보를 Amazon에 동기화
 */
export const POST = async (
  req: MedusaRequest<{
    product_id: string
    marketplace_ids?: string[]
    options?: {
      force_update?: boolean
      include_variants?: boolean
      sync_images?: boolean
    }
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  
  try {
    const { product_id, marketplace_ids, options = {} } = req.body
    
    if (!product_id) {
      return res.status(400).json({
        message: "product_id는 필수입니다"
      })
    }
    
    // 상품 조회 (variants와 이미지 포함)
    const product = await productService.retrieveProduct(product_id, {
      relations: ["variants", "images", "categories", "tags"]
    })
    
    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다"
      })
    }
    
    // 활성화된 마켓플레이스 목록 가져오기 (지정되지 않은 경우)
    let targetMarketplaces = marketplace_ids
    if (!targetMarketplaces || targetMarketplaces.length === 0) {
      const activeMarketplaces = await amazonService.getActiveMarketplaces()
      targetMarketplaces = activeMarketplaces.map(m => m.marketplace_id)
    }
    
    if (targetMarketplaces.length === 0) {
      return res.status(400).json({
        message: "활성화된 Amazon 마켓플레이스가 없습니다"
      })
    }
    
    // 동기화 옵션 설정
    const syncOptions = {
      force_update: options.force_update || false,
      include_variants: options.include_variants !== false, // 기본값 true
      sync_images: options.sync_images !== false, // 기본값 true
      sync_type: "product" as const
    }
    
    // 상품 동기화 워크플로우 실행
    const { result } = await amazonSyncProductWorkflow(req.scope).run({
      input: {
        product,
        marketplace_ids: targetMarketplaces,
        options: syncOptions
      }
    })
    
    // 동기화 결과 기록
    const syncResults = []
    for (const marketplaceId of targetMarketplaces) {
      const syncRecord = await amazonService.createProductSync({
        medusa_product_id: product_id,
        amazon_marketplace_id: marketplaceId,
        sync_type: "product",
        sync_status: "pending",
        metadata: {
          options: syncOptions,
          initiated_by: "manual",
          initiated_at: new Date().toISOString()
        }
      })
      syncResults.push(syncRecord)
    }
    
    res.json({
      message: "상품 동기화가 시작되었습니다",
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle
      },
      target_marketplaces: targetMarketplaces,
      sync_records: syncResults,
      options: syncOptions,
      workflow_result: result
    })
    
  } catch (error) {
    console.error("Product sync error:", error)
    res.status(500).json({
      message: "상품 동기화 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * GET /admin/amazon/sync/product/:product_id
 * 특정 상품의 동기화 상태 조회
 */
export const GET = async (
  req: MedusaRequest<{}, { marketplace_id?: string }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  
  try {
    const { product_id } = req.params
    const { marketplace_id } = req.query
    
    if (!product_id) {
      return res.status(400).json({
        message: "product_id는 필수입니다"
      })
    }
    
    // 상품 존재 확인
    const product = await productService.retrieveProduct(product_id)
    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다"
      })
    }
    
    // 동기화 레코드 조회
    const filters: any = { medusa_product_id: product_id }
    if (marketplace_id) {
      filters.amazon_marketplace_id = marketplace_id
    }
    
    const syncRecords = await amazonService.listAmazonProductSyncs(filters)
    
    // 마켓플레이스별 최신 동기화 상태 정리
    const marketplaceStatus = {}
    syncRecords.forEach(record => {
      const marketplaceId = record.amazon_marketplace_id
      if (!marketplaceStatus[marketplaceId] || 
          new Date(record.updated_at) > new Date(marketplaceStatus[marketplaceId].updated_at)) {
        marketplaceStatus[marketplaceId] = record
      }
    })
    
    res.json({
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle
      },
      sync_records: syncRecords,
      marketplace_status: marketplaceStatus,
      summary: {
        total_syncs: syncRecords.length,
        successful: syncRecords.filter(r => r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_status === 'failed').length,
        pending: syncRecords.filter(r => r.sync_status === 'pending').length
      }
    })
    
  } catch (error) {
    console.error("Product sync status error:", error)
    res.status(500).json({
      message: "상품 동기화 상태 조회 중 오류 발생",
      error: error.message
    })
  }
}