import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "zod"

// 마켓플레이스 업데이트 스키마
const updateMarketplaceSchema = z.object({
  is_active: z.boolean(),
  name: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  settings: z.object({
    auto_sync_enabled: z.boolean().optional(),
    sync_interval_minutes: z.number().min(5).max(1440).optional(),
    max_retry_attempts: z.number().min(1).max(10).optional(),
    rate_limit_per_second: z.number().min(1).max(100).optional(),
  }).optional()
})

/**
 * GET /admin/amazon/marketplaces/:id
 * 특정 마켓플레이스 상세 정보 조회
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const marketplaceId = req.params.id

    if (!marketplaceId) {
      return res.status(400).json({
        success: false,
        error: "마켓플레이스 ID가 필요합니다."
      })
    }

    const amazonService = req.scope.resolve("amazon_integration")

    // 마켓플레이스 조회
    const marketplace = await amazonService.retrieveAmazonMarketplace(marketplaceId)

    if (!marketplace) {
      return res.status(404).json({
        success: false,
        error: "마켓플레이스를 찾을 수 없습니다."
      })
    }

    // 해당 마켓플레이스의 동기화 레코드 통계
    const syncRecords = await amazonService.listAmazonProductSyncs({
      amazon_marketplace_id: marketplaceId
    })

    const completedSyncs = syncRecords.filter((s: any) => s.sync_status === "completed")
    const pendingSyncs = syncRecords.filter((s: any) => s.sync_status === "pending")
    const failedSyncs = syncRecords.filter((s: any) => s.sync_status === "failed")
    const inProgressSyncs = syncRecords.filter((s: any) => s.sync_status === "in_progress")

    // 최근 동기화 활동 (최근 7일)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentSyncs = syncRecords.filter((s: any) => 
      s.updated_at && new Date(s.updated_at) > weekAgo
    )

    // 일별 동기화 통계 (최근 7일)
    const dailyStats: any[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))
      
      const daySyncs = syncRecords.filter((s: any) => {
        const syncDate = new Date(s.updated_at)
        return syncDate >= dayStart && syncDate <= dayEnd
      })

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        total_syncs: daySyncs.length,
        completed_syncs: daySyncs.filter((s: any) => s.sync_status === "completed").length,
        failed_syncs: daySyncs.filter((s: any) => s.sync_status === "failed").length,
      })
    }

    // 최근 에러 분석
    const recentErrors = failedSyncs
      .filter((s: any) => s.error_message && s.updated_at)
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
      .map((s: any) => ({
        product_id: s.medusa_product_id,
        error_message: s.error_message,
        sync_attempts: s.sync_attempts,
        last_attempt: s.last_sync_attempt,
      }))

    // 에러 패턴 분석
    const errorPatterns = failedSyncs.reduce((acc: any, sync: any) => {
      if (sync.error_message) {
        const errorType = sync.error_message.split(':')[0] || 'Unknown Error'
        acc[errorType] = (acc[errorType] || 0) + 1
      }
      return acc
    }, {})

    return res.status(200).json({
      success: true,
      data: {
        marketplace,
        statistics: {
          sync_records: {
            total: syncRecords.length,
            completed: completedSyncs.length,
            pending: pendingSyncs.length,
            failed: failedSyncs.length,
            in_progress: inProgressSyncs.length,
          },
          success_rate: syncRecords.length > 0 
            ? Math.round((completedSyncs.length / syncRecords.length) * 100)
            : 0,
          recent_activity: {
            last_7_days_syncs: recentSyncs.length,
            daily_statistics: dailyStats,
          },
          error_analysis: {
            recent_errors: recentErrors,
            error_patterns: errorPatterns,
          }
        },
        last_sync_attempt: syncRecords
          .filter((s: any) => s.last_sync_at)
          .sort((a: any, b: any) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime())
          [0]?.last_sync_at,
        last_successful_sync: completedSyncs
          .filter((s: any) => s.updated_at && s.sync_status === "completed")
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          [0]?.updated_at,
      }
    })

  } catch (error: any) {
    console.error("Get marketplace details error:", error)

    return res.status(500).json({
      success: false,
      error: "마켓플레이스 상세 정보 조회 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

/**
 * PUT /admin/amazon/marketplaces/:id
 * 마켓플레이스 설정 업데이트
 */
