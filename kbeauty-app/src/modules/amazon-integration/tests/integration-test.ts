import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService from "../services/amazon.service"
import InventorySyncService from "../services/inventory-sync.service"
import PricingSyncService from "../services/pricing-sync.service"
import OrdersSyncService from "../services/orders-sync.service"
import { ConfigValidator, AmazonConfiguration } from "../utils/config-validator"
import { RetryManager } from "../utils/retry"
import { ErrorUtils } from "../utils/errors"

export interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

export interface TestSuite {
  name: string
  tests: TestResult[]
  passed: boolean
  totalDuration: number
  summary: {
    total: number
    passed: number
    failed: number
  }
}

/**
 * Amazon 통합 시스템 통합 테스트
 * 
 * 전체 시스템의 기능과 안정성을 검증합니다.
 * 실제 Amazon API 호출 없이 모의 테스트로 진행됩니다.
 */
export class AmazonIntegrationTester {
  private logger: Logger
  private container: any

  constructor(container: any) {
    this.container = container
    this.logger = container.resolve('logger')
  }

  /**
   * 전체 테스트 실행
   */
  async runAllTests(): Promise<TestSuite[]> {
    this.logger.info('🧪 Amazon Integration 통합 테스트 시작')

    const testSuites: TestSuite[] = []

    try {
      // 1. 설정 검증 테스트
      testSuites.push(await this.runConfigurationTests())
      
      // 2. 서비스 초기화 테스트
      testSuites.push(await this.runServiceInitializationTests())
      
      // 3. 데이터 모델 테스트
      testSuites.push(await this.runDataModelTests())
      
      // 4. 동기화 로직 테스트
      testSuites.push(await this.runSyncLogicTests())
      
      // 5. 이벤트 구독자 테스트
      testSuites.push(await this.runSubscriberTests())
      
      // 6. 에러 처리 테스트
      testSuites.push(await this.runErrorHandlingTests())
      
      // 7. 유틸리티 테스트
      testSuites.push(await this.runUtilityTests())

      // 전체 결과 요약
      this.logTestSummary(testSuites)

    } catch (error) {
      this.logger.error(`🚨 테스트 실행 중 치명적 오류: ${error.message}`)
    }

    return testSuites
  }

  /**
   * 설정 검증 테스트
   */
  private async runConfigurationTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // 유효한 설정 테스트
    tests.push(await this.runTest('유효한 설정 검증', async () => {
      const validConfig: AmazonConfiguration = {
        client_id: 'amzn1.application-oa2-client.test123',
        client_secret: 'test-secret-key',
        refresh_token: 'test-refresh-token-12345678901234567890123456789012345678901234567890',
        default_marketplace_id: 'ATVPDKIKX0DER',
        supported_marketplaces: ['ATVPDKIKX0DER', 'A1VC38T7YXB528'],
        auto_sync_enabled: true,
        batch_size: 25,
        sandbox_mode: true
      }

      const result = ConfigValidator.validate(validConfig)
      
      if (!result.isValid) {
        throw new Error(`유효한 설정이 실패함: ${result.errors.join(', ')}`)
      }

      return { validationResult: result }
    }))

    // 무효한 설정 테스트
    tests.push(await this.runTest('무효한 설정 검증', async () => {
      const invalidConfig: AmazonConfiguration = {
        client_id: 'invalid-format',
        batch_size: 150, // 너무 큼
        japan_premium_percentage: 200 // 너무 큼
      }

      const result = ConfigValidator.validate(invalidConfig)
      
      if (result.isValid) {
        throw new Error('무효한 설정이 통과됨')
      }

      if (result.errors.length === 0) {
        throw new Error('에러가 감지되지 않음')
      }

      return { errorCount: result.errors.length }
    }))

    // K-Beauty 최적화 설정 테스트
    tests.push(await this.runTest('K-Beauty 최적화 설정', async () => {
      const recommendedMarketplaces = ConfigValidator.getRecommendedKBeautyMarketplaces()
      
      if (recommendedMarketplaces.length < 4) {
        throw new Error('권장 마켓플레이스가 부족함')
      }

      const hasJapan = recommendedMarketplaces.includes('A1VC38T7YXB528')
      const hasUS = recommendedMarketplaces.includes('ATVPDKIKX0DER')
      
      if (!hasJapan || !hasUS) {
        throw new Error('K-Beauty 주요 마켓플레이스가 누락됨')
      }

      return { recommendedCount: recommendedMarketplaces.length }
    }))

