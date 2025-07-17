import { AmazonConfigurationError } from "./errors"

export interface AmazonConfiguration {
  // SP-API 인증
  client_id?: string
  client_secret?: string
  refresh_token?: string
  access_key_id?: string
  secret_access_key?: string
  
  // 마켓플레이스 설정
  default_marketplace_id?: string
  supported_marketplaces?: string[]
  
  // 동기화 설정
  auto_sync_enabled?: boolean
  batch_size?: number
  retry_attempts?: number
  
  // API 설정
  sandbox_mode?: boolean
  api_timeout?: number
  
  // K-Beauty 특화 설정
  enable_kbeauty_optimizations?: boolean
  japan_premium_percentage?: number
  us_competitive_discount?: number
  
  // 기타 설정
  currency_conversion_api?: string
  webhook_secret?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

/**
 * Amazon 통합 설정 검증 유틸리티
 * 
 * 설정의 유효성, 보안성, 최적화를 검증합니다.
 */
export class ConfigValidator {
  private static readonly REQUIRED_FIELDS = [
    'client_id',
    'client_secret', 
    'refresh_token'
  ]

  private static readonly MARKETPLACE_IDS = {
    US: 'ATVPDKIKX0DER',
    CA: 'A2EUQ1WTGCTBG2',
    MX: 'A1AM78C64UM0Y8',
    BR: 'A2Q3Y263D00KWC',
    DE: 'A1PA6795UKMFR9',
    ES: 'A1RKKUPIHCS9HS',
    FR: 'A13V1IB3VIYZZH',
    IT: 'APJ6JRA9NG5V4',
    UK: 'A1F83G8C2ARO7P',
    IN: 'A21TJRUUN4KGV',
    JP: 'A1VC38T7YXB528',
    AU: 'A39IBJ37TRP1C6',
    SG: 'A19VAU5U5O7RUS'
  }

  /**
   * 전체 설정 검증
   */
  static validate(config: AmazonConfiguration): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    // 필수 설정 검증
    this.validateRequiredFields(config, result)
    
    // 인증 정보 검증
    this.validateCredentials(config, result)
    
    // 마켓플레이스 설정 검증
    this.validateMarketplaces(config, result)
    
    // 동기화 설정 검증
    this.validateSyncSettings(config, result)
    
    // K-Beauty 설정 검증
    this.validateKBeautySettings(config, result)
    
    // 보안 검증
    this.validateSecurity(config, result)
    
    // 성능 최적화 검증
    this.validatePerformance(config, result)

    result.isValid = result.errors.length === 0

    return result
  }

  /**
   * 필수 필드 검증
   */
  private static validateRequiredFields(
    config: AmazonConfiguration, 
    result: ValidationResult
  ) {
    for (const field of this.REQUIRED_FIELDS) {
      if (!config[field as keyof AmazonConfiguration]) {
        result.errors.push(`필수 설정이 누락되었습니다: ${field}`)
      }
    }
  }

  /**
   * 인증 정보 검증
   */
  private static validateCredentials(
    config: AmazonConfiguration,
    result: ValidationResult
  ) {
    // Client ID 형식 검증
    if (config.client_id && !config.client_id.match(/^amzn1\.application-oa2-client\./)) {
      result.errors.push('Client ID 형식이 올바르지 않습니다')
    }

    // Refresh Token 형식 검증
    if (config.refresh_token && config.refresh_token.length < 50) {
      result.warnings.push('Refresh Token이 너무 짧습니다. 올바른 토큰인지 확인해주세요')
    }

    // AWS 자격증명 검증
    if (config.access_key_id && !config.secret_access_key) {
      result.errors.push('AWS Access Key ID가 있으면 Secret Access Key도 필요합니다')
    }

    if (config.secret_access_key && !config.access_key_id) {
      result.errors.push('AWS Secret Access Key가 있으면 Access Key ID도 필요합니다')
    }
  }

  /**
   * 마켓플레이스 설정 검증
   */
  private static validateMarketplaces(
    config: AmazonConfiguration,
    result: ValidationResult
  ) {
    // 기본 마켓플레이스 검증
    if (config.default_marketplace_id) {
      const isValid = Object.values(this.MARKETPLACE_IDS).includes(config.default_marketplace_id)
      if (!isValid) {
        result.errors.push(`지원되지 않는 기본 마켓플레이스 ID: ${config.default_marketplace_id}`)
      }
    }

    // 지원 마켓플레이스 검증
    if (config.supported_marketplaces) {
      const validIds = Object.values(this.MARKETPLACE_IDS)
      const invalidIds = config.supported_marketplaces.filter(id => !validIds.includes(id))
      
      if (invalidIds.length > 0) {
        result.errors.push(`지원되지 않는 마켓플레이스 ID들: ${invalidIds.join(', ')}`)
      }

      // K-Beauty 최적화 제안
      const hasJapan = config.supported_marketplaces.includes(this.MARKETPLACE_IDS.JP)
      const hasUS = config.supported_marketplaces.includes(this.MARKETPLACE_IDS.US)
      
      if (!hasJapan || !hasUS) {
        result.suggestions.push('K-Beauty 제품의 경우 일본(JP)과 미국(US) 마켓플레이스 추가를 권장합니다')
      }
    }
  }

