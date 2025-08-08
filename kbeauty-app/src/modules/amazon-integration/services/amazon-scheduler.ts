import { MedusaService } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { amazonBatchSyncOptimizedWorkflow } from "../../../workflows/amazon-batch-sync-optimized"
import { amazonResilientSyncWorkflow } from "../../../workflows/amazon-resilient-sync"

export interface ScheduleConfig {
  id: string
  name: string
  type: 'batch_sync' | 'price_update' | 'inventory_sync' | 'full_sync'
  enabled: boolean
  cron_expression: string
  timezone: string
  target_scope: {
    product_ids?: string[]
    marketplace_ids?: string[]
    categories?: string[]
    brands?: string[]
    priority_only?: boolean
  }
  execution_options: {
    batch_size?: number
    max_concurrent?: number
    retry_count?: number
    delay_between_batches?: number
    skip_validation?: boolean
    fallback_strategy?: 'skip' | 'queue' | 'partial'
  }
  notification_settings: {
    on_success?: boolean
    on_failure?: boolean
    on_completion?: boolean
    channels: ('email' | 'slack' | 'webhook')[]
    recipients: string[]
  }
  conditions: {
    min_success_rate?: number
    max_execution_time_minutes?: number
    skip_if_recent_failure?: boolean
    require_approval?: boolean
  }
  metadata?: Record<string, any>
}

export interface ScheduleExecution {
  id: string
  schedule_id: string
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped'
  started_at?: Date
  completed_at?: Date
  execution_time_ms?: number
  result?: any
  error?: string
  triggered_by: 'cron' | 'manual' | 'event' | 'api'
  metadata?: Record<string, any>
}

export interface EventTrigger {
  id: string
  name: string
  event_type: 'product_updated' | 'price_changed' | 'inventory_changed' | 'product_created' | 'order_placed'
  enabled: boolean
  conditions: {
    field_changes?: string[]
    threshold_values?: Record<string, any>
    delay_minutes?: number
    batch_events?: boolean
    max_batch_size?: number
  }
  target_action: {
    type: 'sync_product' | 'update_price' | 'sync_inventory' | 'full_sync'
    scope: 'single' | 'related' | 'category' | 'brand'
    options: any
  }
  rate_limiting: {
    max_executions_per_hour?: number
    cooldown_minutes?: number
  }
}

/**
 * Amazon 동기화 스케줄러 서비스
 * 
 * 기능:
 * - Cron 기반 자동 스케줄링
 * - 이벤트 기반 실시간 동기화
 * - 지능형 실행 조건 판단
 * - 장애 상황 자동 복구
 * - 성능 최적화 및 Rate Limiting
 */
export class AmazonSchedulerService extends MedusaService({}) {
  private schedules: Map<string, ScheduleConfig> = new Map()
  private eventTriggers: Map<string, EventTrigger> = new Map()
  private runningExecutions: Map<string, ScheduleExecution> = new Map()
  private cronJobs: Map<string, NodeJS.Timeout> = new Map()
  private eventQueues: Map<string, any[]> = new Map()
  private logger: Logger

  constructor(dependencies: any) {
    super(dependencies)
    this.logger = dependencies.logger
    this.initializeDefaultSchedules()
    this.startEventProcessing()
  }

  /**
   * 스케줄 등록/업데이트
   */
  async createOrUpdateSchedule(config: ScheduleConfig): Promise<void> {
    // 기존 스케줄 정지
    if (this.schedules.has(config.id)) {
      await this.stopSchedule(config.id)
    }

    // 새 스케줄 등록
    this.schedules.set(config.id, config)

    if (config.enabled) {
      await this.startSchedule(config.id)
    }

    this.logger.info(`📅 [SCHEDULER] 스케줄 등록/업데이트: ${config.name} (${config.id})`)
  }

  /**
   * 스케줄 시작
   */
  async startSchedule(scheduleId: string): Promise<void> {
    const config = this.schedules.get(scheduleId)
    if (!config) {
      throw new Error(`스케줄을 찾을 수 없습니다: ${scheduleId}`)
    }

    // Cron 작업 생성
    const cronInterval = this.parseCronExpression(config.cron_expression)
    const cronJob = setInterval(async () => {
      await this.executeSchedule(scheduleId, 'cron')
    }, cronInterval)

    this.cronJobs.set(scheduleId, cronJob)
    this.logger.info(`▶️ [SCHEDULER] 스케줄 시작: ${config.name}`)
  }

