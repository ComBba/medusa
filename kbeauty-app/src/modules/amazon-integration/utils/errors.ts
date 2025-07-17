/**
 * Amazon 통합 관련 커스텀 에러 클래스들
 * 
 * 구체적인 에러 타입으로 더 나은 디버깅과 에러 처리를 제공합니다.
 */

export class AmazonIntegrationError extends Error {
  public readonly code: string
  public readonly context?: Record<string, any>
  public readonly retryable: boolean

  constructor(
    message: string,
    code: string = 'AMAZON_INTEGRATION_ERROR',
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.context = context
    this.retryable = retryable
    
    // Error 스택 추적 개선
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack
    }
  }
}

/**
 * Amazon SP-API 관련 에러
 */
export class AmazonAPIError extends AmazonIntegrationError {
  public readonly statusCode?: number
  public readonly amazonErrorCode?: string

  constructor(
    message: string,
    statusCode?: number,
    amazonErrorCode?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AMAZON_API_ERROR',
      { ...context, statusCode, amazonErrorCode },
      AmazonAPIError.isRetryableStatus(statusCode)
    )
    this.statusCode = statusCode
    this.amazonErrorCode = amazonErrorCode
  }

  static isRetryableStatus(statusCode?: number): boolean {
    if (!statusCode) return false
    
    // 재시도 가능한 HTTP 상태 코드들
    const retryableStatuses = [
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ]
    
    return retryableStatuses.includes(statusCode)
  }
}

/**
 * 인증 관련 에러
 */
export class AmazonAuthenticationError extends AmazonIntegrationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AMAZON_AUTH_ERROR', context, false)
  }
}

/**
 * 설정 관련 에러
 */
export class AmazonConfigurationError extends AmazonIntegrationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AMAZON_CONFIG_ERROR', context, false)
  }
}

/**
 * 상품 매핑 관련 에러
 */
export class AmazonMappingError extends AmazonIntegrationError {
  public readonly productId?: string
  public readonly sku?: string

  constructor(
    message: string,
    productId?: string,
    sku?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AMAZON_MAPPING_ERROR',
      { ...context, productId, sku },
      false
    )
    this.productId = productId
    this.sku = sku
  }
}

/**
 * 동기화 관련 에러
 */
export class AmazonSyncError extends AmazonIntegrationError {
  public readonly syncType: 'product' | 'inventory' | 'pricing' | 'order'
  public readonly marketplaceId?: string

  constructor(
    message: string,
    syncType: 'product' | 'inventory' | 'pricing' | 'order',
    marketplaceId?: string,
    context?: Record<string, any>,
    retryable: boolean = true
  ) {
    super(
      message,
      'AMAZON_SYNC_ERROR',
      { ...context, syncType, marketplaceId },
      retryable
    )
    this.syncType = syncType
    this.marketplaceId = marketplaceId
  }
}

/**
 * Feed 처리 관련 에러
 */
export class AmazonFeedError extends AmazonIntegrationError {
  public readonly feedId?: string
  public readonly feedType?: string

  constructor(
    message: string,
    feedId?: string,
    feedType?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AMAZON_FEED_ERROR',
      { ...context, feedId, feedType },
      true
    )
    this.feedId = feedId
    this.feedType = feedType
  }
}

/**
 * 마켓플레이스 관련 에러
 */
export class AmazonMarketplaceError extends AmazonIntegrationError {
  public readonly marketplaceId: string
  public readonly countryCode?: string

  constructor(
    message: string,
    marketplaceId: string,
    countryCode?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AMAZON_MARKETPLACE_ERROR',
      { ...context, marketplaceId, countryCode },
      false
    )
    this.marketplaceId = marketplaceId
    this.countryCode = countryCode
  }
}

/**
 * 재고 동기화 관련 에러
 */
export class AmazonInventoryError extends AmazonSyncError {
  public readonly sku: string
  public readonly requestedQuantity?: number

