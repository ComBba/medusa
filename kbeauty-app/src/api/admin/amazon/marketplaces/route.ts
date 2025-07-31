import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../modules/amazon-integration/service"

// 기본 Amazon 마켓플레이스 설정
const DEFAULT_MARKETPLACES = [
  {
    marketplace_id: "ATVPDKIKX0DER",
    country_code: "US",
    name: "Amazon.com",
    currency_code: "USD",
    region: "NA",
    endpoint: "sellingpartnerapi-na.amazon.com"
  },
  {
    marketplace_id: "A1PA6795UKMFR9",
    country_code: "DE", 
    name: "Amazon.de",
    currency_code: "EUR",
    region: "EU",
    endpoint: "sellingpartnerapi-eu.amazon.com"
  },
  {
    marketplace_id: "A1VC38T7YXB528",
    country_code: "JP",
    name: "Amazon.co.jp", 
    currency_code: "JPY",
    region: "FE",
    endpoint: "sellingpartnerapi-fe.amazon.com"
  },
  {
    marketplace_id: "A1F83G8C2ARO7P",
    country_code: "UK",
    name: "Amazon.co.uk",
    currency_code: "GBP", 
    region: "EU",
    endpoint: "sellingpartnerapi-eu.amazon.com"
  },
  {
    marketplace_id: "A13V1IB3VIYZZH",
    country_code: "FR",
    name: "Amazon.fr",
    currency_code: "EUR",
    region: "EU", 
    endpoint: "sellingpartnerapi-eu.amazon.com"
  },
  {
    marketplace_id: "APJ6JRA9NG5V4",
    country_code: "IT",
    name: "Amazon.it",
    currency_code: "EUR",
    region: "EU",
    endpoint: "sellingpartnerapi-eu.amazon.com"
  },
  {
    marketplace_id: "A1RKKUPIHCS9HS",
    country_code: "ES", 
    name: "Amazon.es",
    currency_code: "EUR",
    region: "EU",
    endpoint: "sellingpartnerapi-eu.amazon.com"
  },
  {
    marketplace_id: "A2EUQ1WTGCTBG2",
    country_code: "CA",
    name: "Amazon.ca",
    currency_code: "CAD",
    region: "NA",
    endpoint: "sellingpartnerapi-na.amazon.com"
  },
  {
    marketplace_id: "A39IBJ37TRP1C6",
    country_code: "AU",
    name: "Amazon.com.au",
    currency_code: "AUD", 
    region: "FE",
    endpoint: "sellingpartnerapi-fe.amazon.com"
  }
]

/**
 * GET /admin/amazon/marketplaces
 * Amazon 마켓플레이스 목록 조회
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    const marketplaces = await amazonService.listAmazonMarketplaces()
    
    res.json({
      marketplaces,
      total: marketplaces.length
    })
  } catch (error) {
    res.status(500).json({
      message: "마켓플레이스 조회 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * POST /admin/amazon/marketplaces
 * Amazon 마켓플레이스 생성/설정
 */
export const POST = async (
  req: MedusaRequest<{
    marketplace_id: string
    seller_id?: string
    mws_auth_token?: string
    is_active?: boolean
    auto_sync?: boolean
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    const { marketplace_id, seller_id, mws_auth_token, is_active, auto_sync } = req.body
    
    // 기본 마켓플레이스 정보 찾기
    const defaultMarketplace = DEFAULT_MARKETPLACES.find(
      m => m.marketplace_id === marketplace_id
    )
    
    if (!defaultMarketplace) {
      return res.status(400).json({
        message: "지원되지 않는 마켓플레이스입니다",
        supported_marketplaces: DEFAULT_MARKETPLACES.map(m => ({
          marketplace_id: m.marketplace_id,
          name: m.name,
          country_code: m.country_code
        }))
      })
    }
    
    // 기존 마켓플레이스 확인
    const existingMarketplaces = await amazonService.listAmazonMarketplaces({
      marketplace_id
    })
    
    if (existingMarketplaces.length > 0) {
      // 업데이트
      const updated = await amazonService.updateAmazonMarketplaces(
        { id: existingMarketplaces[0].id },
        {
          seller_id,
          mws_auth_token,
          is_active: is_active ?? true,
          auto_sync: auto_sync ?? true,
        }
      )
      
      res.json({
        marketplace: updated[0],
        message: "마켓플레이스가 업데이트되었습니다"
      })
    } else {
      // 새로 생성
      const created = await amazonService.createAmazonMarketplaces({
        ...defaultMarketplace,
        seller_id,
        mws_auth_token,
        is_active: is_active ?? true,
        auto_sync: auto_sync ?? true,
      })
      
      res.status(201).json({
        marketplace: created,
        message: "마켓플레이스가 생성되었습니다"
      })
    }
    
  } catch (error) {
    res.status(500).json({
      message: "마켓플레이스 설정 중 오류 발생",
      error: error.message
    })
  }
} 