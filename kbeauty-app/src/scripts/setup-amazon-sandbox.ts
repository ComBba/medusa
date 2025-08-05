import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
// import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Amazon 샌드박스 환경 설정 스크립트
 * 
 * 샌드박스 테스트를 위한 전체 환경을 설정하고 기본 마켓플레이스에
 * 샌드박스용 Seller ID를 설정합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/setup-amazon-sandbox.ts
 */
export default async function setupAmazonSandbox({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)

  logger.info("🧪 Amazon 샌드박스 환경 설정 시작...")

  // 환경 변수 검증
  const requiredEnvVars = [
    'AMAZON_LWA_CLIENT_ID',
    'AMAZON_LWA_CLIENT_SECRET', 
    'AMAZON_LWA_REFRESH_TOKEN',
    'AMAZON_AWS_ACCESS_KEY_ID',
    'AMAZON_AWS_SECRET_ACCESS_KEY',
    'AMAZON_SP_API_SANDBOX'
  ]

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    logger.error(`❌ 다음 환경 변수가 설정되지 않았습니다: ${missingVars.join(', ')}`)
    logger.info("📝 .env.sandbox 파일을 참고하여 환경 변수를 설정하세요")
    process.exit(1)
  }

  if (process.env.AMAZON_SP_API_SANDBOX !== 'true') {
    logger.error("❌ AMAZON_SP_API_SANDBOX=true로 설정해야 합니다")
    process.exit(1)
  }

  // 샌드박스용 테스트 마켓플레이스 설정 (주요 3개국만)
  const sandboxMarketplaces = [
    {
      marketplace_id: "ATVPDKIKX0DER",
      country_code: "US", 
      name: "Amazon.com (Sandbox)",
      currency_code: "USD",
      region: "NA",
      endpoint: "sandbox.sellingpartnerapi-na.amazon.com",
      is_active: true, // 샌드박스에서는 기본 활성화
      auto_sync: true,
      seller_id: process.env.AMAZON_SELLER_ID || "A3SANDBOX123456789", // 샌드박스 기본값
    },
    {
      marketplace_id: "A1PA6795UKMFR9",
      country_code: "DE",
      name: "Amazon.de (Sandbox)",
      currency_code: "EUR", 
      region: "EU",
      endpoint: "sandbox.sellingpartnerapi-eu.amazon.com",
      is_active: true,
      auto_sync: true,
      seller_id: process.env.AMAZON_SELLER_ID || "A3SANDBOX123456789",
    },
    {
      marketplace_id: "A1VC38T7YXB528",
      country_code: "JP",
      name: "Amazon.co.jp (Sandbox)",
      currency_code: "JPY",
      region: "FE", 
      endpoint: "sandbox.sellingpartnerapi-fe.amazon.com",
      is_active: true,
      auto_sync: true,
      seller_id: process.env.AMAZON_SELLER_ID || "A3SANDBOX123456789",
    }
  ]

  try {
    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const marketplaceData of sandboxMarketplaces) {
      // 기존 마켓플레이스 확인
      const existing = await amazonService.listAmazonMarketplaces({
        marketplace_id: marketplaceData.marketplace_id
      })

      if (existing.length > 0) {
        // 기존 마켓플레이스 업데이트 (샌드박스 설정으로)
        const marketplace = existing[0]
        await amazonService.updateAmazonMarketplaces({ id: marketplace.id }, {
          seller_id: marketplaceData.seller_id,
          is_active: marketplaceData.is_active,
          auto_sync: marketplaceData.auto_sync,
          name: marketplaceData.name, // 샌드박스 표시 추가
          endpoint: marketplaceData.endpoint // 샌드박스 엔드포인트
        })
        logger.info(`🔄 ${marketplaceData.name} - 샌드박스 설정으로 업데이트됨`)
        updatedCount++
      } else {
        // 새로운 마켓플레이스 생성
        await amazonService.createAmazonMarketplaces(marketplaceData)
        logger.info(`✅ ${marketplaceData.name} - 새로 생성됨`)
        createdCount++
      }
    }

    logger.info(`\n🎉 Amazon 샌드박스 환경 설정 완료!`)
    logger.info(`📊 통계:`)
    logger.info(`   - 새로 생성된 마켓플레이스: ${createdCount}개`)
    logger.info(`   - 업데이트된 마켓플레이스: ${updatedCount}개`)
    logger.info(`   - 총 샌드박스 마켓플레이스: ${sandboxMarketplaces.length}개`)
    
    logger.info(`\n📋 설정된 샌드박스 마켓플레이스:`)
    sandboxMarketplaces.forEach(mp => {
      logger.info(`   🟢 ${mp.name} (${mp.country_code}) - ${mp.marketplace_id}`)
      logger.info(`      Seller ID: ${mp.seller_id}`)
      logger.info(`      Endpoint: ${mp.endpoint}`)
    })

    // 샌드박스 테스트 가이드
    logger.info(`\n📝 다음 단계:`)
    logger.info(`1. 샌드박스 헬스체크 실행: npx medusa exec src/scripts/test-amazon-sandbox.ts`)
    logger.info(`2. Admin UI 접속: http://localhost:10000/app/settings/amazon`)
    logger.info(`3. 연결 테스트 버튼으로 SP-API 연결 확인`)
    logger.info(`4. 테스트 상품을 생성하고 동기화 테스트`)

    logger.info(`\n🔒 보안 참고사항:`)
    logger.info(`- 샌드박스 자격 증명은 실제 데이터에 접근할 수 없습니다`)
    logger.info(`- 프로덕션 전에 실제 자격 증명으로 교체하세요`)
    logger.info(`- 환경 변수를 .env 파일에 안전하게 저장하세요`)

  } catch (error) {
    logger.error(`❌ Amazon 샌드박스 환경 설정 중 오류 발생:`, error)
    throw error
  }
}