  constructor(
    message: string,
    sku: string,
    marketplaceId?: string,
    requestedQuantity?: number,
    context?: Record<string, any>
  ) {
    super(message, 'inventory', marketplaceId, {
      ...context,
      sku,
      requestedQuantity
    })
    this.sku = sku
    this.requestedQuantity = requestedQuantity
  }
}

/**
 * 가격 동기화 관련 에러
 */
export class AmazonPricingError extends AmazonSyncError {
  public readonly sku: string
  public readonly requestedPrice?: number
  public readonly currency?: string

  constructor(
    message: string,
    sku: string,
    marketplaceId?: string,
    requestedPrice?: number,
    currency?: string,
    context?: Record<string, any>
  ) {
    super(message, 'pricing', marketplaceId, {
      ...context,
      sku,
      requestedPrice,
      currency
    })
    this.sku = sku
    this.requestedPrice = requestedPrice
    this.currency = currency
  }
}

/**
 * 주문 동기화 관련 에러
 */
export class AmazonOrderError extends AmazonSyncError {
  public readonly amazonOrderId?: string
  public readonly medusaOrderId?: string

  constructor(
    message: string,
    amazonOrderId?: string,
    medusaOrderId?: string,
    marketplaceId?: string,
    context?: Record<string, any>
  ) {
    super(message, 'order', marketplaceId, {
      ...context,
      amazonOrderId,
      medusaOrderId
    })
    this.amazonOrderId = amazonOrderId
    this.medusaOrderId = medusaOrderId
  }
}

/**
 * 통화 변환 관련 에러
 */
export class AmazonCurrencyError extends AmazonIntegrationError {
  public readonly fromCurrency: string
  public readonly toCurrency: string
  public readonly amount?: number

  constructor(
    message: string,
    fromCurrency: string,
    toCurrency: string,
    amount?: number,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AMAZON_CURRENCY_ERROR',
      { ...context, fromCurrency, toCurrency, amount },
      true
    )
    this.fromCurrency = fromCurrency
    this.toCurrency = toCurrency
    this.amount = amount
  }
}

/**
 * 에러 헬퍼 함수들
 */
export class ErrorUtils {
  /**
   * 에러가 재시도 가능한지 확인
   */
  static isRetryableError(error: Error): boolean {
    if (error instanceof AmazonIntegrationError) {
      return error.retryable
    }
    
    // 네트워크 에러들은 일반적으로 재시도 가능
    if (error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true
    }
    
    return false
  }

  /**
   * 에러를 로깅용 객체로 변환
   */
  static toLogObject(error: Error): Record<string, any> {
    if (error instanceof AmazonIntegrationError) {
      return error.toJSON()
    }
    
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }

  /**
   * 에러 메시지를 사용자 친화적으로 변환
   */
  static toUserFriendlyMessage(error: Error): string {
    if (error instanceof AmazonAuthenticationError) {
      return 'Amazon 인증에 실패했습니다. 인증 정보를 확인해주세요.'
    }
    
    if (error instanceof AmazonConfigurationError) {
      return 'Amazon 설정에 문제가 있습니다. 설정을 확인해주세요.'
    }
    
    if (error instanceof AmazonAPIError) {
      if (error.statusCode === 429) {
        return 'Amazon API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
      }
      if (error.statusCode && error.statusCode >= 500) {
        return 'Amazon 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.'
      }
    }
    
    return '알 수 없는 오류가 발생했습니다. 관리자에게 문의해주세요.'
  }

  /**
   * 에러 스택에서 민감한 정보 제거
   */
  static sanitizeError(error: Error): Error {
    const sanitized = new Error(error.message)
    sanitized.name = error.name
    
    // 스택에서 민감한 정보 제거
    if (error.stack) {
      sanitized.stack = error.stack
        .replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]')
        .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[REDACTED]')
        .replace(/api_key=[^&\s]+/gi, 'api_key=[REDACTED]')
        .replace(/secret=[^&\s]+/gi, 'secret=[REDACTED]')
    }
    
    return sanitized
  }
} 