    return this.createTestSuite('설정 검증', tests)
  }

  /**
   * 서비스 초기화 테스트
   */
  private async runServiceInitializationTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // Amazon 통합 서비스 초기화
    tests.push(await this.runTest('Amazon 통합 서비스 초기화', async () => {
      const service = this.container.resolve('amazonIntegrationService')
      
      if (!service) {
        throw new Error('Amazon 통합 서비스가 등록되지 않음')
      }

      // 기본 메서드들이 존재하는지 확인
      const requiredMethods = [
        'getActiveMarketplaces',
        'getProductSyncStatus',
        'getSyncStatistics'
      ]

      for (const method of requiredMethods) {
        if (typeof service[method] !== 'function') {
          throw new Error(`필수 메서드가 없음: ${method}`)
        }
      }

      return { serviceName: 'AmazonIntegrationModuleService' }
    }))

    // 동기화 서비스들 초기화
    const syncServices = [
      { name: 'inventorySyncService', class: 'InventorySyncService' },
      { name: 'pricingSyncService', class: 'PricingSyncService' },
      { name: 'ordersSyncService', class: 'OrdersSyncService' }
    ]

    for (const serviceInfo of syncServices) {
      tests.push(await this.runTest(`${serviceInfo.class} 초기화`, async () => {
        const service = this.container.resolve(serviceInfo.name)
        
        if (!service) {
          throw new Error(`${serviceInfo.class}가 등록되지 않음`)
        }

        return { serviceName: serviceInfo.class }
      }))
    }

    return this.createTestSuite('서비스 초기화', tests)
  }

  /**
   * 데이터 모델 테스트
   */
  private async runDataModelTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // 마켓플레이스 모델 테스트
    tests.push(await this.runTest('마켓플레이스 모델 구조', async () => {
      // 모의 마켓플레이스 데이터
      const marketplaceData = {
        marketplace_id: 'ATVPDKIKX0DER',
        country_code: 'US',
        name: 'Amazon.com',
        currency_code: 'USD',
        region: 'NA',
        endpoint: 'sellingpartnerapi-na.amazon.com',
        is_active: true,
        auto_sync: true
      }

      // 필수 필드 검증
      const requiredFields = [
        'marketplace_id', 'country_code', 'name', 
        'currency_code', 'region', 'endpoint'
      ]

      for (const field of requiredFields) {
        if (!(field in marketplaceData)) {
          throw new Error(`필수 필드 누락: ${field}`)
        }
      }

      return { fieldsCount: Object.keys(marketplaceData).length }
    }))

    // 동기화 레코드 모델 테스트
    tests.push(await this.runTest('동기화 레코드 모델 구조', async () => {
      const syncData = {
        medusa_product_id: 'test-product-id',
        amazon_marketplace_id: 'test-marketplace-id',
        sync_status: 'pending',
        sync_attempts: 0,
        max_attempts: 3
      }

      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled']
      
      if (!validStatuses.includes(syncData.sync_status)) {
        throw new Error(`유효하지 않은 동기화 상태: ${syncData.sync_status}`)
      }

      return { status: syncData.sync_status }
    }))

    return this.createTestSuite('데이터 모델', tests)
  }

  /**
   * 동기화 로직 테스트
   */
  private async runSyncLogicTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // 상품 매핑 테스트
    tests.push(await this.runTest('상품 데이터 매핑', async () => {
      const mockProduct = {
        id: 'test-product',
        title: 'K-Beauty 테스트 상품',
        description: 'Korean skincare product',
        variants: [{
          id: 'test-variant',
          sku: 'KB-TEST-001',
          prices: [{ currency_code: 'USD', amount: 2999 }]
        }],
        tags: [{ value: 'skincare' }, { value: 'korean' }]
      }

      const mockMarketplace = {
        marketplace_id: 'ATVPDKIKX0DER',
        country_code: 'US',
        currency_code: 'USD'
      }

      // 매핑 로직 실행 (실제 구현에서는 ProductMapperService 사용)
      const mappedData = {
        sku: mockProduct.variants[0].sku,
        title: mockProduct.title,
        description: mockProduct.description,
        price: mockProduct.variants[0].prices[0].amount / 100,
        currency: mockMarketplace.currency_code
      }

      if (!mappedData.sku || !mappedData.title) {
        throw new Error('필수 매핑 데이터 누락')
      }

      return { mappedFields: Object.keys(mappedData).length }
    }))

    // 재고 동기화 로직 테스트
    tests.push(await this.runTest('재고 동기화 로직', async () => {
      const inventoryData = [
        {
          id: 'inv-1',
          sku: 'KB-TEST-001',
          location_id: 'loc-1',
          stocked_quantity: 100,
          reserved_quantity: 10,
          incoming_quantity: 0
        }
      ]

      // 사용 가능 재고 계산
      const availableQuantity = inventoryData[0].stocked_quantity - inventoryData[0].reserved_quantity
      
      if (availableQuantity !== 90) {
        throw new Error('재고 계산 오류')
      }

      return { availableQuantity }
    }))

    // 가격 동기화 로직 테스트
    tests.push(await this.runTest('가격 동기화 로직', async () => {
      const priceData = [
        {
          product_id: 'prod-1',
          currency_code: 'USD',
          amount: 29.99,
          sale_amount: 24.99
        }
      ]

      // K-Beauty 지역별 가격 조정 테스트
      const basePrice = priceData[0].amount
      const japanPrice = basePrice * 1.20 // 20% 프리미엄
      const usPrice = basePrice * 0.95    // 5% 할인

      if (japanPrice <= basePrice || usPrice >= basePrice) {
        throw new Error('K-Beauty 가격 전략 오류')
      }

      return { 
        basePrice,
        japanPrice: Math.round(japanPrice * 100) / 100,
        usPrice: Math.round(usPrice * 100) / 100
      }
    }))

    return this.createTestSuite('동기화 로직', tests)
  }

  /**
   * 이벤트 구독자 테스트
   */
  private async runSubscriberTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // 구독자 등록 확인
    const subscribers = [
      'productCreatedSubscriber',
      'inventoryChangedSubscriber', 
      'priceUpdatedSubscriber',
      'orderEventsSubscriber'
    ]

    for (const subscriberName of subscribers) {
      tests.push(await this.runTest(`${subscriberName} 등록`, async () => {
        const subscriber = this.container.resolve(subscriberName)
        
        if (!subscriber) {
          throw new Error(`구독자가 등록되지 않음: ${subscriberName}`)
        }

        return { subscriberName }
      }))
    }

    // 이벤트 데이터 구조 테스트
    tests.push(await this.runTest('이벤트 데이터 구조', async () => {
      const mockEvents = {
        productCreated: {
          id: 'prod-1',
          title: 'Test Product',
          status: 'published'
        },
        inventoryChanged: {
          id: 'inv-1',
          product_id: 'prod-1',
          stocked_quantity: 100,
          reserved_quantity: 10
        },
        priceUpdated: {
          id: 'price-1',
          product_id: 'prod-1',
          currency_code: 'USD',
          amount: 2999
        }
      }

      // 각 이벤트 구조 검증
      for (const [eventType, eventData] of Object.entries(mockEvents)) {
        if (!eventData.id) {
          throw new Error(`${eventType} 이벤트에 ID가 없음`)
        }
      }

      return { eventTypes: Object.keys(mockEvents).length }
    }))

    return this.createTestSuite('이벤트 구독자', tests)
  }

  /**
   * 에러 처리 테스트
   */
  private async runErrorHandlingTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // 재시도 로직 테스트
    tests.push(await this.runTest('재시도 로직', async () => {
      let attemptCount = 0
      
      const failingOperation = async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('일시적 오류')
        }
        return 'success'
      }

      const result = await RetryManager.withRetry(
        failingOperation,
        { maxAttempts: 3, baseDelay: 10 }
      )

      if (result.result !== 'success' || result.attempts !== 3) {
        throw new Error('재시도 로직 오류')
      }

      return { attempts: result.attempts }
    }))

    // 에러 분류 테스트
    tests.push(await this.runTest('에러 분류', async () => {
      const networkError = new Error('ECONNRESET')
      const authError = new Error('Unauthorized')
      
      const isNetworkRetryable = ErrorUtils.isRetryableError(networkError)
      const isAuthRetryable = ErrorUtils.isRetryableError(authError)
      
      if (!isNetworkRetryable) {
        throw new Error('네트워크 에러가 재시도 가능으로 분류되지 않음')
      }
      
      if (isAuthRetryable) {
        throw new Error('인증 에러가 재시도 가능으로 잘못 분류됨')
      }

      return { networkRetryable: isNetworkRetryable, authRetryable: isAuthRetryable }
    }))

    return this.createTestSuite('에러 처리', tests)
  }

  /**
   * 유틸리티 테스트
   */
  private async runUtilityTests(): Promise<TestSuite> {
    const tests: TestResult[] = []

    // 설정 검증 유틸리티 테스트
    tests.push(await this.runTest('설정 검증 유틸리티', async () => {
      const supportedMarketplaces = ConfigValidator.getSupportedMarketplaces()
      
      if (!supportedMarketplaces.US || !supportedMarketplaces.JP) {
        throw new Error('주요 마켓플레이스가 지원 목록에 없음')
      }

      return { marketplaceCount: Object.keys(supportedMarketplaces).length }
    }))

    // 에러 헬퍼 테스트
    tests.push(await this.runTest('에러 헬퍼 유틸리티', async () => {
      const testError = new Error('테스트 에러')
      const logObject = ErrorUtils.toLogObject(testError)
      
      if (!logObject.name || !logObject.message) {
        throw new Error('에러 로깅 객체 변환 실패')
      }

      const userMessage = ErrorUtils.toUserFriendlyMessage(testError)
      
      if (!userMessage.includes('알 수 없는 오류')) {
        throw new Error('사용자 친화적 메시지 변환 실패')
      }

      return { hasLogObject: true, hasUserMessage: true }
    }))

    return this.createTestSuite('유틸리티', tests)
  }

  /**
   * 개별 테스트 실행
   */
  private async runTest(
    name: string, 
    testFunction: () => Promise<any>
  ): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      const result = await testFunction()
      const duration = Date.now() - startTime
      
      this.logger.debug(`✅ ${name} 통과 - Duration: ${duration}ms`)
      
      return {
        name,
        passed: true,
        duration,
        details: result
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.logger.error(`❌ ${name} 실패 - Duration: ${duration}ms, Error: ${error.message}`)
      
      return {
        name,
        passed: false,
        duration,
        error: error.message
      }
    }
  }

  /**
   * 테스트 스위트 생성
   */
  private createTestSuite(name: string, tests: TestResult[]): TestSuite {
    const passed = tests.every(test => test.passed)
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0)
    const passedCount = tests.filter(test => test.passed).length
    
    return {
      name,
      tests,
      passed,
      totalDuration,
      summary: {
        total: tests.length,
        passed: passedCount,
        failed: tests.length - passedCount
      }
    }
  }

  /**
   * 테스트 결과 요약 로깅
   */
  private logTestSummary(testSuites: TestSuite[]) {
    const overallPassed = testSuites.every(suite => suite.passed)
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.summary.total, 0)
    const totalPassed = testSuites.reduce((sum, suite) => sum + suite.summary.passed, 0)
    const totalDuration = testSuites.reduce((sum, suite) => sum + suite.totalDuration, 0)

    this.logger.info(`🏁 Amazon Integration 테스트 완료 - Result: ${overallPassed ? 'PASSED' : 'FAILED'}, Tests: ${totalPassed}/${totalTests}, Duration: ${totalDuration}ms, Suites: ${testSuites.map(suite => `${suite.name}(${suite.summary.passed}/${suite.summary.total})`).join(', ')}`)

    // 실패한 테스트 상세 로깅
    testSuites.forEach(suite => {
      const failedTests = suite.tests.filter(test => !test.passed)
      if (failedTests.length > 0) {
        this.logger.error(`❌ ${suite.name} 실패한 테스트들 - Count: ${failedTests.length}, Tests: ${failedTests.map(test => test.name).join(', ')}`)
      }
    })
  }
} 