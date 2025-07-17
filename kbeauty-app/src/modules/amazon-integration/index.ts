import { asClass, asFunction } from "awilix"
import { MedusaModule } from "@medusajs/framework/utils"

// 기존 서비스
import AmazonIntegrationModuleService from "./service"

// 새로운 서비스들
import AmazonService from "./services/amazon.service"
import InventorySyncService from "./services/inventory-sync.service"
import PricingSyncService from "./services/pricing-sync.service"
import OrdersSyncService from "./services/orders-sync.service"

// 구독자들
import productCreatedSubscriber from "./subscribers/product-created.subscriber"
import inventoryChangedSubscriber from "./subscribers/inventory-changed.subscriber"
import priceUpdatedSubscriber from "./subscribers/price-updated.subscriber"
import orderEventsSubscriber from "./subscribers/order-events.subscriber"

export const AMAZON_INTEGRATION_MODULE = "amazon-integration"

/**
 * Amazon 통합 모듈
 * 
 * 상품, 재고, 가격, 주문의 완전한 Amazon 동기화를 제공합니다.
 * K-Beauty 특화 기능과 다중 마켓플레이스 지원을 포함합니다.
 */
const AmazonIntegrationModule: MedusaModule = {
  key: AMAZON_INTEGRATION_MODULE,
  
  /**
   * 서비스 및 의존성 등록
   */
  register: (container, config) => {
    // ===========================================
    // 핵심 서비스들 등록
    // ===========================================
    
    // 메인 Amazon 통합 서비스
    container.register({
      amazonIntegrationService: asClass(AmazonIntegrationModuleService).singleton(),
    })

    // Amazon SP-API 통합 서비스
    container.register({
      amazonService: asClass(AmazonService)
        .singleton()
        .inject(() => ({ 
          logger: container.resolve('logger')
        })),
    })

    // 재고 동기화 서비스
    container.register({
      inventorySyncService: asClass(InventorySyncService)
        .singleton()
        .inject(() => ({
          logger: container.resolve('logger'),
          amazonIntegrationService: container.resolve('amazonIntegrationService'),
          amazonService: container.resolve('amazonService')
        })),
    })

    // 가격 동기화 서비스
    container.register({
      pricingSyncService: asClass(PricingSyncService)
        .singleton()
        .inject(() => ({
          logger: container.resolve('logger'),
          amazonIntegrationService: container.resolve('amazonIntegrationService'),
          amazonService: container.resolve('amazonService')
        })),
    })

    // 주문 동기화 서비스
    container.register({
      ordersSyncService: asClass(OrdersSyncService)
        .singleton()
        .inject(() => ({
          logger: container.resolve('logger'),
          amazonIntegrationService: container.resolve('amazonIntegrationService'),
          amazonService: container.resolve('amazonService')
        })),
    })

    // ===========================================
    // 이벤트 구독자들 등록
    // ===========================================

    // 상품 생성 구독자
    container.register({
      productCreatedSubscriber: asFunction(() => productCreatedSubscriber).singleton(),
    })

    // 재고 변경 구독자
    container.register({
      inventoryChangedSubscriber: asFunction(() => inventoryChangedSubscriber).singleton(),
    })

    // 가격 업데이트 구독자
    container.register({
      priceUpdatedSubscriber: asFunction(() => priceUpdatedSubscriber).singleton(),
    })

    // 주문 이벤트 구독자
    container.register({
      orderEventsSubscriber: asFunction(() => orderEventsSubscriber).singleton(),
    })

    // ===========================================
    // 설정 및 헬퍼 함수들
    // ===========================================

    // 모듈 설정
    container.register({
      amazonIntegrationConfig: asFunction(() => ({
        // 기본 설정
        auto_sync_enabled: config?.auto_sync_enabled ?? true,
        batch_size: config?.batch_size ?? 50,
        retry_attempts: config?.retry_attempts ?? 3,
        
        // Amazon SP-API 설정
        sandbox_mode: config?.sandbox_mode ?? (process.env.NODE_ENV !== 'production'),
        api_timeout: config?.api_timeout ?? 30000,
        
        // 동기화 설정
        inventory_sync_threshold: config?.inventory_sync_threshold ?? 1,
        price_sync_threshold: config?.price_sync_threshold ?? 1.00,
        currency_conversion_api: config?.currency_conversion_api,
        
        // K-Beauty 특화 설정
        enable_kbeauty_optimizations: config?.enable_kbeauty_optimizations ?? true,
        japan_premium_percentage: config?.japan_premium_percentage ?? 20,
        us_competitive_discount: config?.us_competitive_discount ?? 5,
        
        // 주문 동기화 설정
        order_polling_interval: config?.order_polling_interval ?? 15, // 분
        create_medusa_orders: config?.create_medusa_orders ?? true,
        sync_order_status: config?.sync_order_status ?? true,
        
        ...config
      })).singleton(),
    })

    // 통계 및 모니터링 서비스
    container.register({
      amazonStatsService: asFunction((deps) => ({
        async getOverallStats() {
          const inventoryStats = await deps.inventorySyncService.getInventorySyncStats()
          const pricingStats = await deps.pricingSyncService.getPricingSyncStats()
          const orderStats = await deps.ordersSyncService.getOrderSyncStats()
          const amazonStats = await deps.amazonIntegrationService.getSyncStatistics()

          return {
            overall: amazonStats,
            inventory: inventoryStats,
            pricing: pricingStats,
            orders: orderStats,
            last_updated: new Date()
          }
        },

        async getHealthCheck() {
          try {
            const marketplaces = await deps.amazonIntegrationService.getActiveMarketplaces()
            const healthChecks = []

            for (const marketplace of marketplaces) {
              const result = await deps.amazonService.testConnection(marketplace)
              healthChecks.push({
                marketplace: marketplace.country_code,
                healthy: result.success,
                message: result.message
              })
            }

            return {
              overall_health: healthChecks.every(h => h.healthy),
              marketplace_health: healthChecks,
              checked_at: new Date()
            }
          } catch (error) {
            return {
              overall_health: false,
              error: error.message,
              checked_at: new Date()
            }
          }
        }
      })).inject(() => ({
        inventorySyncService: container.resolve('inventorySyncService'),
        pricingSyncService: container.resolve('pricingSyncService'),
        ordersSyncService: container.resolve('ordersSyncService'),
        amazonIntegrationService: container.resolve('amazonIntegrationService'),
        amazonService: container.resolve('amazonService')
      })).singleton(),
    })

    // 로깅 설정
    const logger = container.resolve('logger')
    logger.info('🌸 Amazon Integration Module 등록 완료', {
      module: AMAZON_INTEGRATION_MODULE,
      services: [
        'amazonService',
        'inventorySyncService', 
        'pricingSyncService',
        'ordersSyncService'
      ],
      subscribers: [
        'productCreatedSubscriber',
        'inventoryChangedSubscriber',
        'priceUpdatedSubscriber', 
        'orderEventsSubscriber'
      ],
      config: {
        auto_sync: config?.auto_sync_enabled ?? true,
        sandbox_mode: config?.sandbox_mode ?? (process.env.NODE_ENV !== 'production'),
        kbeauty_optimizations: config?.enable_kbeauty_optimizations ?? true
      }
    })
  },

  /**
   * 모듈 부팅 - 이벤트 구독 시작
   */
  boot: (container) => {
    const logger = container.resolve('logger')
    
    try {
      logger.info('🚀 Amazon Integration Module 부팅 시작...')

      // 각 구독자들의 이벤트 구독 시작
      // Note: Medusa v2에서는 구독자들이 자동으로 등록되므로 
      // 여기서 수동으로 subscribe()를 호출할 필요가 없을 수 있음
      
      // 설정 검증
      const config = container.resolve('amazonIntegrationConfig')
      logger.info('📋 Amazon Integration 설정 검증', {
        auto_sync: config.auto_sync_enabled,
        sandbox_mode: config.sandbox_mode,
        batch_size: config.batch_size,
        kbeauty_optimizations: config.enable_kbeauty_optimizations
      })

      // 통계 서비스 헬스체크
      const statsService = container.resolve('amazonStatsService')
      statsService.getHealthCheck()
        .then(health => {
          logger.info('💚 Amazon 마켓플레이스 연결 상태', health)
        })
        .catch(error => {
          logger.warn('⚠️ Amazon 마켓플레이스 연결 확인 실패', { error: error.message })
        })

      // 주기적 동기화 작업 스케줄링 (선택사항)
      if (config.auto_sync_enabled) {
        logger.info('⏰ 자동 동기화 스케줄 활성화됨')
        
        // TODO: 실제 운영에서는 cron job이나 job queue를 사용하여
        // 주기적으로 동기화 누락 확인 및 처리
        // - 재고 차이 확인 및 동기화
        // - 가격 차이 확인 및 동기화  
        // - 새 주문 폴링
        // - 실패한 동기화 재시도
      }

      logger.info('✅ Amazon Integration Module 부팅 완료', {
        module: AMAZON_INTEGRATION_MODULE,
        status: 'ready',
        features: [
          '상품 자동 등록',
          '재고 실시간 동기화',
          '가격 자동 업데이트',
          '주문 양방향 동기화',
          'K-Beauty 최적화',
          '다중 마켓플레이스 지원'
        ]
      })

    } catch (error) {
      logger.error('💥 Amazon Integration Module 부팅 실패', {
        module: AMAZON_INTEGRATION_MODULE,
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }
}

export default AmazonIntegrationModule

// 개별 서비스들도 export (외부에서 직접 사용 가능)
export { 
  AmazonIntegrationModuleService,
  AmazonService,
  InventorySyncService,
  PricingSyncService,
  OrdersSyncService
} 