import { Logger } from "@medusajs/framework/types"
import { ErrorUtils } from "./errors"

export interface RetryOptions {
  maxAttempts: number
  baseDelay: number // milliseconds
  maxDelay: number // milliseconds
  backoffMultiplier: number
  shouldRetry?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

export interface RetryResult<T> {
  result: T
  attempts: number
  totalDuration: number
  errors: Error[]
}

/**
 * 재시도 로직 유틸리티
 * 
 * 지수 백오프를 사용한 재시도 메커니즘을 제공합니다.
 * Amazon API 호출 등에서 일시적 오류 발생 시 자동 재시도를 처리합니다.
 */
export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000, // 1초
    maxDelay: 30000, // 30초
    backoffMultiplier: 2,
    shouldRetry: (error, attempt) => ErrorUtils.isRetryableError(error) && attempt < 3
  }

  /**
   * 함수를 재시도 로직과 함께 실행
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    logger?: Logger
  ): Promise<RetryResult<T>> {
    const config = { ...RetryManager.DEFAULT_OPTIONS, ...options }
    const errors: Error[] = []
    const startTime = Date.now()
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation()
        
        return {
          result,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
          errors
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        errors.push(err)
        
        logger?.debug(`재시도 ${attempt}/${config.maxAttempts} 실패 - Error: ${err.message}, ShouldRetry: ${config.shouldRetry?.(err, attempt) ?? false}`)

        // 마지막 시도이거나 재시도 조건을 만족하지 않으면 에러 throw
        if (attempt === config.maxAttempts || !config.shouldRetry?.(err, attempt)) {
          logger?.error(`재시도 최종 실패 - Attempts: ${attempt}, Duration: ${Date.now() - startTime}ms, Error: ${err.message}`)
          throw err
        }

        // 지수 백오프 계산
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        )

        // 재시도 콜백 호출
        config.onRetry?.(err, attempt, delay)
        
        logger?.warn(`${delay}ms 후 재시도 예정 - Attempt: ${attempt}, Error: ${err.message}`)

        // 지연 후 재시도
        await RetryManager.delay(delay)
      }
    }

    // 여기에 도달하면 안 되지만 타입 안전성을 위해
    throw new Error('Unexpected retry loop exit')
  }

  /**
   * 지연 함수
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Amazon API 전용 재시도 설정
   */
  static getAmazonAPIRetryOptions(): Partial<RetryOptions> {
    return {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 60000, // 1분
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) => {
        // Amazon API 특화 재시도 조건
        if (error.message.includes('Rate limit exceeded') || 
            error.message.includes('429')) {
          return attempt < 5 // Rate limit은 더 많이 재시도
        }
        
        if (error.message.includes('Service Unavailable') ||
            error.message.includes('Internal Server Error')) {
          return attempt < 3
        }
        
        return ErrorUtils.isRetryableError(error) && attempt < 3
      }
    }
  }

  /**
   * 배치 작업용 재시도 설정
   */
  static getBatchRetryOptions(): Partial<RetryOptions> {
    return {
      maxAttempts: 2, // 배치는 재시도 적게
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 2
    }
  }
}

/**
 * 서킷 브레이커 패턴 구현
 * 
 * 연속된 실패 시 서비스를 일시적으로 차단하여
 * 시스템 안정성을 보장합니다.
 */
export class CircuitBreaker {
  private failures: number = 0
  private lastFailTime: number = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly timeoutWindow: number = 60000, // 1분
    private readonly logger?: Logger
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime < this.timeoutWindow) {
        throw new Error('Circuit breaker is OPEN')
      } else {
        this.state = 'HALF_OPEN'
        this.logger?.info('Circuit breaker 상태 변경: HALF_OPEN')
      }
    }

    try {
      const result = await operation()
      
      if (this.state === 'HALF_OPEN') {
        this.reset()
      }
      
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure() {
    this.failures++
    this.lastFailTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
      this.logger?.error(`Circuit breaker OPEN됨 - Failures: ${this.failures}, Threshold: ${this.failureThreshold}`)
    }
  }

  private reset() {
    this.failures = 0
    this.state = 'CLOSED'
    this.logger?.info('Circuit breaker 리셋됨')
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime
    }
  }
}

/**
 * 요청 대기열 관리
 * 
 * API 호출 빈도를 제한하여 rate limit을 방지합니다.
 */
export class RateLimiter {
  private queue: Array<() => void> = []
  private running: number = 0

  constructor(
    private readonly maxConcurrent: number = 5,
    private readonly minInterval: number = 200, // 200ms
    private readonly logger?: Logger
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++
          this.logger?.debug(`요청 실행 시작 - Running: ${this.running}, Queued: ${this.queue.length}`)
          
          const result = await operation()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running--
          
          // 최소 간격 후 다음 요청 처리
          setTimeout(() => {
            this.processNext()
          }, this.minInterval)
        }
      })

      this.processNext()
    })
  }

  private processNext() {
    if (this.running < this.maxConcurrent && this.queue.length > 0) {
      const nextOperation = this.queue.shift()
      if (nextOperation) {
        nextOperation()
      }
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    }
  }
}

/**
 * 통합 API 클라이언트 헬퍼
 * 
 * 재시도, 서킷 브레이커, 레이트 리미터를 통합한 API 호출 래퍼
 */
export class RobustAPIClient {
  private circuitBreaker: CircuitBreaker
  private rateLimiter: RateLimiter

  constructor(
    private readonly logger: Logger,
    options: {
      failureThreshold?: number
      timeoutWindow?: number
      maxConcurrent?: number
      minInterval?: number
    } = {}
  ) {
    this.circuitBreaker = new CircuitBreaker(
      options.failureThreshold,
      options.timeoutWindow,
      logger
    )
    this.rateLimiter = new RateLimiter(
      options.maxConcurrent,
      options.minInterval,
      logger
    )
  }

  /**
   * 안정성이 보장된 API 호출
   */
  async call<T>(
    operation: () => Promise<T>,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    return this.rateLimiter.execute(async () => {
      return this.circuitBreaker.execute(async () => {
        const result = await RetryManager.withRetry(
          operation,
          retryOptions,
          this.logger
        )
        return result.result
      })
    })
  }

  /**
   * 현재 상태 조회
   */
  getStatus() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      rateLimiter: this.rateLimiter.getStatus()
    }
  }
} 