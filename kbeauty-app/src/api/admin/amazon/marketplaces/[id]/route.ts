import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"

/**
 * 특정 마켓플레이스 조회
 * GET /admin/amazon/marketplaces/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://admin.kbeauty.market')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    const { id } = req.params
    
    console.log(`[AMAZON API] 마켓플레이스 조회: ${id}`)
    
    const marketplaces = await amazonService.listAmazonMarketplaces({ id })
    
    if (marketplaces.length === 0) {
      return res.status(404).json({
        message: "마켓플레이스를 찾을 수 없습니다.",
        marketplace_id: id
      })
    }
    
    const marketplace = marketplaces[0]
    
    return res.status(200).json({
      marketplace: {
        id: marketplace.id,
        marketplace_id: marketplace.marketplace_id,
        name: marketplace.name,
        country_code: marketplace.country_code,
        currency_code: marketplace.currency_code,
        region: marketplace.region,
        endpoint: marketplace.endpoint,
        is_active: marketplace.is_active,
        auto_sync: marketplace.auto_sync,
        seller_id: marketplace.seller_id,
        mws_auth_token: marketplace.mws_auth_token,
        created_at: marketplace.created_at,
        updated_at: marketplace.updated_at
      }
    })
    
  } catch (error) {
    console.error(`[AMAZON API] 마켓플레이스 조회 실패 (${req.params.id}):`, error)
    
    return res.status(500).json({
      message: `마켓플레이스 조회 실패: ${error.message}`,
      error: error.stack
    })
  }
}

/**
 * 마켓플레이스 업데이트
 * POST /admin/amazon/marketplaces/:id
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://admin.kbeauty.market')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    const { id } = req.params
    const updateData = req.body as any
    
    console.log(`[AMAZON API] 마켓플레이스 업데이트: ${id}`, updateData)
    
    // 기존 마켓플레이스 확인
    const existingMarketplaces = await amazonService.listAmazonMarketplaces({ id })
    
    if (existingMarketplaces.length === 0) {
      return res.status(404).json({
        message: "마켓플레이스를 찾을 수 없습니다.",
        marketplace_id: id
      })
    }
    
    // 업데이트 실행
    const updatedMarketplace = await amazonService.updateAmazonMarketplaces([{
      selector: { id },
      data: {
        seller_id: updateData.seller_id,
        mws_auth_token: updateData.mws_auth_token,
        is_active: updateData.is_active,
        auto_sync: updateData.auto_sync,
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.region && { region: updateData.region }),
        ...(updateData.endpoint && { endpoint: updateData.endpoint })
      }
    }])
    
    console.log(`[AMAZON API] 마켓플레이스 업데이트 완료: ${id}`)
    
    // 업데이트된 데이터 조회
    const refreshedMarketplaces = await amazonService.listAmazonMarketplaces({ id })
    const refreshedMarketplace = refreshedMarketplaces[0]
    
    return res.status(200).json({
      message: "마켓플레이스가 성공적으로 업데이트되었습니다.",
      marketplace: {
        id: refreshedMarketplace.id,
        marketplace_id: refreshedMarketplace.marketplace_id,
        name: refreshedMarketplace.name,
        country_code: refreshedMarketplace.country_code,
        currency_code: refreshedMarketplace.currency_code,
        region: refreshedMarketplace.region,
        endpoint: refreshedMarketplace.endpoint,
        is_active: refreshedMarketplace.is_active,
        auto_sync: refreshedMarketplace.auto_sync,
        seller_id: refreshedMarketplace.seller_id,
        mws_auth_token: refreshedMarketplace.mws_auth_token,
        created_at: refreshedMarketplace.created_at,
        updated_at: refreshedMarketplace.updated_at
      }
    })
    
  } catch (error) {
    console.error(`[AMAZON API] 마켓플레이스 업데이트 실패 (${req.params.id}):`, error)
    
    return res.status(500).json({
      message: `마켓플레이스 업데이트 실패: ${error.message}`,
      error: error.stack
    })
  }
}

/**
 * 마켓플레이스 삭제
 * DELETE /admin/amazon/marketplaces/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    const { id } = req.params
    
    console.log(`[AMAZON API] 마켓플레이스 삭제: ${id}`)
    
    // 기존 마켓플레이스 확인
    const existingMarketplaces = await amazonService.listAmazonMarketplaces({ id })
    
    if (existingMarketplaces.length === 0) {
      return res.status(404).json({
        message: "마켓플레이스를 찾을 수 없습니다.",
        marketplace_id: id
      })
    }
    
    // 삭제 실행
    await amazonService.deleteAmazonMarketplaces([id])
    
    console.log(`[AMAZON API] 마켓플레이스 삭제 완료: ${id}`)
    
    return res.status(200).json({
      message: "마켓플레이스가 성공적으로 삭제되었습니다.",
      deleted_marketplace_id: id
    })
    
  } catch (error) {
    console.error(`[AMAZON API] 마켓플레이스 삭제 실패 (${req.params.id}):`, error)
    
    return res.status(500).json({
      message: `마켓플레이스 삭제 실패: ${error.message}`,
      error: error.stack
    })
  }
}