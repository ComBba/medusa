// @ts-nocheck - 임시 타입 체크 비활성화 (점진적 개선 예정)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/amazon/sync/stats
 * Amazon 동기화 통계 및 대시보드 데이터 조회
 */
export const GET = async (
  req: MedusaRequest<{}, { 
    marketplace_id?: string
    period?: string // 'day' | 'week' | 'month' | 'year'
    date_from?: string
    date_to?: string
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  
  try {
    const { marketplace_id, period = 'week', date_from, date_to } = req.query
    
    // 기간 설정
    const now = new Date()
    let startDate: Date
    let endDate = new Date(now)
    
    if (date_from && date_to) {
      startDate = new Date(date_from as string)
      endDate = new Date(date_to as string)
    } else {
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }
    }
    
    // 필터 구성
    const filters: any = {
      created_at: {
        $gte: startDate,
        $lte: endDate
      }
    }
    
    if (marketplace_id) {
      filters.amazon_marketplace_id = marketplace_id
    }
    
    // 동기화 레코드 조회
    const syncRecords = await amazonService.listAmazonProductSyncs(filters)
    
    // 전체 통계
    const overallStats = {
      total_syncs: syncRecords.length,
      successful_syncs: syncRecords.filter(r => r.sync_status === 'completed').length,
      failed_syncs: syncRecords.filter(r => r.sync_status === 'failed').length,
      pending_syncs: syncRecords.filter(r => r.sync_status === 'pending').length,
      processing_syncs: syncRecords.filter(r => r.sync_status === 'processing').length,
    }
    
    overallStats['success_rate'] = overallStats.total_syncs > 0 
      ? Math.round((overallStats.successful_syncs / overallStats.total_syncs) * 100)
      : 0
    
    // 동기화 타입별 통계
    const syncTypeStats = {
      product: {
        total: syncRecords.filter(r => r.sync_type === 'product').length,
        successful: syncRecords.filter(r => r.sync_type === 'product' && r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_type === 'product' && r.sync_status === 'failed').length
      },
      inventory: {
        total: syncRecords.filter(r => r.sync_type === 'inventory').length,
        successful: syncRecords.filter(r => r.sync_type === 'inventory' && r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_type === 'inventory' && r.sync_status === 'failed').length
      },
      price: {
        total: syncRecords.filter(r => r.sync_type === 'price').length,
        successful: syncRecords.filter(r => r.sync_type === 'price' && r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_type === 'price' && r.sync_status === 'failed').length
      }
    }
    
    // 마켓플레이스별 상세 통계
    const marketplaceStats = {}
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    
    for (const marketplace of activeMarketplaces) {
      const marketplaceRecords = syncRecords.filter(r => r.amazon_marketplace_id === marketplace.marketplace_id)
      
      marketplaceStats[marketplace.marketplace_id] = {
        marketplace_name: marketplace.name,
        marketplace_country: marketplace.country_code,
        is_active: marketplace.is_active,
        total_syncs: marketplaceRecords.length,
        successful_syncs: marketplaceRecords.filter(r => r.sync_status === 'completed').length,
        failed_syncs: marketplaceRecords.filter(r => r.sync_status === 'failed').length,
        pending_syncs: marketplaceRecords.filter(r => r.sync_status === 'pending').length,
        success_rate: marketplaceRecords.length > 0 
          ? Math.round((marketplaceRecords.filter(r => r.sync_status === 'completed').length / marketplaceRecords.length) * 100)
          : 0,
        last_sync_at: marketplaceRecords.length > 0
          ? new Date(Math.max(...marketplaceRecords.map(r => new Date(r.updated_at).getTime())))
          : null,
        by_sync_type: {
          product: marketplaceRecords.filter(r => r.sync_type === 'product').length,
          inventory: marketplaceRecords.filter(r => r.sync_type === 'inventory').length,
          price: marketplaceRecords.filter(r => r.sync_type === 'price').length
        }
      }
    }
    
    // 시간대별 동기화 활동 (차트용 데이터)
    const timeSeriesData = []
    const timeInterval = period === 'day' ? 'hour' : period === 'week' ? 'day' : 'day'
    const intervalMs = timeInterval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    
    let currentTime = new Date(startDate)
    while (currentTime <= endDate) {
      const nextTime = new Date(currentTime.getTime() + intervalMs)
      
      const recordsInInterval = syncRecords.filter(r => {
        const recordTime = new Date(r.created_at)
        return recordTime >= currentTime && recordTime < nextTime
      })
      
      timeSeriesData.push({
        timestamp: currentTime.toISOString(),
        total_syncs: recordsInInterval.length,
        successful_syncs: recordsInInterval.filter(r => r.sync_status === 'completed').length,
        failed_syncs: recordsInInterval.filter(r => r.sync_status === 'failed').length,
        product_syncs: recordsInInterval.filter(r => r.sync_type === 'product').length,
        inventory_syncs: recordsInInterval.filter(r => r.sync_type === 'inventory').length,
        price_syncs: recordsInInterval.filter(r => r.sync_type === 'price').length
      })
      
      currentTime = nextTime
    }
    
    // 상품별 동기화 상태
    const productSyncStats = {}
    const uniqueProductIds = [...new Set(syncRecords.map(r => r.medusa_product_id))]
    
    for (const productId of uniqueProductIds.slice(0, 20)) { // 최대 20개 상품만
      try {
        const product = await productService.retrieveProduct(productId)
        const productRecords = syncRecords.filter(r => r.medusa_product_id === productId)
        
        productSyncStats[productId] = {
          product_title: product?.title || 'Unknown Product',
          product_handle: product?.handle,
          total_syncs: productRecords.length,
          successful_syncs: productRecords.filter(r => r.sync_status === 'completed').length,
          failed_syncs: productRecords.filter(r => r.sync_status === 'failed').length,
          last_sync_at: productRecords.length > 0
            ? new Date(Math.max(...productRecords.map(r => new Date(r.updated_at).getTime())))
            : null,
          sync_status_by_marketplace: {}
        }
        
        // 마켓플레이스별 상태
        for (const marketplace of activeMarketplaces) {
          const marketplaceRecords = productRecords.filter(r => r.amazon_marketplace_id === marketplace.marketplace_id)
          if (marketplaceRecords.length > 0) {
            const latestRecord = marketplaceRecords.reduce((latest, current) => 
              new Date(current.updated_at) > new Date(latest.updated_at) ? current : latest
            )
            productSyncStats[productId].sync_status_by_marketplace[marketplace.marketplace_id] = {
              status: latestRecord.sync_status,
              last_sync_at: latestRecord.updated_at,
              sync_type: latestRecord.sync_type
            }
          }
        }
      } catch (error) {
        console.error(`Error retrieving product ${productId}:`, error)
      }
    }
    
    // 오류 분석
    const errorAnalysis = {}
    const failedRecords = syncRecords.filter(r => r.sync_status === 'failed')
    
    failedRecords.forEach(record => {
      const errorMessage = record.error_message || 'Unknown error'
      if (!errorAnalysis[errorMessage]) {
        errorAnalysis[errorMessage] = {
          count: 0,
          first_occurrence: record.updated_at,
          last_occurrence: record.updated_at,
          affected_products: new Set(),
          affected_marketplaces: new Set()
        }
      }
      
      errorAnalysis[errorMessage].count++
      errorAnalysis[errorMessage].affected_products.add(record.medusa_product_id)
      errorAnalysis[errorMessage].affected_marketplaces.add(record.amazon_marketplace_id)
      
      if (new Date(record.updated_at) > new Date(errorAnalysis[errorMessage].last_occurrence)) {
        errorAnalysis[errorMessage].last_occurrence = record.updated_at
      }
    })
    
    // Set을 배열로 변환
    Object.values(errorAnalysis).forEach((analysis: any) => {
      analysis.affected_products = Array.from(analysis.affected_products)
      analysis.affected_marketplaces = Array.from(analysis.affected_marketplaces)
    })
    
    res.json({
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      },
      overall_stats: overallStats,
      sync_type_stats: syncTypeStats,
      marketplace_stats: marketplaceStats,
      time_series_data: timeSeriesData,
      product_sync_stats: productSyncStats,
      error_analysis: errorAnalysis,
      summary: {
        active_marketplaces: activeMarketplaces.length,
        total_products_synced: uniqueProductIds.length,
        avg_daily_syncs: Math.round(syncRecords.length / Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))),
        health_score: Math.round((overallStats.success_rate + (activeMarketplaces.length * 10)) / 2) // 간단한 건강도 점수
      }
    })
    
  } catch (error) {
    console.error("Sync stats error:", error)
    res.status(500).json({
      message: "동기화 통계 조회 중 오류 발생",
      error: error.message
    })
  }
}