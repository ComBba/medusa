/**
 * Amazon 통합 전용 에러 핸들러
 * 다양한 에러 타입을 처리하고 적절한 응답을 생성합니다.
 */

export enum AmazonErrorType {
  // SP-API 관련 에러
  SP_API_AUTH_ERROR = "SP_API_AUTH_ERROR",
  SP_API_RATE_LIMIT = "SP_API_RATE_LIMIT", 
  SP_API_INVALID_REQUEST = "SP_API_INVALID_REQUEST",
  SP_API_SERVER_ERROR = "SP_API_SERVER_ERROR",
  
  // 상품 매핑 에러
  PRODUCT_MAPPING_ERROR = "PRODUCT_MAPPING_ERROR",
  INVALID_PRODUCT_DATA = "INVALID_PRODUCT_DATA",
  MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS",
  
  // 마켓플레이스 에러
  MARKETPLACE_NOT_ACTIVE = "MARKETPLACE_NOT_ACTIVE",
  MARKETPLACE_NOT_FOUND = "MARKETPLACE_NOT_FOUND",
  MARKETPLACE_CONFIG_ERROR = "MARKETPLACE_CONFIG_ERROR",
  
  // 동기화 에러
  SYNC_RECORD_ERROR = "SYNC_RECORD_ERROR",
  CONCURRENT_SYNC_ERROR = "CONCURRENT_SYNC_ERROR",
  SYNC_TIMEOUT_ERROR = "SYNC_TIMEOUT_ERROR",
  
  // 일반 에러
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export interface AmazonError {
  type: AmazonErrorType
  message: string
  details?: any
  retryable?: boolean
  retry_after?: number
  context?: {
    product_id?: string
    marketplace_id?: string
    workflow_step?: string
    api_endpoint?: string
  }
}

export class AmazonIntegrationError extends Error {
  public readonly type: AmazonErrorType
  public readonly retryable: boolean
  public readonly retry_after?: number
  public readonly context?: any
  public readonly details?: any

  constructor(error: AmazonError) {
    super(error.message)
    this.name = "AmazonIntegrationError"
    this.type = error.type
    this.retryable = error.retryable || false
    this.retry_after = error.retry_after
    this.context = error.context
    this.details = error.details
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      retryable: this.retryable,
      retry_after: this.retry_after,
      context: this.context,
      details: this.details,
      stack: this.stack
    }
  }
}

/**
 * SP-API 응답에서 에러 정보 추출
 */
export function parseSpApiError(error: any): AmazonError {
  // Rate Limit 에러 처리
  if (error.status === 429 || error.code === 'QuotaExceeded') {
    return {
      type: AmazonErrorType.SP_API_RATE_LIMIT,
      message: "Amazon SP-API 호출 제한에 도달했습니다.",
      retryable: true,
      retry_after: error.headers?.['x-amzn-ratelimit-limit'] || 60,
      details: {
        quota_type: error.details?.quotaType,
        reset_time: error.headers?.['x-amzn-ratelimit-reset']
      }
    }
  }

  // 인증 에러 처리
  if (error.status === 401 || error.status === 403) {
    return {
      type: AmazonErrorType.SP_API_AUTH_ERROR,
      message: "Amazon SP-API 인증에 실패했습니다.",
      retryable: false,
      details: {
        error_code: error.code,
        error_description: error.message
      }
    }
  }

  // 잘못된 요청 에러 처리
  if (error.status >= 400 && error.status < 500) {
    return {
      type: AmazonErrorType.SP_API_INVALID_REQUEST,
      message: `Amazon SP-API 요청이 올바르지 않습니다: ${error.message}`,
      retryable: false,
      details: {
        status_code: error.status,
        error_code: error.code,
        validation_errors: error.details?.errors
      }
    }
  }

  // 서버 에러 처리
  if (error.status >= 500) {
    return {
      type: AmazonErrorType.SP_API_SERVER_ERROR,
      message: "Amazon SP-API 서버 오류가 발생했습니다.",
      retryable: true,
      retry_after: 30,
      details: {
        status_code: error.status,
        error_code: error.code
      }
    }
  }

  // 네트워크 에러 처리
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'TIMEOUT') {
    return {
      type: AmazonErrorType.NETWORK_ERROR,
      message: "네트워크 연결 오류가 발생했습니다.",
      retryable: true,
      retry_after: 10,
      details: {
        network_error_code: error.code
      }
    }
  }

  // 알 수 없는 에러
  return {
    type: AmazonErrorType.UNKNOWN_ERROR,
    message: `알 수 없는 SP-API 오류: ${error.message}`,
    retryable: false,
    details: error
  }
}

/**
 * 상품 매핑 에러 생성
 */
export function createProductMappingError(
  message: string, 
  productId: string, 
  details?: any
): AmazonIntegrationError {
  return new AmazonIntegrationError({
    type: AmazonErrorType.PRODUCT_MAPPING_ERROR,
    message: `상품 매핑 오류 (${productId}): ${message}`,
    retryable: false,
    context: {
      product_id: productId
    },
    details
  })
}

