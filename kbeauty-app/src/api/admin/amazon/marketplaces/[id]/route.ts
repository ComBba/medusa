import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"

/**
 * OPTIONS /admin/amazon/marketplaces/[id]
 * CORS preflight 요청 처리
 */
export const OPTIONS = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  res.header("Access-Control-Allow-Credentials", "true")
  res.header("Access-Control-Max-Age", "86400")
  res.status(204).end()
}

/**
 * GET /admin/amazon/marketplaces/[id]
 * 특정 Amazon 마켓플레이스 조회
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const { id } = req.params
  
  try {
    const marketplaces = await amazonService.listAmazonMarketplaces({
      id: id
    })
    
    if (marketplaces.length === 0) {
      return res.status(404).json({
        message: "마켓플레이스를 찾을 수 없습니다"
      })
    }
    
    res.json({
      marketplace: marketplaces[0]
    })
  } catch (error) {
    res.status(500).json({
      message: "마켓플레이스 조회 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * POST /admin/amazon/marketplaces/[id]
 * 특정 Amazon 마켓플레이스 업데이트
 */
export const POST = async (
  req: MedusaRequest<{
    is_active?: boolean
    auto_sync?: boolean
    seller_id?: string
    mws_auth_token?: string
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const { id } = req.params
  
  try {
    const { is_active, auto_sync, seller_id, mws_auth_token } = req.body
    
    // 기존 마켓플레이스 확인
    const existingMarketplaces = await amazonService.listAmazonMarketplaces({
      id: id
    })
    
    if (existingMarketplaces.length === 0) {
      return res.status(404).json({
        message: "마켓플레이스를 찾을 수 없습니다"
      })
    }
    
    // 업데이트
    const updated = await amazonService.updateAmazonMarketplaces(
      { id },
      {
        ...(seller_id !== undefined && { seller_id }),
        ...(mws_auth_token !== undefined && { mws_auth_token }),
        ...(is_active !== undefined && { is_active }),
        ...(auto_sync !== undefined && { auto_sync }),
      }
    )
    
    res.json({
      marketplace: updated[0],
      message: "마켓플레이스가 업데이트되었습니다"
    })
    
  } catch (error) {
    res.status(500).json({
      message: "마켓플레이스 업데이트 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * PUT /admin/amazon/marketplaces/[id]
 * 특정 Amazon 마켓플레이스 업데이트 (PUT 메서드)
 */
export const PUT = POST

/**
 * DELETE /admin/amazon/marketplaces/[id]
 * 특정 Amazon 마켓플레이스 삭제
 */
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const { id } = req.params
  
  try {
    // 기존 마켓플레이스 확인
    const existingMarketplaces = await amazonService.listAmazonMarketplaces({
      id: id
    })
    
    if (existingMarketplaces.length === 0) {
      return res.status(404).json({
        message: "마켓플레이스를 찾을 수 없습니다"
      })
    }
    
    // 삭제
    await amazonService.deleteAmazonMarketplaces({ id })
    
    res.json({
      message: "마켓플레이스가 삭제되었습니다"
    })
    
  } catch (error) {
    res.status(500).json({
      message: "마켓플레이스 삭제 중 오류 발생",
      error: error.message
    })
  }
}