  /**
   * 동기화 설정 검증
   */
  private static validateSyncSettings(
    config: AmazonConfiguration,
    result: ValidationResult
  ) {
    // 배치 크기 검증
    if (config.batch_size) {
      if (config.batch_size < 1 || config.batch_size > 100) {
        result.errors.push('배치 크기는 1-100 사이여야 합니다')
      } else if (config.batch_size > 50) {
        result.warnings.push('큰 배치 크기는 API 한도 초과를 유발할 수 있습니다')
      }
    }

    // 재시도 횟수 검증
    if (config.retry_attempts) {
      if (config.retry_attempts < 0 || config.retry_attempts > 10) {
        result.errors.push('재시도 횟수는 0-10 사이여야 합니다')
      } else if (config.retry_attempts > 5) {
        result.warnings.push('과도한 재시도는 API 한도를 소모할 수 있습니다')
      }
    }

    // API 타임아웃 검증
    if (config.api_timeout) {
      if (config.api_timeout < 5000 || config.api_timeout > 300000) {
        result.errors.push('API 타임아웃은 5초-5분 사이여야 합니다')
      }
    }
  }

  /**
   * K-Beauty 특화 설정 검증
   */
  private static validateKBeautySettings(
    config: AmazonConfiguration,
    result: ValidationResult
  ) {
    // 일본 프리미엄 비율 검증
    if (config.japan_premium_percentage) {
      if (config.japan_premium_percentage < 0 || config.japan_premium_percentage > 100) {
        result.errors.push('일본 프리미엄 비율은 0-100% 사이여야 합니다')
      } else if (config.japan_premium_percentage > 50) {
        result.warnings.push('높은 프리미엄 비율은 경쟁력을 떨어뜨릴 수 있습니다')
      }
    }

    // 미국 할인율 검증
    if (config.us_competitive_discount) {
      if (config.us_competitive_discount < 0 || config.us_competitive_discount > 50) {
        result.errors.push('미국 경쟁 할인율은 0-50% 사이여야 합니다')
      }
    }
  }

  /**
   * 보안 검증
   */
  private static validateSecurity(
    config: AmazonConfiguration,
    result: ValidationResult
  ) {
    // 프로덕션 환경에서 샌드박스 모드 경고
    if (process.env.NODE_ENV === 'production' && config.sandbox_mode) {
      result.warnings.push('프로덕션 환경에서 샌드박스 모드가 활성화되어 있습니다')
    }

    // 개발 환경에서 실제 자격증명 경고
    if (process.env.NODE_ENV !== 'production' && !config.sandbox_mode) {
      result.warnings.push('개발 환경에서 실제 자격증명을 사용하고 있습니다')
    }

    // 웹훅 시크릿 검증
    if (config.webhook_secret && config.webhook_secret.length < 32) {
      result.warnings.push('웹훅 시크릿이 너무 짧습니다. 32자 이상을 권장합니다')
    }
  }

  /**
   * 성능 최적화 검증
   */
  private static validatePerformance(
    config: AmazonConfiguration,
    result: ValidationResult
  ) {
    // 통화 변환 API 설정 확인
    if (!config.currency_conversion_api) {
      result.suggestions.push('통화 변환 API를 설정하면 실시간 환율로 더 정확한 가격 동기화가 가능합니다')
    }

    // 자동 동기화 비활성화 시 경고
    if (config.auto_sync_enabled === false) {
      result.warnings.push('자동 동기화가 비활성화되어 있습니다. 수동으로 동기화를 관리해야 합니다')
    }
  }

  /**
   * 환경별 설정 검증
   */
  static validateForEnvironment(
    config: AmazonConfiguration,
    environment: 'development' | 'staging' | 'production'
  ): ValidationResult {
    const result = this.validate(config)

    switch (environment) {
      case 'development':
        if (!config.sandbox_mode) {
          result.warnings.push('개발 환경에서는 샌드박스 모드 사용을 권장합니다')
        }
        break

      case 'staging':
        if (config.sandbox_mode) {
          result.suggestions.push('스테이징 환경에서는 실제 API로 테스트하는 것을 고려해보세요')
        }
        break

      case 'production':
        if (config.sandbox_mode) {
          result.errors.push('프로덕션 환경에서는 샌드박스 모드를 사용할 수 없습니다')
        }
        if (!config.auto_sync_enabled) {
          result.warnings.push('프로덕션에서 자동 동기화가 비활성화되어 있습니다')
        }
        break
    }

    return result
  }

  /**
   * 설정 검증 실패 시 예외 발생
   */
  static validateOrThrow(config: AmazonConfiguration): void {
    const result = this.validate(config)
    
    if (!result.isValid) {
      throw new AmazonConfigurationError(
        `Amazon 설정 검증 실패: ${result.errors.join(', ')}`,
        { 
          errors: result.errors,
          warnings: result.warnings,
          suggestions: result.suggestions
        }
      )
    }
  }

  /**
   * 지원 마켓플레이스 목록 반환
   */
  static getSupportedMarketplaces(): Record<string, string> {
    return { ...this.MARKETPLACE_IDS }
  }

  /**
   * K-Beauty 최적화 마켓플레이스 추천
   */
  static getRecommendedKBeautyMarketplaces(): string[] {
    return [
      this.MARKETPLACE_IDS.JP, // 일본 - K-Beauty 주요 시장
      this.MARKETPLACE_IDS.US, // 미국 - 대형 시장
      this.MARKETPLACE_IDS.CA, // 캐나다 - 북미 확장
      this.MARKETPLACE_IDS.AU, // 호주 - 아시아태평양
      this.MARKETPLACE_IDS.UK, // 영국 - 유럽 진입점
      this.MARKETPLACE_IDS.DE, // 독일 - 유럽 최대 시장
    ]
  }
} 