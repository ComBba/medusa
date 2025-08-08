import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"

/**
 * Amazon SP-API 연결 테스트 엔드포인트 (GET)
 * SDK V2 기능을 사용하여 연결 상태 확인
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 캐시된 연결 상태 반환 (빠른 응답을 위해)
    const cachedStatus = await getCachedConnectionStatus(amazonService)
    
    return res.status(200).json({
      success: cachedStatus.success,
      message: cachedStatus.message,
      timestamp: new Date().toISOString(),
      region: process.env.AMAZON_REGION || 'NA',
      sandbox: process.env.AMAZON_SANDBOX_MODE === 'true'
    })
  } catch (error) {
    console.error("[AMAZON API] 연결 상태 조회 실패:", error)
    
    return res.status(500).json({
      success: false,
      message: `연결 상태 확인 실패: ${error.message}`,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Amazon SP-API 연결 테스트 엔드포인트 (POST)
 * 실제 API 호출로 연결 상태 확인
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
    
    console.log("[AMAZON API] 연결 테스트 시작...")
    
    // 실제 Amazon SP-API 연결 테스트
    const testResult = await amazonService.testAmazonConnection()
    
    // 결과 객체 생성
    let finalResult: any = {
      success: testResult.success,
      message: testResult.message,
      data: testResult.data
    }
    
    if (testResult.success) {
      console.log("[AMAZON API] 연결 테스트 성공")
      
      // 마켓플레이스 참여 정보도 함께 조회
      try {
        const marketplaces = await amazonService.getMarketplaceParticipations()
        finalResult.marketplaces = marketplaces?.payload || []
      } catch (mpError) {
        console.warn("[AMAZON API] 마켓플레이스 정보 조회 실패:", mpError.message)
      }
    } else {
      console.error("[AMAZON API] 연결 테스트 실패:", finalResult.message)
    }
    
    return res.status(finalResult.success ? 200 : 400).json({
      ...finalResult,
      timestamp: new Date().toISOString(),
      region: process.env.AMAZON_SP_API_REGION || 'us-east-1',
      sandbox: process.env.AMAZON_SP_API_SANDBOX === 'true'
    })
    
  } catch (error) {
    console.error("[AMAZON API] 연결 테스트 실패:", error)
    
    return res.status(500).json({
      success: false,
      message: `연결 테스트 실패: ${error.message}`,
      error: error.stack,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * 캐시된 연결 상태 조회 (빠른 응답용)
 */
async function getCachedConnectionStatus(amazonService: AmazonIntegrationModuleService) {
  try {
    // 간단한 설정 검증만 수행 (실제 API 호출 없이)
    const config = (amazonService as any).getSpApiConfig()
    
    if (!config.isConfigured) {
      return {
        success: false,
        message: "Amazon SP-API 설정이 완료되지 않았습니다. 환경변수를 확인해주세요."
      }
    }
    
    return {
      success: true,
      message: "Amazon SP-API 설정이 완료되었습니다."
    }
  } catch (error) {
    return {
      success: false,
      message: `설정 확인 실패: ${error.message}`
    }
  }
}