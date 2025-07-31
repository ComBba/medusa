import amazonIntegration from "./modules/amazon-integration"
import { Logger } from "@medusajs/framework/types"

/**
 * kbeauty.market 애플리케이션 로더
 * 
 * 모든 커스텀 모듈들을 등록하고 초기화합니다.
 * Amazon 통합 모듈을 포함하여 K-Beauty 전문 기능을 제공합니다.
 */
export default ({ container }) => {
  const logger: Logger = container.resolve("logger")
  
  logger.info(`🌸 kbeauty.market 모듈 로딩 시작... - App: kbeauty.market, Mode: ${process.env.NODE_ENV || "development"}`)

  try {
    // ===========================================
    // 핵심 모듈들 등록
    // ===========================================

    // Amazon 통합 모듈 등록
    logger.info("📦 Amazon Integration Module 등록 중...")
    container.registerModule(amazonIntegration)
    logger.info("✅ Amazon Integration Module 등록 완료")

    // TODO: 추후 추가 모듈들
    // - payment-integration (한국 결제 시스템)
    // - shipping-integration (한국 배송 시스템)  
    // - analytics-integration (K-Beauty 전용 분석)
    // - notification-integration (한국어 알림)

    logger.info(`🎉 모든 모듈 로딩 완료 - Modules: amazon-integration, Status: ready`)

  } catch (error) {
    logger.error(`💥 모듈 로딩 중 오류 발생: ${error.message}`)
    throw error
  }
} 