  /**
   * 스케줄 정지
   */
  async stopSchedule(scheduleId: string): Promise<void> {
    const cronJob = this.cronJobs.get(scheduleId)
    if (cronJob) {
      clearInterval(cronJob)
      this.cronJobs.delete(scheduleId)
    }

    const config = this.schedules.get(scheduleId)
    if (config) {
      this.logger.info(`⏹️ [SCHEDULER] 스케줄 정지: ${config.name}`)
    }
  }

  /**
   * 스케줄 즉시 실행
   */
  async executeScheduleNow(scheduleId: string): Promise<ScheduleExecution> {
    return await this.executeSchedule(scheduleId, 'manual')
  }

  /**
   * 이벤트 트리거 등록
   */
  async createEventTrigger(trigger: EventTrigger): Promise<void> {
    this.eventTriggers.set(trigger.id, trigger)
    this.logger.info(`⚡ [SCHEDULER] 이벤트 트리거 등록: ${trigger.name}`)
  }

  /**
   * 이벤트 처리
   */
  async handleEvent(eventType: string, data: any): Promise<void> {
    const triggers = Array.from(this.eventTriggers.values())
      .filter(trigger => trigger.enabled && trigger.event_type === eventType)

    for (const trigger of triggers) {
      if (await this.shouldTriggerEvent(trigger, data)) {
        await this.executeTrigger(trigger, data)
      }
    }
  }

  /**
   * 실행 중인 작업 조회
   */
  getRunningExecutions(): ScheduleExecution[] {
    return Array.from(this.runningExecutions.values())
  }

  /**
   * 스케줄 목록 조회
   */
  getSchedules(): ScheduleConfig[] {
    return Array.from(this.schedules.values())
  }

  /**
   * 실행 이력 조회
   */
  async getExecutionHistory(
    scheduleId?: string,
    limit: number = 50
  ): Promise<ScheduleExecution[]> {
    // 실제로는 데이터베이스에서 조회
    return []
  }

  /**
   * 스케줄 성능 통계
   */
  async getScheduleStats(scheduleId: string): Promise<{
    total_executions: number
    success_rate: number
    average_execution_time: number
    last_execution: Date | null
    next_execution: Date | null
    failure_count_last_24h: number
  }> {
    // 실제로는 데이터베이스에서 통계 계산
    return {
      total_executions: 0,
      success_rate: 0,
      average_execution_time: 0,
      last_execution: null,
      next_execution: null,
      failure_count_last_24h: 0
    }
  }

  // Private methods

  private async executeSchedule(scheduleId: string, triggeredBy: 'cron' | 'manual'): Promise<ScheduleExecution> {
    const config = this.schedules.get(scheduleId)
    if (!config) {
      throw new Error(`스케줄을 찾을 수 없습니다: ${scheduleId}`)
    }

    const execution: ScheduleExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      schedule_id: scheduleId,
      status: 'scheduled',
      triggered_by: triggeredBy
    }

    // 실행 조건 확인
    if (!(await this.checkExecutionConditions(config))) {
      execution.status = 'skipped'
      this.logger.info(`⏭️ [SCHEDULER] 실행 조건 미충족으로 스킵: ${config.name}`)
      return execution
    }

    // 실행 시작
    execution.status = 'running'
    execution.started_at = new Date()
    this.runningExecutions.set(execution.id, execution)

    this.logger.info(`🚀 [SCHEDULER] 스케줄 실행 시작: ${config.name}`)

