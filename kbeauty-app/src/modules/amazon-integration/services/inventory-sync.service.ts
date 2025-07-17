import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService, { InventoryUpdate } from "./amazon.service"

export interface InventorySyncConfig {
  auto_sync: boolean
  batch_size: number
  sync_threshold: number // 최소 변경량 (이하는 동기화 안함)
  retry_attempts: number
}

export interface MedusaInventoryItem {
  id: string
  sku: string
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
}

export interface SyncResult {
  sku: string
  marketplace_id: string
  medusa_quantity: number
  amazon_quantity: number
  sync_status: 'success' | 'failed' | 'skipped'
  error_message?: string
}

/**
 * Amazon 재고 동기화 서비스
 * 
 * Medusa 재고 변경 시 Amazon 재고를 자동으로 업데이트하고,
 * 주기적으로 양방향 동기화를 수행합니다.
 */
class InventorySyncService {
  private logger: Logger
  private amazonIntegrationService: AmazonIntegrationModuleService
  private amazonService: AmazonService
  private config: InventorySyncConfig

  constructor({
    logger,
    amazonIntegrationService,
    amazonService
  }: {
    logger: Logger
    amazonIntegrationService: AmazonIntegrationModuleService
    amazonService: AmazonService
  }) {
    this.logger = logger
    this.amazonIntegrationService = amazonIntegrationService
    this.amazonService = amazonService
    this.config = {
      auto_sync: true,
      batch_size: 50,
      sync_threshold: 1, // 1개 이상 변경 시 동기화
      retry_attempts: 3
    }
  }

  /**
   * 단일 상품의 재고를 Amazon에 동기화
   */
  async syncProductInventory(
    productId: string,
    inventoryItems: MedusaInventoryItem[]
  ): Promise<SyncResult[]> {
    this.logger.info(`재고 동기화 시작`, { product_id: productId })

    try {
      // 해당 상품의 Amazon 동기화 레코드 조회
      const syncRecords = await this.amazonIntegrationService.getProductSyncStatus(productId)
      
      if (!syncRecords || syncRecords.length === 0) {
        this.logger.warn(`Amazon 동기화 레코드가 없습니다`, { product_id: productId })
        return []
      }

      // 완료된 동기화만 처리
      const completedSyncs = syncRecords.filter(record => 
        record.sync_status === 'completed' && record.amazon_sku
      )

      if (completedSyncs.length === 0) {
        this.logger.warn(`완료된 Amazon 동기화가 없습니다`, { product_id: productId })
        return []
      }

      const results: SyncResult[] = []

      // 각 마켓플레이스별로 재고 동기화
      for (const syncRecord of completedSyncs) {
        try {
          const marketplace = await this.amazonIntegrationService.retrieveAmazonMarketplace(
            syncRecord.amazon_marketplace_id
          )

          if (!marketplace || !marketplace.is_active) {
            this.logger.warn(`비활성 마켓플레이스`, { 
              marketplace_id: syncRecord.amazon_marketplace_id 
            })
            continue
          }

          // SKU별 재고 계산
          const totalAvailableQuantity = inventoryItems.reduce((total, item) => {
            return total + Math.max(0, item.stocked_quantity - item.reserved_quantity)
          }, 0)

          // 동기화 임계값 확인
          if (Math.abs(totalAvailableQuantity) < this.config.sync_threshold) {
            results.push({
              sku: syncRecord.amazon_sku!,
              marketplace_id: marketplace.marketplace_id,
              medusa_quantity: totalAvailableQuantity,
              amazon_quantity: -1, // 알 수 없음
              sync_status: 'skipped',
              error_message: '변경량이 임계값 미만'
            })
            continue
          }

          // Amazon 재고 업데이트
          const updateResult = await this.amazonService.updateInventory([{
            sku: syncRecord.amazon_sku!,
            marketplace_id: marketplace.marketplace_id,
            quantity: totalAvailableQuantity,
            fulfillment_channel: 'DEFAULT'
          }], marketplace)

          if (updateResult.success && updateResult.results.length > 0) {
            const result = updateResult.results[0]
            results.push({
              sku: syncRecord.amazon_sku!,
              marketplace_id: marketplace.marketplace_id,
              medusa_quantity: totalAvailableQuantity,
              amazon_quantity: totalAvailableQuantity,
              sync_status: result.success ? 'success' : 'failed',
              error_message: result.success ? undefined : result.error
            })

            this.logger.info(`재고 동기화 완료`, {
              sku: syncRecord.amazon_sku,
              marketplace: marketplace.country_code,
              quantity: totalAvailableQuantity
            })
          } else {
            results.push({
              sku: syncRecord.amazon_sku!,
              marketplace_id: marketplace.marketplace_id,
              medusa_quantity: totalAvailableQuantity,
              amazon_quantity: -1,
              sync_status: 'failed',
              error_message: '재고 업데이트 실패'
            })
          }

        } catch (error) {
          results.push({
            sku: syncRecord.amazon_sku || 'unknown',
            marketplace_id: syncRecord.amazon_marketplace_id,
            medusa_quantity: -1,
            amazon_quantity: -1,
            sync_status: 'failed',
            error_message: error.message
          })

          this.logger.error(`재고 동기화 실패`, {
            sync_record_id: syncRecord.id,
            error: error.message
          })
        }
      }

      return results
    } catch (error) {
      this.logger.error(`재고 동기화 처리 중 오류`, {
        product_id: productId,
        error: error.message
      })
      return []
    }
  }

