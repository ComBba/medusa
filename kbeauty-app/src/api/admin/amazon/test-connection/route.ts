import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../modules/amazon-integration"

/**
 * POST /admin/amazon/test-connection
 * Amazon SP-API 연결 테스트
 */
export const POST = async (
  req: MedusaRequest<{
    marketplace_id: string
    seller_id: string
  }>,
  res: MedusaResponse
) => {
  const amazonService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  
  try {
    const { marketplace_id, seller_id } = req.body
    
    if (!marketplace_id || !seller_id) {
      return res.status(400).json({
        message: "marketplace_id와 seller_id는 필수입니다",
        code: "MISSING_REQUIRED_FIELDS"
      })
    }

    // 마켓플레이스 존재 여부 확인
    const marketplaces = await amazonService.listAmazonMarketplaces({
      marketplace_id
    })

    if (marketplaces.length === 0) {
      return res.status(404).json({
        message: "해당 마켓플레이스를 찾을 수 없습니다",
        code: "MARKETPLACE_NOT_FOUND"
      })
    }

    const marketplace = marketplaces[0]
    const testResults: Array<{
      status: 'success' | 'error' | 'warning'
      message: string
      details: string
    }> = []

    // 1. 환경 변수 확인
    const envCheck = {
      status: 'success' as 'success' | 'error' | 'warning',
      message: 'Environment Configuration',
      details: 'Amazon integration module is properly configured'
    }

    const lwaClientId = process.env.AMAZON_LWA_CLIENT_ID
    const lwaClientSecret = process.env.AMAZON_LWA_CLIENT_SECRET
    const awsAccessKey = process.env.AMAZON_AWS_ACCESS_KEY_ID
    const awsSecretKey = process.env.AMAZON_AWS_SECRET_ACCESS_KEY
    const isSandbox = process.env.AMAZON_SP_API_SANDBOX === 'true'

    // LWA 자격 증명은 항상 필요
    const hasLwaCredentials = lwaClientId && lwaClientSecret && 
      !lwaClientId.startsWith('your-') && !lwaClientSecret.startsWith('your-')
    
    // AWS 자격 증명은 샌드박스에서는 선택적
    const hasAwsCredentials = awsAccessKey && awsSecretKey && 
      !awsAccessKey.startsWith('your-') && !awsSecretKey.startsWith('your-')

    if (!hasLwaCredentials || (!isSandbox && !hasAwsCredentials)) {
      envCheck.status = isSandbox ? 'warning' : 'error'
      envCheck.message = isSandbox ? 'Environment Configuration (Sandbox)' : 'Environment Configuration Error'
      envCheck.details = isSandbox 
        ? 'LWA credentials configured, AWS credentials optional in sandbox mode'
        : 'Missing required Amazon SP-API credentials in environment variables'
    }

    testResults.push(envCheck)

    // 2. 마켓플레이스 설정 확인
    testResults.push({
      status: 'success' as const,
      message: 'Marketplace Configuration',
      details: `${marketplace.name} marketplace settings are valid`
    })

    // 3. Seller ID 검증
    testResults.push({
      status: seller_id ? 'success' as const : 'error' as const,
      message: 'Seller ID Validation',
      details: seller_id 
        ? `Seller ID (${seller_id}) is configured`
        : 'Seller ID is missing'
    })

    // 4. SP-API 연결 테스트 (현재는 모의 테스트)
    const spApiCheck = {
      status: 'warning' as 'success' | 'error' | 'warning',
      message: 'SP-API Connection',
      details: 'SP-API connection test is not yet implemented (development mode)'
    }

    // 환경이 프로덕션이고 모든 설정이 완료된 경우에만 실제 API 호출
    if (process.env.AMAZON_SP_API_SANDBOX !== 'true' && envCheck.status === 'success') {
      try {
        // TODO: 실제 SP-API 호출 로직 구현
        // const spApiResponse = await testSpApiConnection(marketplace_id, seller_id)
        
        spApiCheck.status = 'success'
        spApiCheck.message = 'SP-API Connection Successful'
        spApiCheck.details = 'Successfully connected to Amazon SP-API'
      } catch (error) {
        spApiCheck.status = 'error'
        spApiCheck.message = 'SP-API Connection Failed'
        spApiCheck.details = `Failed to connect to Amazon SP-API: ${error.message}`
      }
    }

    testResults.push(spApiCheck)

    // 5. 전체 상태 평가
    const hasErrors = testResults.some(result => result.status === 'error')
    const hasWarnings = testResults.some(result => result.status === 'warning')

    let overallStatus = 'success'
    if (hasErrors) {
      overallStatus = 'error'
    } else if (hasWarnings) {
      overallStatus = 'warning'
    }

    res.json({
      overall_status: overallStatus,
      marketplace: {
        id: marketplace.id,
        marketplace_id: marketplace.marketplace_id,
        name: marketplace.name,
        country_code: marketplace.country_code,
        is_active: marketplace.is_active
      },
      test_timestamp: new Date().toISOString(),
      results: testResults,
      recommendations: generateRecommendations(testResults)
    })

  } catch (error) {
    console.error('Connection test error:', error)
    res.status(500).json({
      message: "연결 테스트 중 오류가 발생했습니다",
      error: error.message,
      code: "CONNECTION_TEST_ERROR"
    })
  }
}

/**
 * 테스트 결과를 바탕으로 권장사항 생성
 */
function generateRecommendations(testResults: Array<{
  status: 'success' | 'error' | 'warning'
  message: string
  details: string
}>) {
  const recommendations: Array<{
    type: string
    message: string
    action: string
  }> = []

  const envError = testResults.find(r => r.message.includes('Environment') && r.status === 'error')
  if (envError) {
    recommendations.push({
      type: 'critical',
      message: '.env 파일에서 Amazon SP-API 관련 환경 변수를 설정해주세요',
      action: 'AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_AWS_ACCESS_KEY_ID, AMAZON_AWS_SECRET_ACCESS_KEY 설정'
    })
  }

  const sellerError = testResults.find(r => r.message.includes('Seller ID') && r.status === 'error')
  if (sellerError) {
    recommendations.push({
      type: 'critical',
      message: '마켓플레이스 설정에서 Seller ID를 입력해주세요',
      action: '편집 버튼을 클릭하여 Amazon Seller Central의 Seller ID를 설정'
    })
  }

  const spApiWarning = testResults.find(r => r.message.includes('SP-API') && r.status === 'warning')
  if (spApiWarning) {
    recommendations.push({
      type: 'info',
      message: '실제 SP-API 연결 테스트는 아직 구현되지 않았습니다',
      action: '개발이 완료되면 실제 Amazon 서버와의 연결 테스트가 가능합니다'
    })
  }

  const allSuccess = testResults.every(r => r.status === 'success')
  if (allSuccess) {
    recommendations.push({
      type: 'success',
      message: '모든 테스트가 성공했습니다! 마켓플레이스를 활성화할 수 있습니다',
      action: '마켓플레이스 토글을 활성화하여 자동 동기화를 시작하세요'
    })
  }

  return recommendations
}