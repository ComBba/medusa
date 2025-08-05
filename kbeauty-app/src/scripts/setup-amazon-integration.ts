import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
// import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Amazon 연동 초기 설정 스크립트
 * 
 * 기본 Amazon 마켓플레이스들을 데이터베이스에 추가합니다.
 * 
 * 사용법:
 * npx medusa exec ./src/scripts/setup-amazon-integration.ts
 */
export default async function setupAmazonIntegration({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)

  logger.info("🌸 kbeauty.market Amazon 연동 초기 설정 시작...")

  // 기본 Amazon 마켓플레이스 설정
  const defaultMarketplaces = [
    {
      marketplace_id: "ATVPDKIKX0DER",
      country_code: "US",
      name: "Amazon.com",
      currency_code: "USD",
      region: "NA",
      endpoint: "sellingpartnerapi-na.amazon.com",
      is_active: false, // 기본값은 비활성화
      auto_sync: true,
    },
    {
      marketplace_id: "A1PA6795UKMFR9",
      country_code: "DE",
      name: "Amazon.de",
      currency_code: "EUR",
      region: "EU",
      endpoint: "sellingpartnerapi-eu.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "A1VC38T7YXB528",
      country_code: "JP",
      name: "Amazon.co.jp",
      currency_code: "JPY",
      region: "FE",
      endpoint: "sellingpartnerapi-fe.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "A1F83G8C2ARO7P",
      country_code: "UK",
      name: "Amazon.co.uk",
      currency_code: "GBP",
      region: "EU",
      endpoint: "sellingpartnerapi-eu.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "A13V1IB3VIYZZH",
      country_code: "FR",
      name: "Amazon.fr",
      currency_code: "EUR",
      region: "EU",
      endpoint: "sellingpartnerapi-eu.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "APJ6JRA9NG5V4",
      country_code: "IT",
      name: "Amazon.it",
      currency_code: "EUR",
      region: "EU",
      endpoint: "sellingpartnerapi-eu.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "A1RKKUPIHCS9HS",
      country_code: "ES",
      name: "Amazon.es",
      currency_code: "EUR",
      region: "EU",
      endpoint: "sellingpartnerapi-eu.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "A2EUQ1WTGCTBG2",
      country_code: "CA",
      name: "Amazon.ca",
      currency_code: "CAD",
      region: "NA",
      endpoint: "sellingpartnerapi-na.amazon.com",
      is_active: false,
      auto_sync: true,
    },
    {
      marketplace_id: "A39IBJ37TRP1C6",
      country_code: "AU",
      name: "Amazon.com.au",
      currency_code: "AUD",
      region: "FE",
      endpoint: "sellingpartnerapi-fe.amazon.com",
      is_active: false,
      auto_sync: true,
    }
  ]

  try {
    let createdCount = 0
    let skippedCount = 0

    for (const marketplaceData of defaultMarketplaces) {
      // 이미 존재하는지 확인
      const existing = await amazonService.listAmazonMarketplaces({
        marketplace_id: marketplaceData.marketplace_id
      })

      if (existing.length > 0) {
        logger.info(`⏭️  ${marketplaceData.name} (${marketplaceData.country_code}) - 이미 존재함`)
        skippedCount++
        continue
      }

      // 새로운 마켓플레이스 생성
      await amazonService.createAmazonMarketplaces(marketplaceData)
      logger.info(`✅ ${marketplaceData.name} (${marketplaceData.country_code}) - 생성 완료`)
      createdCount++
    }

    logger.info(`\n🎉 Amazon 연동 초기 설정 완료!`)
    logger.info(`📊 통계:`)
    logger.info(`   - 새로 생성된 마켓플레이스: ${createdCount}개`)
    logger.info(`   - 이미 존재하는 마켓플레이스: ${skippedCount}개`)
    logger.info(`   - 총 마켓플레이스: ${defaultMarketplaces.length}개`)

    // 다음 단계 안내
    logger.info(`\n📝 다음 단계:`)
    logger.info(`1. Amazon Seller Central에서 SP-API 앱을 등록하세요`)
    logger.info(`2. 관리자 대시보드(/app)에서 Amazon 마켓플레이스를 활성화하세요`)
    logger.info(`3. Seller ID와 인증 토큰을 설정하세요`)
    logger.info(`4. 상품을 생성하면 자동으로 Amazon에 동기화됩니다!`)

  } catch (error) {
    logger.error(`❌ Amazon 연동 초기 설정 중 오류 발생:`, error)
    throw error
  }
} 