import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../modules/amazon-integration/service"

/**
 * 로컬 데이터베이스의 Amazon 마켓플레이스 목록 조회
 * GET /admin/amazon/marketplaces
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://admin.kbeauty.market')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    console.log("[AMAZON API] 로컬 마켓플레이스 목록 조회...")
    console.log("[AMAZON API] Service available:", !!amazonService)
    console.log("[AMAZON API] listAmazonMarketplaces method available:", typeof amazonService.listAmazonMarketplaces)
    
    // 쿼리 파라미터 처리
    const { is_active, region, limit = "50", offset = "0" } = req.query
    
    const filters: any = {}
    if (is_active !== undefined) {
      filters.is_active = is_active === "true"
    }
    if (region) {
      filters.region = region
    }
    
    // 로컬 데이터베이스에서 마켓플레이스 목록 조회
    const marketplaces = await amazonService.listAmazonMarketplaces(filters)
    
    console.log(`[AMAZON API] ${marketplaces.length}개 마켓플레이스 조회 완료`)
    console.log('[AMAZON API] Raw marketplaces data:', JSON.stringify(marketplaces, null, 2))
    
    // 응답 형식을 프론트엔드가 기대하는 형태로 변환
    const formattedMarketplaces = marketplaces.map((marketplace: any) => ({
      id: marketplace.id,
      marketplace_id: marketplace.marketplace_id,
      name: marketplace.name,
      country_code: marketplace.country_code,
      currency_code: marketplace.currency_code,
      region: marketplace.region,
      endpoint: marketplace.endpoint,
      is_active: marketplace.is_active,
      auto_sync: marketplace.auto_sync,
      created_at: marketplace.created_at,
      updated_at: marketplace.updated_at
    }))
    
    const responseData = {
      marketplaces: formattedMarketplaces,
      total: marketplaces.length,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    }
    
    console.log('[AMAZON API] Response data:', JSON.stringify(responseData, null, 2))
    
    return res.status(200).json(responseData)
    
  } catch (error) {
    console.error("[AMAZON API] 마켓플레이스 목록 조회 실패:", error)
    
    return res.status(500).json({
      message: `마켓플레이스 목록 조회 실패: ${error.message}`,
      error: error.stack,
      marketplaces: []
    })
  }
}

/**
 * 새로운 마켓플레이스 생성
 * POST /admin/amazon/marketplaces
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://admin.kbeauty.market')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    const marketplaceData = req.body as any
    
    console.log("[AMAZON API] 새 마켓플레이스 생성:", marketplaceData?.name)
    
    // 중복 확인
    const existing = await amazonService.listAmazonMarketplaces({
      marketplace_id: marketplaceData?.marketplace_id
    })
    
    if (existing.length > 0) {
      return res.status(409).json({
        message: `마켓플레이스가 이미 존재합니다: ${marketplaceData?.name}`,
        existing_marketplace: existing[0]
      })
    }
    
    // 새 마켓플레이스 생성
    const newMarketplace = await amazonService.createAmazonMarketplaces(marketplaceData as {
      marketplace_id: string
      name: string
      country_code: string
      currency_code: string
      region?: string
      endpoint?: string
      is_active?: boolean
      auto_sync?: boolean
    })
    
    console.log("[AMAZON API] 마켓플레이스 생성 완료:", (newMarketplace as any)?.id)
    
    return res.status(201).json({
      message: "마켓플레이스가 성공적으로 생성되었습니다.",
      marketplace: newMarketplace
    })
    
  } catch (error) {
    console.error("[AMAZON API] 마켓플레이스 생성 실패:", error)
    
    return res.status(500).json({
      message: `마켓플레이스 생성 실패: ${error.message}`,
      error: error.stack
    })
  }
}