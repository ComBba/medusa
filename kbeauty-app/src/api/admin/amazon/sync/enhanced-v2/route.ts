import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { amazonSyncEnhancedV2Workflow } from "../../../../../workflows/amazon-sync-enhanced-v2"

interface SyncEnhancedV2Request {
  product_id?: string
  marketplace_ids?: string[]
  sync_type: 'product' | 'price' | 'inventory' | 'all'
  options?: {
    force_update?: boolean
    validation_only?: boolean
    batch_mode?: boolean
    retry_count?: number
  }
}

/**
 * Amazon SDK V2 향상된 동기화 엔드포인트
 * 새로운 워크플로우와 SDK 기능을 사용한 고급 동기화
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = req.body as SyncEnhancedV2Request
    
    // 요청 검증
    if (!body.product_id) {
      return res.status(400).json({
        message: "product_id는 필수입니다.",
        error: "MISSING_PRODUCT_ID"
      })
    }
    
    if (!body.sync_type) {
      return res.status(400).json({
        message: "sync_type은 필수입니다.",
        error: "MISSING_SYNC_TYPE"
      })
    }
    
    const validSyncTypes = ['product', 'price', 'inventory', 'all']
    if (!validSyncTypes.includes(body.sync_type)) {
      return res.status(400).json({
        message: `sync_type은 다음 중 하나여야 합니다: ${validSyncTypes.join(', ')}`,
        error: "INVALID_SYNC_TYPE"
      })
    }
    
    console.log(`[AMAZON API] Enhanced V2 동기화 시작 - 상품: ${body.product_id}, 타입: ${body.sync_type}`)
    
    // 워크플로우 입력 준비
    const workflowInput = {
      product_id: body.product_id,
      marketplace_ids: body.marketplace_ids,
      sync_type: body.sync_type,
      options: {
        force_update: body.options?.force_update ?? false,
        validation_only: body.options?.validation_only ?? false,
        batch_mode: body.options?.batch_mode ?? true,
        retry_count: body.options?.retry_count ?? 3
      }
    }
    
    // Enhanced V2 워크플로우 실행
    const workflowResult = await amazonSyncEnhancedV2Workflow.run({
      input: workflowInput
    })
    
    console.log(`[AMAZON API] Enhanced V2 동기화 완료 - 결과:`, workflowResult.result)
    
    // 성공 응답
    return res.status(200).json({
      message: "Amazon Enhanced V2 동기화가 완료되었습니다.",
      workflow_id: workflowResult.transaction?.transactionId || 'unknown',
      results: {
        connection_status: workflowResult.result.connectionStatus,
        marketplaces: workflowResult.result.marketplaces,
        sync_results: workflowResult.result.syncResults,
        summary: workflowResult.result.summary,
        report: workflowResult.result.report
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("[AMAZON API] Enhanced V2 동기화 실패:", error)
    
    // 구체적인 에러 처리
    let statusCode = 500
    let errorMessage = error.message
    let errorCode = "SYNC_FAILED"
    
    if (error.message.includes("Amazon SP-API 설정이 완료되지 않았습니다")) {
      statusCode = 400
      errorCode = "AMAZON_CONFIG_MISSING"
    } else if (error.message.includes("연결")) {
      statusCode = 503
      errorCode = "AMAZON_CONNECTION_FAILED"
    } else if (error.message.includes("권한")) {
      statusCode = 403
      errorCode = "AMAZON_PERMISSION_DENIED"
    }
    
    return res.status(statusCode).json({
      message: `Enhanced V2 동기화 실패: ${errorMessage}`,
      error: errorCode,
      details: error.stack,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * 동기화 상태 조회 (GET)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { product_id } = req.query
    
    if (!product_id) {
      return res.status(400).json({
        message: "product_id 쿼리 파라미터가 필요합니다.",
        error: "MISSING_PRODUCT_ID"
      })
    }
    
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 상품 동기화 상태 조회
    const syncStatus = await amazonService.getProductSyncStatus(product_id as string)
    
    return res.status(200).json({
      product_id,
      sync_records: syncStatus,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("[AMAZON API] 동기화 상태 조회 실패:", error)
    
    return res.status(500).json({
      message: `동기화 상태 조회 실패: ${error.message}`,
      error: "STATUS_QUERY_FAILED",
      timestamp: new Date().toISOString()
    })
  }
}