/**
 * 마켓플레이스 관련 에러 생성
 */
export function createMarketplaceError(
  type: AmazonErrorType.MARKETPLACE_NOT_ACTIVE | AmazonErrorType.MARKETPLACE_NOT_FOUND | AmazonErrorType.MARKETPLACE_CONFIG_ERROR,
  message: string,
  marketplaceId: string,
  details?: any
): AmazonIntegrationError {
  return new AmazonIntegrationError({
    type,
    message: `마켓플레이스 오류 (${marketplaceId}): ${message}`,
    retryable: type === AmazonErrorType.MARKETPLACE_CONFIG_ERROR,
    context: {
      marketplace_id: marketplaceId
    },
    details
  })
}

/**
 * 동기화 관련 에러 생성
 */
export function createSyncError(
  type: AmazonErrorType.SYNC_RECORD_ERROR | AmazonErrorType.CONCURRENT_SYNC_ERROR | AmazonErrorType.SYNC_TIMEOUT_ERROR,
  message: string,
  context: {
    product_id?: string
    marketplace_id?: string
    workflow_step?: string
  },
  details?: any
): AmazonIntegrationError {
  return new AmazonIntegrationError({
    type,
    message: `동기화 오류: ${message}`,
    retryable: type !== AmazonErrorType.CONCURRENT_SYNC_ERROR,
    context,
    details
  })
}

/**
 * 에러 심각도 결정
 */
export function getErrorSeverity(error: AmazonIntegrationError): 'low' | 'medium' | 'high' | 'critical' {
  switch (error.type) {
    case AmazonErrorType.SP_API_AUTH_ERROR:
    case AmazonErrorType.MARKETPLACE_CONFIG_ERROR:
      return 'critical'
    
    case AmazonErrorType.SP_API_SERVER_ERROR:
    case AmazonErrorType.SYNC_TIMEOUT_ERROR:
      return 'high'
    
    case AmazonErrorType.SP_API_RATE_LIMIT:
    case AmazonErrorType.NETWORK_ERROR:
    case AmazonErrorType.CONCURRENT_SYNC_ERROR:
      return 'medium'
    
    case AmazonErrorType.PRODUCT_MAPPING_ERROR:
    case AmazonErrorType.INVALID_PRODUCT_DATA:
    case AmazonErrorType.SP_API_INVALID_REQUEST:
      return 'low'
    
    default:
      return 'medium'
  }
}

/**
 * 에러 재시도 전략 결정
 */
export function getRetryStrategy(error: AmazonIntegrationError): {
  shouldRetry: boolean
  delay: number
  maxAttempts: number
} {
  if (!error.retryable) {
    return { shouldRetry: false, delay: 0, maxAttempts: 0 }
  }

  switch (error.type) {
    case AmazonErrorType.SP_API_RATE_LIMIT:
      return {
        shouldRetry: true,
        delay: (error.retry_after || 60) * 1000,
        maxAttempts: 3
      }
    
    case AmazonErrorType.SP_API_SERVER_ERROR:
      return {
        shouldRetry: true,
        delay: 30 * 1000, // 30초
        maxAttempts: 5
      }
    
    case AmazonErrorType.NETWORK_ERROR:
      return {
        shouldRetry: true,
        delay: 10 * 1000, // 10초
        maxAttempts: 3
      }
    
    case AmazonErrorType.SYNC_TIMEOUT_ERROR:
      return {
        shouldRetry: true,
        delay: 60 * 1000, // 1분
        maxAttempts: 2
      }
    
    default:
      return {
        shouldRetry: true,
        delay: 5 * 1000, // 5초
        maxAttempts: 2
      }
  }
}

/**
 * 사용자 친화적 에러 메시지 생성
 */
export function getUserFriendlyErrorMessage(error: AmazonIntegrationError): string {
  switch (error.type) {
    case AmazonErrorType.SP_API_AUTH_ERROR:
      return "Amazon 계정 인증에 문제가 있습니다. 설정을 확인해주세요."
    
    case AmazonErrorType.SP_API_RATE_LIMIT:
      return "Amazon API 호출 제한에 도달했습니다. 잠시 후 다시 시도해주세요."
    
    case AmazonErrorType.MARKETPLACE_NOT_ACTIVE:
      return "마켓플레이스가 비활성화되어 있습니다. 마켓플레이스를 활성화한 후 다시 시도해주세요."
    
    case AmazonErrorType.PRODUCT_MAPPING_ERROR:
      return "상품 정보를 Amazon 형식으로 변환하는 중 오류가 발생했습니다."
    
    case AmazonErrorType.INVALID_PRODUCT_DATA:
      return "상품 데이터가 Amazon 요구사항에 맞지 않습니다."
    
    case AmazonErrorType.MISSING_REQUIRED_FIELDS:
      return "필수 상품 정보가 누락되었습니다."
    
    case AmazonErrorType.NETWORK_ERROR:
      return "네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요."
    
    default:
      return "동기화 중 오류가 발생했습니다. 관리자에게 문의해주세요."
  }
}