  /**
   * 배치로 여러 상품의 재고 동기화
   */
  async syncBatchInventory(
    updates: Array<{
      productId: string
      inventoryItems: MedusaInventoryItem[]
    }>
  ): Promise<SyncResult[]> {
    this.logger.info(`배치 재고 동기화 시작`, { count: updates.length })

    const allResults: SyncResult[] = []
    const batches = this.chunkArray(updates, this.config.batch_size)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      this.logger.info(`배치 ${i + 1}/${batches.length} 처리 중`, { size: batch.length })

      // 배치 내 동시 처리
      const batchPromises = batch.map(update => 
        this.syncProductInventory(update.productId, update.inventoryItems)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value)
        } else {
          this.logger.error(`배치 아이템 처리 실패`, {
            product_id: batch[index].productId,
            error: result.reason
          })
        }
      })

      // 배치 간 잠시 대기 (API 레이트 리밋 방지)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    this.logger.info(`배치 재고 동기화 완료`, {
      total_updates: updates.length,
      successful: allResults.filter(r => r.sync_status === 'success').length,
      failed: allResults.filter(r => r.sync_status === 'failed').length,
      skipped: allResults.filter(r => r.sync_status === 'skipped').length
    })

    return allResults
  }

  /**
   * Amazon에서 현재 재고 상태를 조회하여 Medusa와 비교
   */
  async compareInventoryLevels(
    productId: string
  ): Promise<Array<{
    sku: string
    marketplace: string
    medusa_quantity: number
    amazon_quantity: number
    difference: number
    needs_sync: boolean
  }>> {
    try {
      const syncRecords = await this.amazonIntegrationService.getProductSyncStatus(productId)
      const completedSyncs = syncRecords.filter(record => 
        record.sync_status === 'completed' && record.amazon_sku
      )

      const comparisons = []

      for (const syncRecord of completedSyncs) {
        const marketplace = await this.amazonIntegrationService.retrieveAmazonMarketplace(
          syncRecord.amazon_marketplace_id
        )

        if (!marketplace) continue

        // Amazon 재고 조회
        const inventoryResult = await this.amazonService.getInventoryLevels(
          [syncRecord.amazon_sku!],
          marketplace
        )

        if (inventoryResult.success && inventoryResult.inventory.length > 0) {
          const amazonInventory = inventoryResult.inventory[0]
          const amazonQuantity = amazonInventory.quantity || 0

          // TODO: Medusa 재고 조회 로직 (실제 구현에서는 inventory service 사용)
          const medusaQuantity = 100 // 임시값

          const difference = medusaQuantity - amazonQuantity
          const needsSync = Math.abs(difference) >= this.config.sync_threshold

          comparisons.push({
            sku: syncRecord.amazon_sku!,
            marketplace: marketplace.country_code,
            medusa_quantity: medusaQuantity,
            amazon_quantity: amazonQuantity,
            difference,
            needs_sync: needsSync
          })
        }
      }

      return comparisons
    } catch (error) {
      this.logger.error(`재고 수준 비교 실패`, {
        product_id: productId,
        error: error.message
      })
      return []
    }
  }

  /**
   * 재고 차이가 있는 상품들을 자동으로 동기화
   */
  async syncOutOfSyncInventory(): Promise<void> {
    this.logger.info(`동기화 누락 재고 확인 시작`)

    try {
      // 완료된 모든 동기화 레코드 조회
      const allSyncRecords = await this.amazonIntegrationService.listAmazonProductSyncs({
        sync_status: 'completed'
      })

      const groupedByProduct = allSyncRecords.reduce((acc, record) => {
        if (!acc[record.medusa_product_id]) {
          acc[record.medusa_product_id] = []
        }
        acc[record.medusa_product_id].push(record)
        return acc
      }, {} as Record<string, any[]>)

      const outOfSyncProducts = []

      for (const [productId, records] of Object.entries(groupedByProduct)) {
        const comparisons = await this.compareInventoryLevels(productId)
        const needsSync = comparisons.some(comp => comp.needs_sync)

        if (needsSync) {
          outOfSyncProducts.push({
            productId,
            comparisons
          })
        }
      }

      if (outOfSyncProducts.length === 0) {
        this.logger.info(`동기화가 필요한 재고가 없습니다`)
        return
      }

      this.logger.info(`동기화 필요한 상품 발견`, { count: outOfSyncProducts.length })

      // 동기화 실행 (실제 구현에서는 inventory service에서 데이터 조회 필요)
      for (const product of outOfSyncProducts) {
        // TODO: 실제 재고 데이터 조회 및 동기화
        this.logger.info(`재고 동기화 필요`, {
          product_id: product.productId,
          differences: product.comparisons.filter(c => c.needs_sync)
        })
      }

    } catch (error) {
      this.logger.error(`동기화 누락 재고 확인 실패`, { error: error.message })
    }
  }

  /**
   * 재고 동기화 설정 업데이트
   */
  updateConfig(newConfig: Partial<InventorySyncConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.logger.info(`재고 동기화 설정 업데이트`, this.config)
  }

  /**
   * 배열을 청크로 분할
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 재고 동기화 통계 조회
   */
  async getInventorySyncStats(): Promise<{
    total_synced_products: number
    out_of_sync_count: number
    last_sync_check: Date | null
    config: InventorySyncConfig
  }> {
    try {
      const totalSynced = await this.amazonIntegrationService.listAmazonProductSyncs({
        sync_status: 'completed'
      })

      return {
        total_synced_products: totalSynced.length,
        out_of_sync_count: 0, // TODO: 실제 계산 로직
        last_sync_check: new Date(),
        config: this.config
      }
    } catch (error) {
      this.logger.error(`재고 동기화 통계 조회 실패`, { error: error.message })
      return {
        total_synced_products: 0,
        out_of_sync_count: 0,
        last_sync_check: null,
        config: this.config
      }
    }
  }
}

export default InventorySyncService 