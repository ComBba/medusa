import { MedusaService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import crypto from "crypto"

export interface SecurityConfig {
  encryption: {
    algorithm: string
    key_rotation_days: number
    secure_storage: boolean
  }
  rate_limiting: {
    global_requests_per_minute: number
    per_marketplace_requests_per_minute: number
    burst_allowance: number
    cooldown_seconds: number
  }
  token_management: {
    refresh_before_expiry_minutes: number
    max_retry_attempts: number
    backup_tokens: boolean
    encryption_at_rest: boolean
  }
  audit_logging: {
    enabled: boolean
    sensitive_data_masking: boolean
    retention_days: number
    log_level: 'minimal' | 'standard' | 'detailed'
  }
  compliance: {
    gdpr_enabled: boolean
    data_retention_days: number
    data_anonymization: boolean
    audit_trail_required: boolean
  }
}

export interface RateLimitRule {
  id: string
  name: string
  scope: 'global' | 'marketplace' | 'operation' | 'user'
  target: string
  limit: number
  window_seconds: number
  burst_allowance?: number
  enabled: boolean
  priority: number
}

export interface TokenInfo {
  access_token: string
  refresh_token?: string
  expires_at: Date
  scope: string[]
  marketplace_id: string
  encrypted: boolean
  last_refreshed: Date
  usage_count: number
}

export interface SecurityEvent {
  id: string
  type: 'rate_limit_exceeded' | 'token_expired' | 'auth_failure' | 'suspicious_activity' | 'data_access'
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  source: string
  details: any
  resolved: boolean
  resolution_notes?: string
}

export interface AuditLog {
  id: string
  timestamp: Date
  user_id?: string
  action: string
  resource_type: string
  resource_id: string
  marketplace_id?: string
  ip_address?: string
  user_agent?: string
  request_data?: any
  response_data?: any
  status: 'success' | 'failure' | 'error'
  error_message?: string
  processing_time_ms: number
}

/**
 * Amazon 통합 보안 및 컴플라이언스 서비스
 * 
 * 기능:
 * - API 토큰 보안 관리
 * - Rate Limiting 및 요청 제한
 * - 암호화 및 데이터 보호
 * - 감사 로깅 및 컴플라이언스
 * - 위협 탐지 및 대응
 * - GDPR 준수 지원
 */
export class AmazonSecurityService extends MedusaService({}) {
  private readonly config: SecurityConfig
  private rateLimitCounters: Map<string, { count: number; resetTime: number; burst: number }> = new Map()
  private tokenStore: Map<string, TokenInfo> = new Map()
  private securityEvents: SecurityEvent[] = []
  private auditLogs: AuditLog[] = []
  private encryptionKey: Buffer
  private logger: Logger

  constructor(dependencies: any, config?: Partial<SecurityConfig>) {
    super(dependencies)
    this.logger = dependencies.logger
    this.config = this.mergeWithDefaults(config || {})
    this.encryptionKey = this.generateOrLoadEncryptionKey()
    this.initializeRateLimitRules()
    this.startSecurityMonitoring()
  }

  /**
   * API 요청 Rate Limiting 검사
   */
  async checkRateLimit(
    scope: string, 
    identifier: string, 
    operation?: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `${scope}:${identifier}:${operation || 'default'}`
    const rule = this.getRateLimitRule(scope, operation)
    
    if (!rule) {
      return { allowed: true, remaining: -1, resetTime: 0 }
    }

    const now = Date.now()
    const counter = this.rateLimitCounters.get(key) || { 
      count: 0, 
      resetTime: now + (rule.window_seconds * 1000),
      burst: rule.burst_allowance || 0
    }

    // 윈도우 리셋 확인
    if (now >= counter.resetTime) {
      counter.count = 0
      counter.resetTime = now + (rule.window_seconds * 1000)
      counter.burst = rule.burst_allowance || 0
    }

    // Rate Limit 확인
    if (counter.count >= rule.limit) {
      // Burst 허용량 확인
      if (counter.burst > 0) {
        counter.burst--
        this.rateLimitCounters.set(key, counter)
        return { 
          allowed: true, 
          remaining: rule.limit - counter.count + counter.burst,
          resetTime: counter.resetTime 
        }
      }

      // Rate Limit 초과
      await this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        source: identifier,
        details: { scope, operation, limit: rule.limit, window: rule.window_seconds }
      })

      return { 
        allowed: false, 
        remaining: 0,
        resetTime: counter.resetTime 
      }
    }

    // 카운터 증가
    counter.count++
    this.rateLimitCounters.set(key, counter)

    return { 
      allowed: true, 
      remaining: rule.limit - counter.count,
      resetTime: counter.resetTime 
    }
  }

  /**
   * API 토큰 보안 저장
   */
  async storeToken(
    marketplaceId: string, 
    tokenData: {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope?: string[]
    }
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))
    
    const tokenInfo: TokenInfo = {
      access_token: await this.encryptSensitiveData(tokenData.access_token),
      refresh_token: tokenData.refresh_token ? await this.encryptSensitiveData(tokenData.refresh_token) : undefined,
      expires_at: expiresAt,
      scope: tokenData.scope || [],
      marketplace_id: marketplaceId,
      encrypted: true,
      last_refreshed: new Date(),
      usage_count: 0
    }

    this.tokenStore.set(marketplaceId, tokenInfo)

    await this.logAudit({
      action: 'token_stored',
      resource_type: 'api_token',
      resource_id: marketplaceId,
      marketplace_id: marketplaceId,
      status: 'success'
    })

    this.logger.info(`🔐 [SECURITY] API 토큰 보안 저장 완료: ${marketplaceId}`)
  }

  /**
   * API 토큰 검색 및 자동 갱신
   */
  async getValidToken(marketplaceId: string): Promise<string | null> {
    const tokenInfo = this.tokenStore.get(marketplaceId)
    if (!tokenInfo) {
      return null
    }

    // 만료 시간 확인
    const now = new Date()
    const refreshThreshold = new Date(
      tokenInfo.expires_at.getTime() - (this.config.token_management.refresh_before_expiry_minutes * 60 * 1000)
    )

    if (now >= refreshThreshold) {
      // 토큰 갱신 시도
      const refreshed = await this.refreshToken(marketplaceId)
      if (!refreshed) {
        await this.logSecurityEvent({
          type: 'token_expired',
          severity: 'high',
          source: marketplaceId,
          details: { expires_at: tokenInfo.expires_at }
        })
        return null
      }
    }

    // 사용 횟수 증가
    tokenInfo.usage_count++
    this.tokenStore.set(marketplaceId, tokenInfo)

    // 복호화하여 반환
    return await this.decryptSensitiveData(tokenInfo.access_token)
  }

  /**
   * 민감한 데이터 암호화
   */
  async encryptSensitiveData(data: string): Promise<string> {
    if (!this.config.token_management.encryption_at_rest) {
      return data
    }

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.config.encryption.algorithm, this.encryptionKey, iv)
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return iv.toString('hex') + ':' + encrypted
  }

  /**
   * 민감한 데이터 복호화
   */
  async decryptSensitiveData(encryptedData: string): Promise<string> {
    if (!this.config.token_management.encryption_at_rest) {
      return encryptedData
    }

    const parts = encryptedData.split(':')
    if (parts.length !== 2) {
      throw new Error('잘못된 암호화 데이터 형식')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = crypto.createDecipheriv(this.config.encryption.algorithm, this.encryptionKey, iv)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  /**
   * 감사 로그 기록
   */
  async logAudit(logData: Partial<AuditLog>): Promise<void> {
    if (!this.config.audit_logging.enabled) {
      return
    }

    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action: logData.action || 'unknown',
      resource_type: logData.resource_type || 'unknown',
      resource_id: logData.resource_id || 'unknown',
      marketplace_id: logData.marketplace_id,
      ip_address: logData.ip_address,
      user_agent: logData.user_agent,
      request_data: this.config.audit_logging.sensitive_data_masking 
        ? this.maskSensitiveData(logData.request_data) 
        : logData.request_data,
      response_data: this.config.audit_logging.sensitive_data_masking 
        ? this.maskSensitiveData(logData.response_data) 
        : logData.response_data,
      status: logData.status || 'success',
      error_message: logData.error_message,
      processing_time_ms: logData.processing_time_ms || 0,
      user_id: logData.user_id
    }

    this.auditLogs.push(auditLog)

    // 로그 보존 기간 확인
    this.cleanupOldAuditLogs()
  }

  /**
   * 보안 이벤트 기록
   */
  async logSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const event: SecurityEvent = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...eventData
    }

    this.securityEvents.push(event)

    // 심각도별 대응
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.handleCriticalSecurityEvent(event)
    }

    this.logger.warn(`🚨 [SECURITY] 보안 이벤트: ${event.type} (심각도: ${event.severity})`)
  }

  /**
   * 데이터 익명화 (GDPR 준수)
   */
  async anonymizeUserData(userId: string): Promise<void> {
    if (!this.config.compliance.gdpr_enabled) {
      return
    }

    // 감사 로그에서 사용자 식별 정보 제거
    this.auditLogs.forEach(log => {
      if (log.user_id === userId) {
        log.user_id = 'anonymized'
        log.ip_address = this.anonymizeIpAddress(log.ip_address)
        log.request_data = this.anonymizeRequestData(log.request_data)
      }
    })

    await this.logAudit({
      action: 'data_anonymized',
      resource_type: 'user_data',
      resource_id: userId,
      status: 'success'
    })

    this.logger.info(`🔒 [SECURITY] 사용자 데이터 익명화 완료: ${userId}`)
  }

  /**
   * 데이터 보존 정책 적용
   */
  async applyDataRetentionPolicy(): Promise<void> {
    const retentionPeriod = this.config.compliance.data_retention_days
    const cutoffDate = new Date(Date.now() - (retentionPeriod * 24 * 60 * 60 * 1000))

    // 오래된 감사 로그 삭제
    const initialLogCount = this.auditLogs.length
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoffDate)

    // 오래된 보안 이벤트 삭제
    const initialEventCount = this.securityEvents.length
    this.securityEvents = this.securityEvents.filter(event => event.timestamp > cutoffDate)

    this.logger.info(`🗑️ [SECURITY] 데이터 보존 정책 적용 - 로그: ${initialLogCount - this.auditLogs.length}개 삭제, 이벤트: ${initialEventCount - this.securityEvents.length}개 삭제`)
  }

  /**
   * 보안 상태 보고서 생성
   */
  async generateSecurityReport(): Promise<{
    rate_limit_violations: number
    token_expirations: number
    critical_events: number
    audit_log_count: number
    compliance_status: 'compliant' | 'warning' | 'violation'
    recommendations: string[]
  }> {
    const last24Hours = new Date(Date.now() - (24 * 60 * 60 * 1000))

    const rateLimitViolations = this.securityEvents.filter(
      e => e.type === 'rate_limit_exceeded' && e.timestamp > last24Hours
    ).length

    const tokenExpirations = this.securityEvents.filter(
      e => e.type === 'token_expired' && e.timestamp > last24Hours
    ).length

    const criticalEvents = this.securityEvents.filter(
      e => e.severity === 'critical' && e.timestamp > last24Hours
    ).length

    const recommendations: string[] = []
    if (rateLimitViolations > 10) {
      recommendations.push('Rate Limit 규칙 재검토 필요')
    }
    if (tokenExpirations > 5) {
      recommendations.push('토큰 갱신 주기 단축 권장')
    }
    if (criticalEvents > 0) {
      recommendations.push('긴급 보안 검토 필요')
    }

    const complianceStatus = criticalEvents > 0 ? 'violation' : 
                           (rateLimitViolations > 20 || tokenExpirations > 10) ? 'warning' : 'compliant'

    return {
      rate_limit_violations: rateLimitViolations,
      token_expirations: tokenExpirations,
      critical_events: criticalEvents,
      audit_log_count: this.auditLogs.filter(l => l.timestamp > last24Hours).length,
      compliance_status: complianceStatus,
      recommendations
    }
  }

  // Private methods

  private mergeWithDefaults(config: Partial<SecurityConfig>): SecurityConfig {
    return {
      encryption: {
        algorithm: 'aes-256-cbc',
        key_rotation_days: 90,
        secure_storage: true,
        ...config.encryption
      },
      rate_limiting: {
        global_requests_per_minute: 100,
        per_marketplace_requests_per_minute: 50,
        burst_allowance: 10,
        cooldown_seconds: 60,
        ...config.rate_limiting
      },
      token_management: {
        refresh_before_expiry_minutes: 30,
        max_retry_attempts: 3,
        backup_tokens: true,
        encryption_at_rest: true,
        ...config.token_management
      },
      audit_logging: {
        enabled: true,
        sensitive_data_masking: true,
        retention_days: 90,
        log_level: 'standard',
        ...config.audit_logging
      },
      compliance: {
        gdpr_enabled: true,
        data_retention_days: 90,
        data_anonymization: true,
        audit_trail_required: true,
        ...config.compliance
      }
    }
  }

  private generateOrLoadEncryptionKey(): Buffer {
    // 실제로는 안전한 키 저장소에서 로드하거나 생성
    const keyString = process.env.AMAZON_ENCRYPTION_KEY || 'default-key-change-in-production'
    return crypto.createHash('sha256').update(keyString).digest()
  }

  private initializeRateLimitRules(): void {
    // 기본 Rate Limit 규칙들 설정
    const defaultRules: RateLimitRule[] = [
      {
        id: 'global-api',
        name: 'Global API Rate Limit',
        scope: 'global',
        target: '*',
        limit: this.config.rate_limiting.global_requests_per_minute,
        window_seconds: 60,
        burst_allowance: this.config.rate_limiting.burst_allowance,
        enabled: true,
        priority: 1
      },
      {
        id: 'marketplace-api',
        name: 'Per Marketplace Rate Limit',
        scope: 'marketplace',
        target: '*',
        limit: this.config.rate_limiting.per_marketplace_requests_per_minute,
        window_seconds: 60,
        burst_allowance: Math.floor(this.config.rate_limiting.burst_allowance / 2),
        enabled: true,
        priority: 2
      }
    ]

    // 규칙들을 내부 저장소에 저장 (실제로는 데이터베이스 사용)
    this.logger.info(`🔧 [SECURITY] Rate Limit 규칙 ${defaultRules.length}개 초기화 완료`)
  }

  private getRateLimitRule(scope: string, operation?: string): RateLimitRule | null {
    // 실제로는 데이터베이스에서 조회
    if (scope === 'global') {
      return {
        id: 'global-api',
        name: 'Global API Rate Limit',
        scope: 'global',
        target: '*',
        limit: this.config.rate_limiting.global_requests_per_minute,
        window_seconds: 60,
        burst_allowance: this.config.rate_limiting.burst_allowance,
        enabled: true,
        priority: 1
      }
    }
    
    if (scope === 'marketplace') {
      return {
        id: 'marketplace-api',
        name: 'Per Marketplace Rate Limit',
        scope: 'marketplace',
        target: '*',
        limit: this.config.rate_limiting.per_marketplace_requests_per_minute,
        window_seconds: 60,
        burst_allowance: Math.floor(this.config.rate_limiting.burst_allowance / 2),
        enabled: true,
        priority: 2
      }
    }

    return null
  }

  private async refreshToken(marketplaceId: string): Promise<boolean> {
    const tokenInfo = this.tokenStore.get(marketplaceId)
    if (!tokenInfo || !tokenInfo.refresh_token) {
      return false
    }

    try {
      // 실제로는 Amazon SP-API를 통한 토큰 갱신
      // 여기서는 시뮬레이션
      const refreshToken = await this.decryptSensitiveData(tokenInfo.refresh_token)
      
      // 새 토큰 정보 (실제로는 API 호출 결과)
      const newTokenData = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        scope: tokenInfo.scope
      }

      await this.storeToken(marketplaceId, newTokenData)
      
      this.logger.info(`🔄 [SECURITY] 토큰 갱신 완료: ${marketplaceId}`)
      return true

    } catch (error: any) {
      this.logger.error(`❌ [SECURITY] 토큰 갱신 실패: ${marketplaceId} - ${error.message}`)
      return false
    }
  }

  private maskSensitiveData(data: any): any {
    if (!data) return data

    if (typeof data === 'string') {
      // 토큰, 키, 비밀번호 등 마스킹
      if (data.length > 10) {
        return data.substring(0, 4) + '***' + data.substring(data.length - 4)
      }
      return '***'
    }

    if (typeof data === 'object') {
      const masked = { ...data }
      const sensitiveFields = ['token', 'key', 'password', 'secret', 'auth', 'credential']
      
      Object.keys(masked).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          masked[key] = '***'
        }
      })
      
      return masked
    }

    return data
  }

  private anonymizeIpAddress(ip?: string): string | undefined {
    if (!ip) return undefined
    
    // IPv4 마지막 옥텟 제거
    if (ip.includes('.')) {
      const parts = ip.split('.')
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
    }
    
    // IPv6 일부 제거
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return parts.slice(0, 4).join(':') + ':xxxx:xxxx:xxxx:xxxx'
    }
    
    return 'xxx.xxx.xxx.xxx'
  }

  private anonymizeRequestData(data: any): any {
    if (!data) return data
    
    const anonymized = { ...data }
    const personalFields = ['email', 'name', 'phone', 'address', 'user_id', 'customer_id']
    
    Object.keys(anonymized).forEach(key => {
      if (personalFields.some(field => key.toLowerCase().includes(field))) {
        anonymized[key] = '[ANONYMIZED]'
      }
    })
    
    return anonymized
  }

  private cleanupOldAuditLogs(): void {
    const retentionPeriod = this.config.audit_logging.retention_days
    const cutoffDate = new Date(Date.now() - (retentionPeriod * 24 * 60 * 60 * 1000))
    
    const initialCount = this.auditLogs.length
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoffDate)
    
    if (initialCount > this.auditLogs.length) {
      this.logger.info(`🗑️ [SECURITY] 오래된 감사 로그 ${initialCount - this.auditLogs.length}개 정리`)
    }
  }

  private async handleCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    // 긴급 보안 이벤트 처리
    this.logger.error(`🚨 [SECURITY] 긴급 보안 이벤트 탐지: ${event.type}`)
    
    // 실제로는 알림 시스템, 자동 차단 등 구현
    // 여기서는 로깅만 수행
  }

  private startSecurityMonitoring(): void {
    // 주기적 보안 모니터링 시작
    setInterval(() => {
      this.performSecurityChecks()
    }, 5 * 60 * 1000) // 5분마다

    setInterval(() => {
      this.applyDataRetentionPolicy()
    }, 24 * 60 * 60 * 1000) // 24시간마다
  }

  private async performSecurityChecks(): Promise<void> {
    // 만료 토큰 확인
    for (const [marketplaceId, tokenInfo] of this.tokenStore.entries()) {
      if (new Date() >= tokenInfo.expires_at) {
        await this.logSecurityEvent({
          type: 'token_expired',
          severity: 'medium',
          source: marketplaceId,
          details: { expires_at: tokenInfo.expires_at }
        })
      }
    }

    // Rate Limit 카운터 정리
    const now = Date.now()
    for (const [key, counter] of this.rateLimitCounters.entries()) {
      if (now >= counter.resetTime) {
        this.rateLimitCounters.delete(key)
      }
    }
  }
}

export default AmazonSecurityService