    try {
      let result

      // 동기화 타입별 실행
      switch (config.type) {
        case 'batch_sync':
        case 'full_sync':
          result = await amazonBatchSyncOptimizedWorkflow.run({
            input: {
              product_ids: config.target_scope.product_ids,
              marketplace_ids: config.target_scope.marketplace_ids,
              sync_type: config.type === 'full_sync' ? 'all' : 'product',
              options: config.execution_options
            }
          })
          break

        case 'price_update':
          result = await amazonBatchSyncOptimizedWorkflow.run({
            input: {
              product_ids: config.target_scope.product_ids,
              marketplace_ids: config.target_scope.marketplace_ids,
              sync_type: 'price',
              options: config.execution_options
            }
          })
          break

        case 'inventory_sync':
          result = await amazonBatchSyncOptimizedWorkflow.run({
            input: {
              product_ids: config.target_scope.product_ids,
              marketplace_ids: config.target_scope.marketplace_ids,
              sync_type: 'inventory',
              options: config.execution_options
            }
          })
          break
      }

      // 실행 완료
      execution.status = 'completed'
      execution.completed_at = new Date()
      execution.execution_time_ms = execution.completed_at.getTime() - execution.started_at!.getTime()
      execution.result = result.output

      this.logger.info(`✅ [SCHEDULER] 스케줄 실행 완료: ${config.name} (${execution.execution_time_ms}ms)`)

      // 성공 알림
      if (config.notification_settings.on_success || config.notification_settings.on_completion) {
        await this.sendNotification(config, execution, 'success')
      }

    } catch (error: any) {
      execution.status = 'failed'
      execution.completed_at = new Date()
      execution.execution_time_ms = execution.completed_at.getTime() - execution.started_at!.getTime()
      execution.error = error.message

      this.logger.error(`❌ [SCHEDULER] 스케줄 실행 실패: ${config.name} - ${error.message}`)

      // 실패 알림
      if (config.notification_settings.on_failure) {
        await this.sendNotification(config, execution, 'failure')
      }

      // 자동 복구 시도
      await this.handleExecutionFailure(config, execution, error)
    }

    this.runningExecutions.delete(execution.id)
    await this.saveExecutionHistory(execution)

