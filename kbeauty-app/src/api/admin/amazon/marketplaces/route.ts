import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "zod"

/**
 * GET /admin/amazon/marketplaces
 * Amazon 마켓플레이스 목록 조회
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const amazonService = req.scope.resolve("amazon_integration")

    // 모든 마켓플레이스 조회
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    
    // 활성 마켓플레이스만 조회
    const activeMarketplaces = await amazonService.getActiveMarketplaces()

    // 각 마켓플레이스별 동기화 통계 추가
    const enrichedMarketplaces = await Promise.all(
      allMarketplaces.map(async (marketplace: any) => {
        try {
          // 해당 마켓플레이스의 동기화 레코드 조회
          const syncRecords = await amazonService.listAmazonProductSyncs({
            amazon_marketplace_id: marketplace.id
          })

          const completedSyncs = syncRecords.filter((s: any) => s.sync_status === "completed")
          const pendingSyncs = syncRecords.filter((s: any) => s.sync_status === "pending")
          const failedSyncs = syncRecords.filter((s: any) => s.sync_status === "failed")

          // 최근 동기화 시간 계산
          const lastSync = syncRecords
            .filter((s: any) => s.last_sync_at)
            .sort((a: any, b: any) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime())
            [0]?.last_sync_at

          const lastSuccessfulSync = completedSyncs
            .filter((s: any) => s.updated_at && s.sync_status === "completed")
            .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            [0]?.updated_at

          return {
            ...marketplace,
            sync_statistics: {
              total_count: syncRecords.length,
              completed_count: completedSyncs.length,
              pending_count: pendingSyncs.length,
              failed_count: failedSyncs.length,
              success_rate: syncRecords.length > 0 
                ? Math.round((completedSyncs.length / syncRecords.length) * 100)
                : 0,
              last_sync_attempt: lastSync,
              last_successful_sync: lastSuccessfulSync
            }
          }
        } catch (error) {
          console.error(`Error getting sync stats for marketplace ${marketplace.id}:`, error)
          return {
            ...marketplace,
            sync_statistics: {
              total_count: 0,
              completed_count: 0,
              pending_count: 0,
              failed_count: 0,
              success_rate: 0,
              last_sync_attempt: null,
              last_successful_sync: null
            }
          }
        }
      })
    )

    return res.status(200).json({
      success: true,
      data: {
        all_marketplaces: enrichedMarketplaces,
        active_marketplaces: activeMarketplaces,
        statistics: {
          total_marketplaces: allMarketplaces.length,
          active_marketplaces: activeMarketplaces.length,
          inactive_marketplaces: allMarketplaces.length - activeMarketplaces.length
        }
      }
    })

  } catch (error: any) {
    console.error("Get marketplaces error:", error)

    return res.status(500).json({
      success: false,
      error: "마켓플레이스 목록 조회 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}