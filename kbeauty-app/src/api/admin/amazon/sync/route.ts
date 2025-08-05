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

    // 임시 Mock 데이터 반환 (개발 중)
    console.log('📦 [SYNC API] 동기화 레코드 조회 요청:', { filters, pagination })
    
    // 샘플 동기화 레코드 데이터
    const mockSyncRecords = [
      {
        id: "sync_001",
        medusa_product_id: "prod_01H1VJES9RPFQK0H8N5YFKJQBG",
        amazon_marketplace_id: "ATVPDKIKX0DER",
        amazon_sku: "KBEAUTY-SERUM-001",
        amazon_asin: "B08XXXX001",
        amazon_listing_id: "listing_001",
        sync_status: "completed",
        sync_type: "product",
        last_sync_at: new Date().toISOString(),
        sync_attempts: 1,
        max_attempts: 3,
        error_message: null,
        error_code: null,
        feed_submission_id: "50001_JOB_12345",
        processing_status: "DONE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "sync_002", 
        medusa_product_id: "prod_01H1VJES9RPFQK0H8N5YFKJQBH",
        amazon_marketplace_id: "ATVPDKIKX0DER",
        amazon_sku: "KBEAUTY-CREAM-002",
        amazon_asin: "B08XXXX002",
        amazon_listing_id: "listing_002",
        sync_status: "pending",
        sync_type: "inventory",
        last_sync_at: null,
        sync_attempts: 0,
        max_attempts: 3,
        error_message: null,
        error_code: null,
        feed_submission_id: null,
        processing_status: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "sync_003",
        medusa_product_id: "prod_01H1VJES9RPFQK0H8N5YFKJQBI", 
        amazon_marketplace_id: "A1PA6795UKMFR9",
        amazon_sku: "KBEAUTY-MASK-003",
        amazon_asin: null,
        amazon_listing_id: null,
        sync_status: "failed",
        sync_type: "product",
        last_sync_at: new Date().toISOString(),
        sync_attempts: 3,
        max_attempts: 3,
        error_message: "Invalid product category",
        error_code: "INVALID_CATEGORY",
        feed_submission_id: "50001_JOB_12346",
        processing_status: "FATAL",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    // 필터링 적용 (간단한 버전)
    let filteredRecords = mockSyncRecords
    if (marketplace_id) {
      filteredRecords = filteredRecords.filter(r => r.amazon_marketplace_id === marketplace_id)
    }
    if (status && status !== 'all') {
      filteredRecords = filteredRecords.filter(r => r.sync_status === status)
    }
    if (search) {
      filteredRecords = filteredRecords.filter(r => 
        r.amazon_sku?.toLowerCase().includes((search as string).toLowerCase()) ||
        r.amazon_asin?.toLowerCase().includes((search as string).toLowerCase())
      )
    }

    // 페이지네이션 적용
    const startIndex = pagination.skip
    const endIndex = startIndex + pagination.take
    const paginatedRecords = filteredRecords.slice(startIndex, endIndex)
    const totalCount = filteredRecords.length

    console.log('✅ [SYNC API] 동기화 레코드 반환:', {
      total: totalCount,
      returned: paginatedRecords.length,
      offset: pagination.skip,
      limit: pagination.take
    })

    res.json({
      sync_records: paginatedRecords,
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