import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { amazonSyncProductV2Workflow } from "../../../../../workflows/amazon-sync-product-v2"
import { z } from "zod"

// 요청 스키마 정의
const syncProductSchema = z.object({
  product_id: z.string().optional(),
  product: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    // ... 기타 필요한 필드들
  }).optional(),
  marketplace_ids: z.array(z.string()).optional(),
  options: z.object({
    sync_images: z.boolean().optional().default(true),
    include_variants: z.boolean().optional().default(true),
    force_update: z.boolean().optional().default(false),
  }).optional()
})

/**
 * POST /admin/amazon/sync/product
 * 단일 상품 Amazon 동기화
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    // 요청 데이터 검증
    const validatedData = syncProductSchema.parse(req.body)
    
    // 상품 ID가 제공되지 않은 경우 확인
    if (!validatedData.product_id && !validatedData.product) {
      return res.status(400).json({
        success: false,
        error: "product_id 또는 product 정보가 필요합니다."
      })
    }

    // 워크플로우 실행
    const { result } = await amazonSyncProductV2Workflow(req.scope).run({
      input: {
        product_id: validatedData.product_id,
        product: validatedData.product as any,
        marketplace_ids: validatedData.marketplace_ids,
        options: validatedData.options
      }
    })

    return res.status(200).json({
      success: true,
      message: "상품 동기화가 완료되었습니다.",
      data: result
    })

  } catch (error: any) {
    console.error("Amazon product sync error:", error)

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
        error: "동기화 처리 중 오류가 발생했습니다.",
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
 * GET /admin/amazon/sync/product/:id
 * 특정 상품의 동기화 상태 조회
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const productId = req.params.id

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: "상품 ID가 필요합니다."
      })
    }

    // Amazon 통합 서비스에서 동기화 상태 조회
    const amazonService = req.scope.resolve("amazon_integration")
    const syncStatus = await amazonService.getProductSyncStatus(productId)

    // 마켓플레이스 정보와 함께 반환
    const marketplaces = await amazonService.getActiveMarketplaces()
    
    // 동기화 레코드와 마켓플레이스 정보 결합
    const enrichedSyncRecords = syncStatus.map((record: any) => {
      const marketplace = marketplaces.find((m: any) => m.id === record.amazon_marketplace_id)
      return {
        ...record,
        marketplace_name: marketplace?.name || marketplace?.marketplace_id,
        marketplace_country: marketplace?.country_code,
      }
    })

    // 마지막 성공한 동기화 시간 계산
    const lastSuccessfulSync = enrichedSyncRecords
      .filter((record: any) => record.sync_status === "completed" && record.last_successful_sync)
      .sort((a: any, b: any) => new Date(b.last_successful_sync).getTime() - new Date(a.last_successful_sync).getTime())
      [0]?.last_successful_sync

    return res.status(200).json({
      success: true,
      data: {
        product_id: productId,
        sync_records: enrichedSyncRecords,
        last_successful_sync: lastSuccessfulSync,
        statistics: {
          total_marketplaces: enrichedSyncRecords.length,
          completed_syncs: enrichedSyncRecords.filter((r: any) => r.sync_status === "completed").length,
          pending_syncs: enrichedSyncRecords.filter((r: any) => r.sync_status === "pending").length,
          failed_syncs: enrichedSyncRecords.filter((r: any) => r.sync_status === "failed").length,
        }
      }
    })

  } catch (error: any) {
    console.error("Get sync status error:", error)

    return res.status(500).json({
      success: false,
      error: "동기화 상태 조회 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}