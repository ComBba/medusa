import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { amazonSyncBatchV2Workflow } from "../../../../../workflows/amazon-sync-batch-v2"
import { z } from "zod"

// 배치 동기화 요청 스키마
const syncBatchSchema = z.object({
  filters: z.object({
    status: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    collection_ids: z.array(z.string()).optional(),
    created_at: z.object({
      gte: z.string().transform(str => new Date(str)).optional(),
      lte: z.string().transform(str => new Date(str)).optional(),
    }).optional(),
    updated_at: z.object({
      gte: z.string().transform(str => new Date(str)).optional(),
      lte: z.string().transform(str => new Date(str)).optional(),
    }).optional(),
  }).optional(),
  marketplace_ids: z.array(z.string()).optional(),
  options: z.object({
    batch_size: z.number().min(1).max(100).optional().default(10),
    concurrent_batches: z.number().min(1).max(10).optional().default(3),
    sync_images: z.boolean().optional().default(true),
    include_variants: z.boolean().optional().default(true),
    force_update: z.boolean().optional().default(false),
    dry_run: z.boolean().optional().default(false),
  }).optional(),
  pagination: z.object({
    limit: z.number().min(1).max(1000).optional().default(100),
    offset: z.number().min(0).optional().default(0),
  }).optional()
})

/**
 * POST /admin/amazon/sync/batch
 * 배치 상품 Amazon 동기화
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    // 요청 데이터 검증
    const validatedData = syncBatchSchema.parse(req.body)

    // 기본 필터 설정 (published 상품만)
    const filters = {
      status: ["published"],
      ...validatedData.filters
    }

    console.log("Starting batch sync with options:", {
      filters,
      marketplace_ids: validatedData.marketplace_ids,
      options: validatedData.options,
      pagination: validatedData.pagination
    })

    // 배치 워크플로우 실행
    const { result } = await amazonSyncBatchV2Workflow(req.scope).run({
      input: {
        filters,
        marketplace_ids: validatedData.marketplace_ids,
        options: validatedData.options,
        pagination: validatedData.pagination
      }
    })

    return res.status(200).json({
      success: true,
      message: validatedData.options?.dry_run 
        ? "배치 동기화 시뮬레이션이 완료되었습니다."
        : "배치 동기화가 완료되었습니다.",
      data: result
    })

  } catch (error: any) {
    console.error("Amazon batch sync error:", error)

    // Zod 검증 에러 처리
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: "입력 데이터가 올바르지 않습니다.",
        details: error.errors
      })
    }

    // 워크플로우 에러 처리
    if (error.type === 'workflow_error') {
      return res.status(422).json({
        success: false,
        error: "배치 동기화 처리 중 오류가 발생했습니다.",
        details: error.message
      })
    }

    // 일반 에러 처리
    return res.status(500).json({
      success: false,
      error: "서버 내부 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

/**
 * GET /admin/amazon/sync/batch/status
 * 전체 배치 동기화 상태 조회
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    // Amazon 통합 서비스에서 전체 통계 조회
    const amazonService = req.scope.resolve("amazon_integration")
    const productService = req.scope.resolve("product")

    // 전체 상품 수 조회
    const [, totalProductCount] = await productService.listAndCountProducts({
      status: ["published"]
    })

    // 동기화된 상품 통계 조회
    const syncedProducts = await amazonService.listAmazonProductSyncs({
      sync_status: "completed"
    })

    // 대기 중인 동기화 조회
    const pendingSyncs = await amazonService.listAmazonProductSyncs({
      sync_status: "pending"
    })

    // 실패한 동기화 조회
    const failedSyncs = await amazonService.listAmazonProductSyncs({
      sync_status: "failed"
    })

    // 유니크한 상품 ID 계산
    const uniqueSyncedProducts = new Set(syncedProducts.map((s: any) => s.medusa_product_id)).size
    const uniquePendingProducts = new Set(pendingSyncs.map((s: any) => s.medusa_product_id)).size
    const uniqueFailedProducts = new Set(failedSyncs.map((s: any) => s.medusa_product_id)).size

    // 마켓플레이스별 통계
    const marketplaces = await amazonService.getActiveMarketplaces()
    const marketplaceStats = await Promise.all(
      marketplaces.map(async (marketplace: any) => {
        const marketplaceSyncs = await amazonService.listAmazonProductSyncs({
          amazon_marketplace_id: marketplace.id
        })

        const completedSyncs = marketplaceSyncs.filter((s: any) => s.sync_status === "completed")
        const pendingSyncs = marketplaceSyncs.filter((s: any) => s.sync_status === "pending")
        const failedSyncs = marketplaceSyncs.filter((s: any) => s.sync_status === "failed")

        return {
          marketplace_id: marketplace.marketplace_id,
          marketplace_name: marketplace.name,
          country: marketplace.country,
          is_active: marketplace.is_active,
          sync_statistics: {
            total_count: marketplaceSyncs.length,
            completed_count: completedSyncs.length,
            pending_count: pendingSyncs.length,
            failed_count: failedSyncs.length,
            success_rate: marketplaceSyncs.length > 0 
              ? Math.round((completedSyncs.length / marketplaceSyncs.length) * 100)
              : 0
          }
        }
      })
    )

    // 최근 동기화 활동 조회 (최근 24시간)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentSyncs = await amazonService.listAmazonProductSyncs({
      updated_at: {
        gte: yesterday
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        statistics: {
          total_products: totalProductCount,
          synced_products: uniqueSyncedProducts,
          pending_syncs: uniquePendingProducts,
          failed_syncs: uniqueFailedProducts,
          sync_rate: totalProductCount > 0 
            ? Math.round((uniqueSyncedProducts / totalProductCount) * 100)
            : 0
        },
        marketplace_statistics: marketplaceStats,
        recent_activity: {
          last_24h_syncs: recentSyncs.length,
          last_24h_completed: recentSyncs.filter((s: any) => s.sync_status === "completed").length,
          last_24h_failed: recentSyncs.filter((s: any) => s.sync_status === "failed").length,
        },
        last_updated: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error("Get batch sync status error:", error)

    return res.status(500).json({
      success: false,
      error: "배치 동기화 상태 조회 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}