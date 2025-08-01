import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/amazon/sync/status
 * 전체 Amazon 동기화 상태 조회
 */
export const GET = async (
  req: MedusaRequest<{}, { 
    marketplace_id?: string
    sync_type?: string
    status?: string
    product_id?: string
    limit?: number
    offset?: number
    date_from?: string
    date_to?: string
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    const { 
      marketplace_id, 
      sync_type, 
      status, 
      product_id,
      limit: limitParam = 50, 
      offset: offsetParam = 0,
      date_from,
      date_to
    } = req.query
    
    // Query parameters 타입 변환
    const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : (limitParam as number) || 50
    const offset = typeof offsetParam === 'string' ? parseInt(offsetParam, 10) : (offsetParam as number) || 0
    
    // 필터 구성
    const filters: any = {}
    if (marketplace_id) filters.amazon_marketplace_id = marketplace_id
    if (sync_type) filters.sync_type = sync_type
    if (status) filters.sync_status = status
    if (product_id) filters.medusa_product_id = product_id
    
    // 날짜 필터링
    if (date_from || date_to) {
      filters.created_at = {}
      if (date_from) filters.created_at.$gte = new Date(date_from as string)
      if (date_to) filters.created_at.$lte = new Date(date_to as string)
    }
    
    // 동기화 레코드 조회
    const syncRecords = await amazonService.listAmazonProductSyncs(filters)
    
    // 페이지네이션
    const paginatedRecords = syncRecords.slice(offset, offset + limit)
    
    // 전체 통계
    const totalStats = {
      total_records: syncRecords.length,
      by_status: {
        pending: syncRecords.filter(r => r.sync_status === 'pending').length,
        processing: syncRecords.filter(r => r.sync_status === 'processing').length,
        completed: syncRecords.filter(r => r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_status === 'failed').length
      },
      by_sync_type: {
        product: syncRecords.filter(r => r.sync_type === 'product').length,
        inventory: syncRecords.filter(r => r.sync_type === 'inventory').length,
        price: syncRecords.filter(r => r.sync_type === 'price').length,
        all: syncRecords.filter(r => r.sync_type === 'all').length
      }
    }
    
    // 마켓플레이스별 통계
    const marketplaceStats = {}
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    
    for (const marketplace of activeMarketplaces) {
      const marketplaceRecords = syncRecords.filter(r => r.amazon_marketplace_id === marketplace.marketplace_id)
      marketplaceStats[marketplace.marketplace_id] = {
        marketplace_name: marketplace.name,
        total_syncs: marketplaceRecords.length,
        successful: marketplaceRecords.filter(r => r.sync_status === 'completed').length,
        failed: marketplaceRecords.filter(r => r.sync_status === 'failed').length,
        pending: marketplaceRecords.filter(r => r.sync_status === 'pending').length,
        last_sync: marketplaceRecords.length > 0 
          ? Math.max(...marketplaceRecords.map(r => new Date(r.updated_at).getTime()))
          : null
      }
    }
    
    // 최근 동기화 활동
    const recentActivity = syncRecords
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
    
    // 실패한 동기화 상세
    const failedSyncs = syncRecords
      .filter(r => r.sync_status === 'failed')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
    
    res.json({
      sync_records: paginatedRecords,
      statistics: {
        total: totalStats,
        by_marketplace: marketplaceStats,
        recent_activity: recentActivity,
        failed_syncs: failedSyncs
      },
      pagination: {
        total: syncRecords.length,
        limit,
        offset,
        has_more: syncRecords.length > offset + limit
      },
      filters: {
        marketplace_id,
        sync_type,
        status,
        product_id,
        date_from,
        date_to
      }
    })
    
  } catch (error) {
    console.error("Sync status error:", error)
    res.status(500).json({
      message: "동기화 상태 조회 중 오류 발생",
      error: error.message
    })
  }
}