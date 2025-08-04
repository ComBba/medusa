import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Raw SQL로 마켓플레이스 활성화
 */
export default async function rawSqlActivate({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("🔧 Raw SQL로 마켓플레이스 활성화...")

  try {
    // MikroORM EntityManager 가져오기
    const em = container.resolve("manager")
    
    if (!em) {
      logger.error("❌ EntityManager를 찾을 수 없습니다.")
      return
    }

    logger.info("✅ EntityManager 확보")

    const sellerIdFromEnv = process.env.AMAZON_SELLER_ID || 'A29WXO3VK3FMZ1'
    
    logger.info(`📊 업데이트할 값: seller_id = ${sellerIdFromEnv}`)

    // Raw SQL 실행
    const updateSql = `
      UPDATE amazon_marketplace 
      SET 
        is_active = true,
        seller_id = ?,
        auto_sync = true,
        updated_at = NOW()
      WHERE marketplace_id = 'ATVPDKIKX0DER'
    `

    logger.info("🔄 Raw SQL 업데이트 실행...")
    
    await em.execute(updateSql, [sellerIdFromEnv])
    
    logger.info("✅ Raw SQL 업데이트 완료!")

    // 결과 확인
    const selectSql = `
      SELECT id, marketplace_id, name, is_active, seller_id, auto_sync 
      FROM amazon_marketplace 
      WHERE marketplace_id = 'ATVPDKIKX0DER'
    `
    
    logger.info("🔍 업데이트 결과 확인...")
    const result = await em.execute(selectSql)
    
    if (result && result.length > 0) {
      const marketplace = result[0]
      logger.info("📊 현재 상태:")
      logger.info(`   - ID: ${marketplace.id}`)
      logger.info(`   - marketplace_id: ${marketplace.marketplace_id}`)
      logger.info(`   - name: ${marketplace.name}`)
      logger.info(`   - 활성화: ${marketplace.is_active ? '✅ 성공' : '❌ 실패'}`)
      logger.info(`   - 판매자 ID: ${marketplace.seller_id || '❌ 미설정'}`)
      logger.info(`   - 자동 동기화: ${marketplace.auto_sync ? '✅ 활성' : '❌ 비활성'}`)
      
      if (marketplace.is_active && marketplace.seller_id) {
        logger.info("🎉 마켓플레이스 활성화 성공!")
      } else {
        logger.warn("⚠️ 활성화가 완전히 되지 않았습니다.")
      }
    }

    // 모든 활성 마켓플레이스 확인
    const activeSelect = `
      SELECT marketplace_id, name, country_code, is_active, seller_id
      FROM amazon_marketplace 
      WHERE is_active = true
    `
    
    const activeResult = await em.execute(activeSelect)
    logger.info(`🎊 총 활성화된 마켓플레이스: ${activeResult ? activeResult.length : 0}개`)
    
    if (activeResult && activeResult.length > 0) {
      activeResult.forEach((row, index) => {
        logger.info(`   ${index + 1}. ${row.name} (${row.country_code}) - ${row.marketplace_id}`)
        logger.info(`      Seller ID: ${row.seller_id}`)
      })
      
      logger.info("\n🚀 이제 동기화 테스트를 실행할 수 있습니다:")
      logger.info("   cd /home/barahime/github/medusa/kbeauty-app")
      logger.info("   npx medusa exec src/scripts/simple-sandbox-test.ts")
    }

  } catch (error) {
    logger.error(`💥 Raw SQL 실행 오류: ${error.message}`)
    logger.info("🔍 스택 트레이스:")
    logger.info(error.stack)
    
    logger.info("\n💡 마지막 해결 방법:")
    logger.info("1. 브라우저를 완전히 닫고 다시 열기")
    logger.info("2. http://localhost:10000/app 접속")
    logger.info("3. 빠르게 로그인하기")
    logger.info("4. 주소창에 직접 입력: http://localhost:10000/app/settings/amazon")
    logger.info("5. Seller ID에 A29WXO3VK3FMZ1 입력하고 즉시 저장")
    logger.info("6. 활성화 스위치 켜고 즉시 저장")
  }
}