export const PUT = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const marketplaceId = req.params.id

    if (!marketplaceId) {
      return res.status(400).json({
        success: false,
        error: "마켓플레이스 ID가 필요합니다."
      })
    }

    // 요청 데이터 검증
    const validatedData = updateMarketplaceSchema.parse(req.body)

    const amazonService = req.scope.resolve("amazon_integration")

    // 마켓플레이스 존재 확인
    const existingMarketplace = await amazonService.retrieveAmazonMarketplace(marketplaceId)

    if (!existingMarketplace) {
      return res.status(404).json({
        success: false,
        error: "마켓플레이스를 찾을 수 없습니다."
      })
    }

    // 마켓플레이스 업데이트  
    const updateData = {
      is_active: validatedData.is_active,
      name: validatedData.name,
      currency_code: validatedData.currency,
      region: validatedData.timezone,
      updated_at: new Date(),
    }
    
    const updatedMarketplace = await amazonService.updateAmazonMarketplaces({
      id: marketplaceId,
      ...updateData
    })

    // 활성화/비활성화 로그
    if (validatedData.is_active !== existingMarketplace.is_active) {
      console.log(`Marketplace ${marketplaceId} ${validatedData.is_active ? 'activated' : 'deactivated'}`)
    }

    return res.status(200).json({
      success: true,
      message: "마켓플레이스 설정이 업데이트되었습니다.",
      data: updatedMarketplace
    })

  } catch (error: any) {
    console.error("Update marketplace error:", error)

    // Zod 검증 에러 처리
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: "입력 데이터가 올바르지 않습니다.",
        details: error.errors
      })
    }

    return res.status(500).json({
      success: false,
      error: "마켓플레이스 업데이트 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

/**
 * DELETE /admin/amazon/marketplaces/:id
 * 마켓플레이스 삭제 (비활성화)
 */
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const marketplaceId = req.params.id

    if (!marketplaceId) {
      return res.status(400).json({
        success: false,
        error: "마켓플레이스 ID가 필요합니다."
      })
    }

    const amazonService = req.scope.resolve("amazon_integration")

    // 마켓플레이스 존재 확인
    const marketplace = await amazonService.retrieveAmazonMarketplace(marketplaceId)

    if (!marketplace) {
      return res.status(404).json({
        success: false,
        error: "마켓플레이스를 찾을 수 없습니다."
      })
    }

    // 연관된 동기화 레코드 확인
    const syncRecords = await amazonService.listAmazonProductSyncs({
      amazon_marketplace_id: marketplaceId
    })

    // 활성 동기화가 있는 경우 경고
    const activeSyncs = syncRecords.filter((s: any) => 
      s.sync_status === "pending" || s.sync_status === "in_progress"
    )

    if (activeSyncs.length > 0) {
      return res.status(409).json({
        success: false,
        error: "진행 중인 동기화가 있어 마켓플레이스를 삭제할 수 없습니다.",
        details: {
          active_syncs: activeSyncs.length,
          suggestion: "진행 중인 동기화를 완료하거나 취소한 후 다시 시도하세요."
        }
      })
    }

    // 마켓플레이스 비활성화 (실제 삭제 대신)
    const deactivateData = {
      is_active: false,
      updated_at: new Date(),
    }
    
    const deactivatedMarketplace = await amazonService.updateAmazonMarketplaces({
      id: marketplaceId,
      ...deactivateData
    })

    console.log(`Marketplace ${marketplaceId} deactivated`)

    return res.status(200).json({
      success: true,
      message: "마켓플레이스가 비활성화되었습니다.",
      data: {
        marketplace: deactivatedMarketplace,
        affected_sync_records: syncRecords.length,
      }
    })

  } catch (error: any) {
    console.error("Delete marketplace error:", error)

    return res.status(500).json({
      success: false,
      error: "마켓플레이스 삭제 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}