import { ExecArgs } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 마켓플레이스 활성화 문제 해결 스크립트
 * 
 * .env 파일의 올바른 값들을 사용하여 US 마켓플레이스를 확실하게 활성화합니다.
 * 절대경로 사용으로 경로 오류를 방지합니다.
 */
export default async function fixMarketplaceActivation({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("🔧 마켓플레이스 활성화 문제 해결 시작...")

  try {
    const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 환경 변수에서 올바른 값들 가져오기
    const sellerIdFromEnv = process.env.AMAZON_SELLER_ID
    const clientId = process.env.AMAZON_LWA_CLIENT_ID
    const sandboxMode = process.env.AMAZON_SP_API_SANDBOX === 'true'
    
    logger.info("📋 환경 변수 확인:")
    logger.info(`   - AMAZON_SELLER_ID: ${sellerIdFromEnv}`)
    logger.info(`   - AMAZON_LWA_CLIENT_ID: ${clientId ? '설정됨' : '❌ 미설정'}`)
    logger.info(`   - AMAZON_SP_API_SANDBOX: ${sandboxMode ? '✅ 활성' : '❌ 비활성'}`)

    if (!sellerIdFromEnv || sellerIdFromEnv === 'your-seller-id') {
      logger.error("❌ AMAZON_SELLER_ID가 올바르게 설정되지 않았습니다.")
      logger.info("💡 .env 파일에서 AMAZON_SELLER_ID=A29WXO3VK3FMZ1 을 확인하세요.")
      return
    }

    // 모든 마켓플레이스 조회
    const allMarketplaces = await amazonService.listAmazonMarketplaces()
    logger.info(`📊 총 마켓플레이스: ${allMarketplaces.length}개`)

    // US 마켓플레이스 찾기
    const usMarketplace = allMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (!usMarketplace) {
      logger.error("❌ US 마켓플레이스(ATVPDKIKX0DER)를 찾을 수 없습니다.")
      return
    }

    logger.info(`🎯 대상 마켓플레이스: ${usMarketplace.name}`)
    logger.info(`📊 현재 상태:`)
    logger.info(`   - 활성화: ${usMarketplace.is_active ? '✅' : '❌'}`)
    logger.info(`   - 자동 동기화: ${usMarketplace.auto_sync ? '✅' : '❌'}`)
    logger.info(`   - 판매자 ID: ${usMarketplace.seller_id || '❌ 미설정'}`)
    logger.info(`   - 마켓플레이스 ID: ${usMarketplace.marketplace_id}`)

    // 강제 업데이트 시도
    logger.info("🔄 강제 업데이트 시도...")
    
    const updateData = {
      is_active: true,
      auto_sync: true,
      seller_id: sellerIdFromEnv,  // .env에서 가져온 올바른 값
      updated_at: new Date()
    }

    logger.info("📝 업데이트할 데이터:")
    logger.info(`   - is_active: ${updateData.is_active}`)
    logger.info(`   - auto_sync: ${updateData.auto_sync}`)
    logger.info(`   - seller_id: ${updateData.seller_id}`)

    try {
      // 방법 1: updateAmazonMarketplaces 사용
      const updateResult = await amazonService.updateAmazonMarketplaces(
        { id: usMarketplace.id },
        updateData
      )
      
      logger.info("✅ updateAmazonMarketplaces 성공!")
      logger.info(`📊 업데이트 결과: ${JSON.stringify(updateResult, null, 2)}`)

    } catch (updateError) {
      logger.error(`❌ updateAmazonMarketplaces 실패: ${updateError.message}`)
      
      // 방법 2: retrieve → modify → update 패턴
      logger.info("🔄 대안 방법 시도: retrieve → modify → save")
      
      try {
        const marketplace = await amazonService.retrieveAmazonMarketplace(usMarketplace.id)
        logger.info("✅ 마켓플레이스 조회 성공")
        
        // 직접 속성 수정
        if (marketplace) {
          Object.assign(marketplace, updateData)
          logger.info("✅ 속성 수정 완료")
          
          // 다시 저장 시도
          const saveResult = await amazonService.updateAmazonMarketplaces(
            { id: marketplace.id },
            updateData
          )
          logger.info("✅ 대안 방법 성공!")
        }
      } catch (altError) {
        logger.error(`❌ 대안 방법도 실패: ${altError.message}`)
      }
    }

    // 업데이트 결과 확인
    logger.info("🔍 업데이트 결과 재확인...")
    const updatedMarketplaces = await amazonService.listAmazonMarketplaces()
    const updatedUsMarketplace = updatedMarketplaces.find(m => m.marketplace_id === 'ATVPDKIKX0DER')
    
    if (updatedUsMarketplace) {
      logger.info("📊 업데이트 후 상태:")
      logger.info(`   - 활성화: ${updatedUsMarketplace.is_active ? '✅ 성공' : '❌ 실패'}`)
      logger.info(`   - 자동 동기화: ${updatedUsMarketplace.auto_sync ? '✅ 성공' : '❌ 실패'}`)
      logger.info(`   - 판매자 ID: ${updatedUsMarketplace.seller_id || '❌ 미설정'}`)
      
      // 올바른 Seller ID가 설정되었는지 확인
      if (updatedUsMarketplace.seller_id === sellerIdFromEnv) {
        logger.info("✅ Seller ID가 올바르게 설정되었습니다!")
      } else {
        logger.warn(`⚠️ Seller ID 불일치: 예상=${sellerIdFromEnv}, 실제=${updatedUsMarketplace.seller_id}`)
      }
    }

    // 활성 마켓플레이스 확인
    const activeMarketplaces = await amazonService.getActiveMarketplaces()
    logger.info(`🎉 총 활성화된 마켓플레이스: ${activeMarketplaces.length}개`)
    
    if (activeMarketplaces.length > 0) {
      logger.info("🎊 성공! 활성화된 마켓플레이스:")
      activeMarketplaces.forEach((marketplace, index) => {
        logger.info(`   ${index + 1}. ${marketplace.name} (${marketplace.country_code})`)
        logger.info(`      - ID: ${marketplace.marketplace_id}`)
        logger.info(`      - Seller ID: ${marketplace.seller_id}`)
      })
      
      logger.info("\n🚀 이제 동기화 테스트를 실행할 수 있습니다!")
      logger.info("📝 테스트 명령어:")
      logger.info("   cd /home/barahime/github/medusa/kbeauty-app")
      logger.info("   npx medusa exec src/scripts/simple-sandbox-test.ts")
      
    } else {
      logger.warn("⚠️ 여전히 활성화된 마켓플레이스가 없습니다.")
      logger.info("\n💡 Admin UI 정보:")
      logger.info("   URL: http://localhost:10000/app/settings/amazon")
      logger.info("   이메일: admin@kbeauty.market")
      logger.info("   비밀번호: admin123")
      logger.info(`   Seller ID 입력란에: ${sellerIdFromEnv}`)
    }

    // 환경 변수 검증
    logger.info("\n📋 전체 환경 변수 상태:")
    const envVars = [
      'AMAZON_INTEGRATION_ENABLED',
      'AMAZON_SP_API_SANDBOX', 
      'AMAZON_AUTO_SYNC_ENABLED',
      'AMAZON_LWA_CLIENT_ID',
      'AMAZON_LWA_CLIENT_SECRET',
      'AMAZON_SELLER_ID'
    ]
    
    envVars.forEach(varName => {
      const value = process.env[varName]
      const status = value && value !== `your-${varName.toLowerCase().replace('amazon_', '').replace(/_/g, '-')}` ? '✅' : '❌'
      logger.info(`   ${status} ${varName}: ${value ? (varName.includes('SECRET') ? '***설정됨***' : value) : '미설정'}`)
    })

  } catch (error) {
    logger.error(`💥 오류 발생: ${error.message}`)
    logger.info("🔍 스택 트레이스:")
    logger.info(error.stack)
  }
}