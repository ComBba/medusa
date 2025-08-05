/**
 * Amazon 통합 전용 로거
 * 구조화된 로깅과 메트릭 수집을 제공합니다.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export enum LogCategory {
  SYNC = "sync",
  API = "api", 
  WORKFLOW = "workflow",
  MARKETPLACE = "marketplace",
  PRODUCT = "product",
  AUTH = "auth",
  RATE_LIMIT = "rate_limit",
  ERROR = "error",
  PERFORMANCE = "performance"
}

export interface LogContext {
  product_id?: string
  marketplace_id?: string
  workflow_id?: string
  step_name?: string
  user_id?: string
  session_id?: string
  correlation_id?: string
  request_id?: string
  [key: string]: any
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  context?: LogContext
  metadata?: any
  duration_ms?: number
  error?: any
}

export interface SyncMetrics {
  sync_id: string
  product_id: string
  marketplace_id: string
  started_at: Date
  completed_at?: Date
  duration_ms?: number
  status: 'started' | 'completed' | 'failed' | 'timeout'
  steps_completed: number
  total_steps: number
  error?: any
  api_calls: number
  retries: number
}

class AmazonLogger {
  private currentLogLevel: LogLevel
  private metrics: Map<string, SyncMetrics> = new Map()

  constructor() {
    this.currentLogLevel = this.getLogLevelFromEnv()
  }

  private getLogLevelFromEnv(): LogLevel {
    const level = process.env.AMAZON_LOG_LEVEL?.toUpperCase()
    switch (level) {
      case 'ERROR': return LogLevel.ERROR
      case 'WARN': return LogLevel.WARN
      case 'INFO': return LogLevel.INFO
      case 'DEBUG': return LogLevel.DEBUG
      case 'TRACE': return LogLevel.TRACE
      default: return LogLevel.INFO
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp
    const level = LogLevel[entry.level].padEnd(5)
    const category = `[${entry.category}]`.padEnd(15)
    
    let message = `${timestamp} ${level} ${category} ${entry.message}`
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      message += ` | Context: ${JSON.stringify(entry.context)}`
    }
    
    if (entry.duration_ms) {
      message += ` | Duration: ${entry.duration_ms}ms`
    }
    
    if (entry.metadata) {
      message += ` | Metadata: ${JSON.stringify(entry.metadata)}`
    }
    
    if (entry.error) {
      message += `\n  Error: ${entry.error.message || entry.error}`
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`
      }
    }
    
    return message
  }

  private log(level: LogLevel, category: LogCategory, message: string, context?: LogContext, metadata?: any, error?: any) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      metadata,
      error
    }

    const formattedMessage = this.formatLogEntry(entry)
    
    // 콘솔 출력
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      default:
        console.log(formattedMessage)
        break
    }

    // TODO: 실제 환경에서는 여기에 외부 로깅 서비스 연동
    // 예: Winston, Elasticsearch, CloudWatch, etc.
  }

  // Public logging methods
  error(category: LogCategory, message: string, context?: LogContext, error?: any) {
    this.log(LogLevel.ERROR, category, message, context, undefined, error)
  }

  warn(category: LogCategory, message: string, context?: LogContext, metadata?: any) {
    this.log(LogLevel.WARN, category, message, context, metadata)
  }

  info(category: LogCategory, message: string, context?: LogContext, metadata?: any) {
    this.log(LogLevel.INFO, category, message, context, metadata)
  }

  debug(category: LogCategory, message: string, context?: LogContext, metadata?: any) {
    this.log(LogLevel.DEBUG, category, message, context, metadata)
  }

  trace(category: LogCategory, message: string, context?: LogContext, metadata?: any) {
    this.log(LogLevel.TRACE, category, message, context, metadata)
  }

  // 동기화 관련 특수 로깅 메서드들
  syncStarted(productId: string, marketplaceId: string, workflowId?: string): string {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const metrics: SyncMetrics = {
      sync_id: syncId,
      product_id: productId,
      marketplace_id: marketplaceId,
      started_at: new Date(),
      status: 'started',
      steps_completed: 0,
      total_steps: 0,
      api_calls: 0,
      retries: 0
    }
    
    this.metrics.set(syncId, metrics)
    
    this.info(LogCategory.SYNC, "동기화 시작", {
      product_id: productId,
      marketplace_id: marketplaceId,
      workflow_id: workflowId,
      sync_id: syncId
    })
    
    return syncId
  }

  syncStepCompleted(syncId: string, stepName: string, stepData?: any) {
    const metrics = this.metrics.get(syncId)
    if (metrics) {
      metrics.steps_completed += 1
    }
    
    this.info(LogCategory.SYNC, `동기화 단계 완료: ${stepName}`, {
      sync_id: syncId,
      step_name: stepName,
      steps_completed: metrics?.steps_completed
    }, stepData)
  }

  syncCompleted(syncId: string, result?: any) {
    const metrics = this.metrics.get(syncId)
    if (metrics) {
      metrics.completed_at = new Date()
      metrics.duration_ms = metrics.completed_at.getTime() - metrics.started_at.getTime()
      metrics.status = 'completed'
    }
    
    this.info(LogCategory.SYNC, "동기화 완료", {
      sync_id: syncId,
      product_id: metrics?.product_id,
      marketplace_id: metrics?.marketplace_id,
      duration_ms: metrics?.duration_ms,
      steps_completed: metrics?.steps_completed,
      api_calls: metrics?.api_calls,
      retries: metrics?.retries
    }, result)
    
    // 메트릭 정리 (메모리 관리)
    setTimeout(() => {
      this.metrics.delete(syncId)
    }, 60 * 60 * 1000) // 1시간 후 삭제
  }

  syncFailed(syncId: string, error: any) {
    const metrics = this.metrics.get(syncId)
    if (metrics) {
      metrics.completed_at = new Date()
      metrics.duration_ms = metrics.completed_at.getTime() - metrics.started_at.getTime()
      metrics.status = 'failed'
      metrics.error = error
    }
    
    this.error(LogCategory.SYNC, "동기화 실패", {
      sync_id: syncId,
      product_id: metrics?.product_id,
      marketplace_id: metrics?.marketplace_id,
      duration_ms: metrics?.duration_ms,
      steps_completed: metrics?.steps_completed,
      api_calls: metrics?.api_calls,
      retries: metrics?.retries
    }, error)
  }

  apiCall(endpoint: string, method: string, context?: LogContext, responseTime?: number) {
    // API 호출 메트릭 업데이트
    if (context?.sync_id) {
      const metrics = this.metrics.get(context.sync_id)
      if (metrics) {
        metrics.api_calls += 1
      }
    }
    
    this.debug(LogCategory.API, `API 호출: ${method} ${endpoint}`, context, {
      endpoint,
      method,
      response_time_ms: responseTime
    })
  }

  rateLimitHit(endpoint: string, retryAfter: number, context?: LogContext) {
    this.warn(LogCategory.RATE_LIMIT, `Rate limit 도달: ${endpoint}`, context, {
      endpoint,
      retry_after_seconds: retryAfter
    })
  }

  retryAttempt(syncId: string, attempt: number, maxAttempts: number, reason: string) {
    const metrics = this.metrics.get(syncId)
    if (metrics) {
      metrics.retries += 1
    }
    
    this.warn(LogCategory.SYNC, `재시도 시도 (${attempt}/${maxAttempts}): ${reason}`, {
      sync_id: syncId,
      retry_attempt: attempt,
      max_attempts: maxAttempts
    })
  }

  workflowStarted(workflowName: string, input: any, workflowId?: string) {
    this.info(LogCategory.WORKFLOW, `워크플로우 시작: ${workflowName}`, {
      workflow_id: workflowId,
      workflow_name: workflowName
    }, {
      input_summary: this.sanitizeInput(input)
    })
  }

  workflowCompleted(workflowName: string, result: any, workflowId?: string, startTime?: Date) {
    const duration = startTime ? Date.now() - startTime.getTime() : undefined
    
    this.info(LogCategory.WORKFLOW, `워크플로우 완료: ${workflowName}`, {
      workflow_id: workflowId,
      workflow_name: workflowName,
      duration_ms: duration
    }, {
      result_summary: this.sanitizeOutput(result)
    })
  }

  workflowFailed(workflowName: string, error: any, workflowId?: string, startTime?: Date) {
    const duration = startTime ? Date.now() - startTime.getTime() : undefined
    
    this.error(LogCategory.WORKFLOW, `워크플로우 실패: ${workflowName}`, {
      workflow_id: workflowId,
      workflow_name: workflowName,
      duration_ms: duration
    }, error)
  }

  marketplaceStatusChanged(marketplaceId: string, oldStatus: boolean, newStatus: boolean, userId?: string) {
    this.info(LogCategory.MARKETPLACE, `마켓플레이스 상태 변경: ${oldStatus ? '활성' : '비활성'} → ${newStatus ? '활성' : '비활성'}`, {
      marketplace_id: marketplaceId,
      user_id: userId
    }, {
      old_status: oldStatus,
      new_status: newStatus
    })
  }

  performanceMetric(operation: string, duration: number, context?: LogContext, metadata?: any) {
    this.info(LogCategory.PERFORMANCE, `성능 메트릭: ${operation}`, context, {
      operation,
      duration_ms: duration,
      ...metadata
    })
  }

  // 유틸리티 메서드들
  private sanitizeInput(input: any): any {
    if (!input) return input
    
    // 민감한 정보 마스킹
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth']
    const sanitized = { ...input }
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '***MASKED***'
      }
    })
    
    return sanitized
  }

  private sanitizeOutput(output: any): any {
    if (!output) return output
    
    // 큰 객체는 요약만 표시
    if (typeof output === 'object' && Object.keys(output).length > 10) {
      return {
        type: Array.isArray(output) ? 'array' : 'object',
        length: Array.isArray(output) ? output.length : Object.keys(output).length,
        keys: Array.isArray(output) ? undefined : Object.keys(output).slice(0, 5)
      }
    }
    
    return output
  }

  // 메트릭 조회
  getSyncMetrics(syncId: string): SyncMetrics | undefined {
    return this.metrics.get(syncId)
  }

  getAllActiveMetrics(): SyncMetrics[] {
    return Array.from(this.metrics.values())
  }

  // 성능 측정 헬퍼
  async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      
      this.performanceMetric(operation, duration, context, {
        success: true
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      this.performanceMetric(operation, duration, context, {
        success: false,
        error: error.message
      })
      
      throw error
    }
  }
}

// 싱글톤 인스턴스 export
export const amazonLogger = new AmazonLogger()
export default amazonLogger