    return execution
  }

  private async checkExecutionConditions(config: ScheduleConfig): Promise<boolean> {
    // 최근 실패 확인
    if (config.conditions.skip_if_recent_failure) {
      const recentFailures = await this.getRecentFailures(config.id, 60) // 1시간 내
      if (recentFailures > 0) {
        return false
      }
    }

    // 최소 성공률 확인
    if (config.conditions.min_success_rate) {
      const stats = await this.getScheduleStats(config.id)
      if (stats.success_rate < config.conditions.min_success_rate) {
        return false
      }
    }

    // 승인 필요 여부
    if (config.conditions.require_approval) {
      const hasApproval = await this.checkApprovalStatus(config.id)
      if (!hasApproval) {
        return false
      }
    }

    return true
  }

  private async shouldTriggerEvent(trigger: EventTrigger, data: any): Promise<boolean> {
    // Rate Limiting 확인
    if (trigger.rate_limiting.max_executions_per_hour) {
      const hourlyCount = await this.getHourlyExecutionCount(trigger.id)
      if (hourlyCount >= trigger.rate_limiting.max_executions_per_hour) {
        return false
      }
    }

    // 쿨다운 확인
    if (trigger.rate_limiting.cooldown_minutes) {
      const lastExecution = await this.getLastTriggerExecution(trigger.id)
      if (lastExecution) {
        const cooldownMs = trigger.rate_limiting.cooldown_minutes * 60 * 1000
        if (Date.now() - lastExecution.getTime() < cooldownMs) {
          return false
        }
      }
    }

    // 조건 확인
    if (trigger.conditions.field_changes && data.changes) {
      const hasRelevantChanges = trigger.conditions.field_changes.some(field => 
        data.changes.hasOwnProperty(field)
      )
      if (!hasRelevantChanges) {
        return false
      }
    }

    return true
  }

  private async executeTrigger(trigger: EventTrigger, data: any): Promise<void> {
    this.logger.info(`⚡ [SCHEDULER] 이벤트 트리거 실행: ${trigger.name}`)

    try {
      let result

      switch (trigger.target_action.type) {
        case 'sync_product':
          result = await amazonResilientSyncWorkflow.run({
            input: {
              product_id: data.product_id,
              marketplace_ids: trigger.target_action.options?.marketplace_ids,
              sync_type: 'product',
              options: trigger.target_action.options
            }
          })
          break

        case 'update_price':
          result = await amazonResilientSyncWorkflow.run({
            input: {
              product_id: data.product_id,
              marketplace_ids: trigger.target_action.options?.marketplace_ids,
              sync_type: 'price',
              options: trigger.target_action.options
            }
          })
          break

        case 'sync_inventory':
          result = await amazonResilientSyncWorkflow.run({
            input: {
              product_id: data.product_id,
              marketplace_ids: trigger.target_action.options?.marketplace_ids,
              sync_type: 'inventory',
              options: trigger.target_action.options
            }
          })
          break
      }

      this.logger.info(`✅ [SCHEDULER] 트리거 실행 완료: ${trigger.name}`)

    } catch (error: any) {
      this.logger.error(`❌ [SCHEDULER] 트리거 실행 실패: ${trigger.name} - ${error.message}`)
    }
  }

  private async sendNotification(
    config: ScheduleConfig, 
    execution: ScheduleExecution, 
    type: 'success' | 'failure'
  ): Promise<void> {
    // 실제로는 이메일/Slack/웹훅 등으로 알림 전송
    this.logger.info(`📬 [SCHEDULER] 알림 전송: ${config.name} - ${type}`)
  }

  private async handleExecutionFailure(
    config: ScheduleConfig, 
    execution: ScheduleExecution, 
    error: Error
  ): Promise<void> {
    // 자동 복구 로직
    const failureCount = await this.getRecentFailures(config.id, 24 * 60) // 24시간 내
    
    if (failureCount >= 3) {
      // 3회 연속 실패 시 스케줄 비활성화
      config.enabled = false
      this.schedules.set(config.id, config)
      await this.stopSchedule(config.id)
      this.logger.warn(`⚠️ [SCHEDULER] 연속 실패로 인한 스케줄 비활성화: ${config.name}`)
    }
  }

  private parseCronExpression(cronExpr: string): number {
    // 간단한 cron 파싱 (실제로는 node-cron 등 라이브러리 사용)
    const parts = cronExpr.split(' ')
    
    if (cronExpr.includes('*/')) {
      const interval = parseInt(cronExpr.split('*/')[1].split(' ')[0])
      return interval * 60 * 1000 // 분 단위를 밀리초로 변환
    }
    
    return 60 * 60 * 1000 // 기본 1시간
  }

  private initializeDefaultSchedules(): void {
    // 기본 스케줄들 설정
    const defaultSchedules: ScheduleConfig[] = [
      {
        id: 'daily-full-sync',
        name: '일일 전체 동기화',
        type: 'full_sync',
        enabled: false, // 기본 비활성화
        cron_expression: '0 2 * * *', // 매일 오전 2시
        timezone: 'Asia/Seoul',
        target_scope: {},
        execution_options: {
          batch_size: 10,
          max_concurrent: 2,
          retry_count: 3
        },
        notification_settings: {
          on_completion: true,
          channels: ['email'],
          recipients: ['admin@company.com']
        },
        conditions: {
          min_success_rate: 80,
          max_execution_time_minutes: 180
        }
      },
      {
        id: 'hourly-price-sync',
        name: '시간별 가격 동기화',
        type: 'price_update',
        enabled: false,
        cron_expression: '0 * * * *', // 매시 정각
        timezone: 'Asia/Seoul',
        target_scope: {
          priority_only: true
        },
        execution_options: {
          batch_size: 20,
          max_concurrent: 3,
          retry_count: 2,
          skip_validation: true
        },
        notification_settings: {
          on_failure: true,
          channels: ['slack'],
          recipients: ['#amazon-alerts']
        },
        conditions: {
          skip_if_recent_failure: true
        }
      }
    ]

    defaultSchedules.forEach(schedule => {
      this.schedules.set(schedule.id, schedule)
    })
  }

  private startEventProcessing(): void {
    // 이벤트 큐 처리 시작
    setInterval(() => {
      this.processEventQueues()
    }, 5000) // 5초마다 처리
  }

  private async processEventQueues(): Promise<void> {
    // 이벤트 큐 처리 로직
    for (const [triggerType, events] of this.eventQueues.entries()) {
      if (events.length > 0) {
        const event = events.shift()
        await this.handleEvent(triggerType, event)
      }
    }
  }

  // Utility methods
  private async saveExecutionHistory(execution: ScheduleExecution): Promise<void> {
    // 실제로는 데이터베이스에 저장
  }

  private async getRecentFailures(scheduleId: string, minutes: number): Promise<number> {
    // 실제로는 데이터베이스에서 조회
    return 0
  }

  private async checkApprovalStatus(scheduleId: string): Promise<boolean> {
    // 승인 시스템 확인
    return true
  }

  private async getHourlyExecutionCount(triggerId: string): Promise<number> {
    // 시간당 실행 횟수 조회
    return 0
  }

  private async getLastTriggerExecution(triggerId: string): Promise<Date | null> {
    // 마지막 트리거 실행 시간
    return null
  }
}

export default AmazonSchedulerService