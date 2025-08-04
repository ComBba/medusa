import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * 데이터베이스 직접 접근으로 마켓플레이스 활성화
 * 
 * 세션 문제를 우회하여 직접 데이터베이스를 업데이트합니다.
 */
export default async function directDbActivate({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("🔧 데이터베이스 직접 접근으로 마켓플레이스 활성화...")

  try {
    // 데이터베이스 연결 가져오기
    const dbConnection = container.resolve("dbConnection")
    
    if (!dbConnection) {
      logger.error("❌ 데이터베이스 연결을 찾을 수 없습니다.")
      return
    }

    logger.info("✅ 데이터베이스 연결 확보")

    // 환경 변수에서 올바른 값들 가져오기
    const sellerIdFromEnv = process.env.AMAZON_SELLER_ID || 'A29WXO3VK3FMZ1'
    
    logger.info(`📊 업데이트할 값들:`)
    logger.info(`   - marketplace_id: ATVPDKIKX0DER`)
    logger.info(`   - is_active: true`)
    logger.info(`   - seller_id: ${sellerIdFromEnv}`)
    logger.info(`   - auto_sync: true`)

    // 직접 SQL 실행
    const updateQuery = `
      UPDATE amazon_marketplace 
      SET 
        is_active = true,
        seller_id = $1,
        auto_sync = true,
        updated_at = NOW()
      WHERE marketplace_id = 'ATVPDKIKX0DER'
      RETURNING *;
    `

    logger.info("🔄 SQL 업데이트 실행...")
    
    const result = await dbConnection.query(updateQuery, [sellerIdFromEnv])
    
    if (result.rows && result.rows.length > 0) {
      const updatedRow = result.rows[0]
      logger.info("✅ 데이터베이스 업데이트 성공!")
      logger.info("📊 업데이트된 레코드:")
      logger.info(`   - ID: ${updatedRow.id}`)
      logger.info(`   - marketplace_id: ${updatedRow.marketplace_id}`)
      logger.info(`   - name: ${updatedRow.name}`)
      logger.info(`   - is_active: ${updatedRow.is_active}`)
      logger.info(`   - seller_id: ${updatedRow.seller_id}`)
      logger.info(`   - auto_sync: ${updatedRow.auto_sync}`)
      logger.info(`   - updated_at: ${updatedRow.updated_at}`)
    } else {
      logger.warn("⚠️ 업데이트된 레코드가 없습니다.")
    }

    // 결과 확인 쿼리
    const selectQuery = `
      SELECT id, marketplace_id, name, is_active, seller_id, auto_sync 
      FROM amazon_marketplace 
      WHERE marketplace_id = 'ATVPDKIKX0DER';
    `
    
    logger.info("🔍 업데이트 결과 확인...")
    const selectResult = await dbConnection.query(selectQuery)
    
    if (selectResult.rows && selectResult.rows.length > 0) {
      const marketplace = selectResult.rows[0]
      logger.info("📊 현재 상태:")
      logger.info(`   - 활성화: ${marketplace.is_active ? '✅ 성공' : '❌ 실패'}`)
      logger.info(`   - 판매자 ID: ${marketplace.seller_id || '❌ 미설정'}`)
      logger.info(`   - 자동 동기화: ${marketplace.auto_sync ? '✅ 활성' : '❌ 비활성'}`)
      
      if (marketplace.is_active && marketplace.seller_id) {
        logger.info("🎉 마켓플레이스 활성화 성공!")
        logger.info("\n🚀 이제 동기화 테스트를 실행할 수 있습니다:")
        logger.info("   cd /home/barahime/github/medusa/kbeauty-app")
        logger.info("   npx medusa exec src/scripts/simple-sandbox-test.ts")
      } else {
        logger.warn("⚠️ 활성화가 완전히 되지 않았습니다.")
      }
    }

    // 모든 활성 마켓플레이스 확인
    const activeQuery = `
      SELECT marketplace_id, name, country_code, is_active, seller_id
      FROM amazon_marketplace 
      WHERE is_active = true;
    `
    
    const activeResult = await dbConnection.query(activeQuery)
    logger.info(`🎊 총 활성화된 마켓플레이스: ${activeResult.rows.length}개`)
    
    if (activeResult.rows.length > 0) {
      activeResult.rows.forEach((row, index) => {
        logger.info(`   ${index + 1}. ${row.name} (${row.country_code}) - ${row.marketplace_id}`)
        logger.info(`      Seller ID: ${row.seller_id}`)
      })
    }

  } catch (error) {
    logger.error(`💥 데이터베이스 접근 오류: ${error.message}`)
    
    // 대안: Repository 패턴 시도
    logger.info("🔄 대안 방법 시도...")
    
    try {
      const { AMAZON_INTEGRATION_MODULE } = await import("../modules/amazon-integration")
      const amazonService = container.resolve(AMAZON_INTEGRATION_MODULE)
      
      // 강제 flush 시도
      const em = amazonService.em_
      if (em) {
        logger.info("📊 EntityManager flush 시도...")
        await em.flush()
        logger.info("✅ EntityManager flush 완료")
      }
      
    } catch (altError) {
      logger.error(`❌ 대안 방법 실패: ${altError.message}`)
      
      logger.info("\n💡 수동 해결 방법:")
      logger.info("1. 브라우저 쿠키와 캐시를 모두 삭제하세요")
      logger.info("2. Admin UI를 새 시크릿/프라이빗 창에서 열어보세요")
      logger.info("3. 로그인 후 즉시 Amazon 설정 페이지로 이동하세요")
      logger.info("4. 빠르게 Seller ID를 입력하고 저장하세요")
    }
  }
}