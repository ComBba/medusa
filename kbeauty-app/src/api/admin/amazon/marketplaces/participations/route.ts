import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"

/**
 * Amazon 마켓플레이스 참여 정보 조회 엔드포인트
 * SDK V2의 getMarketplaceParticipations API 사용
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    console.log("[AMAZON API] 마켓플레이스 참여 정보 조회 시작...")
    
    // Amazon SP-API를 통해 마켓플레이스 참여 정보 조회
    const participationsResult = await amazonService.getMarketplaceParticipations()
    
    if (!participationsResult || !participationsResult.payload) {
      return res.status(404).json({
        message: "마켓플레이스 참여 정보를 찾을 수 없습니다.",
        marketplaces: []
      })
    }
    
    // 결과 가공 (프론트엔드 인터페이스에 맞게 속성 이름 변경)
    const marketplaces = participationsResult.payload.map((participation: any) => ({
      marketplace: {
        id: participation.marketplace.id,
        name: participation.marketplace.name,
        countryCode: participation.marketplace.countryCode,
        defaultCurrencyCode: participation.marketplace.defaultCurrencyCode,
        domainName: participation.marketplace.domainName
      },
      participation: {
        isParticipating: participation.participation.isParticipating,
        hasSuspendedListings: participation.participation.hasSuspendedListings,
        listingCount: participation.participation.listingCount || 0
      }
    }))
    
    console.log(`[AMAZON API] ${marketplaces.length}개 마켓플레이스 참여 정보 조회 완료`)
    
    return res.status(200).json(marketplaces)
    
  } catch (error) {
    console.error("[AMAZON API] 마켓플레이스 참여 정보 조회 실패:", error)
    
    return res.status(500).json({
      message: `마켓플레이스 참여 정보 조회 실패: ${error.message}`,
      error: error.stack,
      marketplaces: []
    })
  }
}

/**
 * 마켓플레이스 참여 정보 새로고침 (POST)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    console.log("[AMAZON API] 마켓플레이스 참여 정보 강제 새로고침...")
    
    // 캐시 무효화 후 최신 정보 조회
    const participationsResult = await amazonService.getMarketplaceParticipations()
    
    if (!participationsResult || !participationsResult.payload) {
      return res.status(404).json({
        message: "마켓플레이스 참여 정보를 찾을 수 없습니다.",
        marketplaces: []
      })
    }
    
    // 로컬 데이터베이스의 마켓플레이스 정보도 업데이트
    const marketplaces = participationsResult.payload
    
    for (const participation of marketplaces) {
      const marketplaceData = {
        marketplace_id: participation.marketplace.id,
        name: participation.marketplace.name,
        region: getRegionFromMarketplaceId(participation.marketplace.id),
        country_code: participation.marketplace.countryCode,
        currency_code: participation.marketplace.defaultCurrencyCode,
        is_active: participation.participation.isParticipating,
        has_suspended_listings: participation.participation.hasSuspendedListings
      }
      
      try {
        // 기존 마켓플레이스 업데이트 또는 생성
        const existingMarketplaces = await amazonService.listAmazonMarketplaces({
          marketplace_id: participation.marketplace.id
        })
        
        if (existingMarketplaces.length > 0) {
          await amazonService.updateAmazonMarketplaces([{
            selector: { id: existingMarketplaces[0].id },
            data: marketplaceData
          }])
        } else {
          await amazonService.createAmazonMarketplaces(marketplaceData)
        }
      } catch (dbError) {
        console.warn(`[AMAZON API] 마켓플레이스 ${participation.marketplace.id} DB 업데이트 실패:`, dbError.message)
      }
    }
    
    console.log("[AMAZON API] 마켓플레이스 참여 정보 새로고침 완료")
    
    // 가공된 데이터 반환 (프론트엔드 인터페이스에 맞게 속성 이름 변경)
    const processedMarketplaces = marketplaces.map((participation: any) => ({
      marketplace: {
        id: participation.marketplace.id,
        name: participation.marketplace.name,
        countryCode: participation.marketplace.countryCode,
        defaultCurrencyCode: participation.marketplace.defaultCurrencyCode,
        domainName: participation.marketplace.domainName
      },
      participation: {
        isParticipating: participation.participation.isParticipating,
        hasSuspendedListings: participation.participation.hasSuspendedListings,
        listingCount: participation.participation.listingCount || 0
      }
    }))
    
    return res.status(200).json({
      message: "마켓플레이스 참여 정보가 성공적으로 새로고침되었습니다.",
      updated_at: new Date().toISOString(),
      marketplaces: processedMarketplaces
    })
    
  } catch (error) {
    console.error("[AMAZON API] 마켓플레이스 참여 정보 새로고침 실패:", error)
    
    return res.status(500).json({
      message: `마켓플레이스 참여 정보 새로고침 실패: ${error.message}`,
      error: error.stack
    })
  }
}

/**
 * 마켓플레이스 ID에서 지역 추출
 */
function getRegionFromMarketplaceId(marketplaceId: string): string {
  const regionMap: Record<string, string> = {
    // North America
    'ATVPDKIKX0DER': 'NA', // US
    'A2EUQ1WTGCTBG2': 'NA', // CA
    'A1AM78C64UM0Y8': 'NA', // MX
    'A2Q3Y263D00KWC': 'NA', // BR
    
    // Europe
    'A1PA6795UKMFR9': 'EU', // DE
    'A1F83G8C2ARO7P': 'EU', // UK
    'A13V1IB3VIYZZH': 'EU', // FR
    'APJ6JRA9NG5V4': 'EU', // IT
    'A1RKKUPIHCS9HS': 'EU', // ES
    'A1805IZSGTT6HS': 'EU', // NL
    'AMEN7PMS3EDWL': 'EU', // BE
    'A2NODRKZP88ZB9': 'EU', // SE
    'A1C3SOZRARQ6R3': 'EU', // PL
    'A28R8C7NBKEWEA': 'EU', // IE
    'A33AVAJ2PDY3EV': 'EU', // TR
    'A17E79C6D8DWNP': 'EU', // SA
    'A2VIGQ35RCS4UG': 'EU', // AE
    'A21TJRUUN4KGV': 'EU', // IN
    'AE08WJ6YKNBMC': 'EU', // ZA
    'ARBP9OOSHTCHU': 'EU', // EG
    
    // Far East
    'A1VC38T7YXB528': 'FE', // JP
    'A39IBJ37TRP1C6': 'FE', // AU
    'A19VAU5U5O7RUS': 'FE'  // SG
  }
  
  return regionMap[marketplaceId] || 'NA'
}