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
    
    // 업데이트 데이터 준비
    const updateData: any = {}
    
    if (seller_id !== undefined) {
      updateData.seller_id = seller_id
    }
    if (mws_auth_token !== undefined) {
      updateData.mws_auth_token = mws_auth_token
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active
    }
    if (auto_sync !== undefined) {
      updateData.auto_sync = auto_sync
    }
    
    console.log('🔄 [API] Updating marketplace:', id, updateData)
    
    // 업데이트 전 상태 확인
    const beforeUpdate = await amazonService.listAmazonMarketplaces({ id })
    console.log('📋 [API] Before update:', beforeUpdate[0] || 'Not found')
    
    // 업데이트
    const updated = await amazonService.updateMarketplace(id, updateData)
    
    console.log('✅ [API] Update result:', updated)
    
    // 업데이트 후 상태 재확인
    const afterUpdate = await amazonService.listAmazonMarketplaces({ id })
    console.log('🔍 [API] After update:', afterUpdate[0] || 'Not found')
    
    // 변경사항 비교
    if (beforeUpdate[0] && afterUpdate[0]) {
      console.log('🔄 [API] Changes detected:', {
        is_active: `${beforeUpdate[0].is_active} → ${afterUpdate[0].is_active}`,
        seller_id: `${beforeUpdate[0].seller_id} → ${afterUpdate[0].seller_id}`,
        auto_sync: `${beforeUpdate[0].auto_sync} → ${afterUpdate[0].auto_sync}`
      })
    }
    
    res.json({
      marketplace: Array.isArray(updated) ? updated[0] : updated,
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