import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import AmazonIntegrationModuleService from "../../../../modules/amazon-integration/service"

/**
 * GET /admin/amazon/sync - 상품 동기화 목록 조회
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve("amazonIntegrationModuleService")
  
  try {
    const {
      marketplace_id,
      status,
      limit = "20",
      offset = "0",
      search
    } = req.query

    // 쿼리 매개변수 구성
    const filters: any = {}
    if (marketplace_id) filters.amazon_marketplace_id = marketplace_id
    if (status && status !== 'all') filters.sync_status = status
    if (search) {
      // 상품명, SKU, ASIN으로 검색
      filters.$or = [
        { amazon_sku: { $ilike: `%${search}%` } },
        { amazon_asin: { $ilike: `%${search}%` } }
      ]
    }

    const pagination = {
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10)
    }

    // 실제 데이터베이스에서 동기화 레코드 조회
    const syncRecords = await amazonService.listAmazonProductSyncs(filters, pagination)
    const totalCount = await amazonService.countAmazonProductSyncs(filters)

    res.json({
      sync_records: syncRecords,
      pagination: {
        total: totalCount,
        limit: pagination.take,
        offset: pagination.skip,
        has_more: pagination.skip + pagination.take < totalCount
      }
    })

  } catch (error) {
    console.error('Failed to fetch sync records:', error)
    res.status(500).json({
      error: "동기화 목록을 가져오는데 실패했습니다",
      details: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * POST /admin/amazon/sync - 새로운 상품 동기화 시작
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve("amazonIntegrationModuleService")
  
  try {
    const { product_ids, marketplace_id, mode = 'VALIDATION_PREVIEW' } = req.body as {
      product_ids?: string[]
      marketplace_id?: string
      mode?: string
    }

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      res.status(400).json({
        error: "product_ids는 필수이며 배열이어야 합니다"
      })
      return
    }

    if (!marketplace_id) {
      res.status(400).json({
        error: "marketplace_id는 필수입니다"
      })
      return
    }

    // 실제 Amazon SP-API를 사용한 상품 동기화 시작
    const syncResults: Array<{
      product_id: string
      sync_record_id?: string
      status: string
      submission_id?: string
      mode?: string
      error?: string
    }> = []
    
    for (const productId of product_ids) {
      try {
        const syncRecord = await amazonService.createProductSync({
          medusa_product_id: productId,
          amazon_marketplace_id: marketplace_id,
          sync_status: 'pending',
          sync_attempts: 0,
          max_attempts: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        // Amazon SP-API 샌드박스 환경에서 상품 등록 시작
        // VALIDATION_PREVIEW 모드로 테스트
        const submitResult = await amazonService.submitProductToAmazon(
          productId, 
          marketplace_id, 
          mode
        )

        syncResults.push({
          product_id: productId,
          sync_record_id: syncRecord.id,
          status: 'initiated',
          submission_id: submitResult?.submissionId,
          mode: mode
        })

      } catch (error) {
        console.error(`Failed to sync product ${productId}:`, error)
        syncResults.push({
          product_id: productId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    res.json({
      message: `${product_ids.length}개 상품의 동기화를 시작했습니다`,
      results: syncResults,
      mode: mode
    })

  } catch (error) {
    console.error('Failed to start product sync:', error)
    res.status(500).json({
      error: "상품 동기화 시작에 실패했습니다",
      details: error instanceof Error ? error.message : String(error)
    })
  }
}