import { 
  type SubscriberConfig,
  type SubscriberArgs,
} from "@medusajs/framework"
import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService from "../services/amazon.service"
import InventorySyncService, { MedusaInventoryItem } from "../services/inventory-sync.service"

export interface InventoryChangedEventData {
  id: string
  location_id: string
  sku: string
  product_id?: string
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
  previous_stocked_quantity?: number
  previous_reserved_quantity?: number
}

/**
 * 재고 변경 이벤트 구독자
 * 
 * Medusa 재고 변경 시 Amazon 재고를 자동으로 동기화합니다.
 * - inventory.item.created
 * - inventory.item.updated  
 * - inventory.item.deleted
 * - inventory.level.created
 * - inventory.level.updated
 */
export default async function inventoryChangedSubscriber({
  event,
  container,
}: SubscriberArgs<InventoryChangedEventData>) {

  const logger: Logger = container.resolve("logger")
  const amazonIntegrationService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
  const amazonService = new AmazonService({ logger })
  const inventorySyncService = new InventorySyncService({
    logger,
    amazonIntegrationService,
    amazonService
  })

  logger.info(`🔄 재고 변경 이벤트 수신 - Event: ${event.name}, Inventory: ${event.data.id}, SKU: ${event.data.sku}, Product: ${event.data.product_id}, Stocked: ${event.data.stocked_quantity}, Reserved: ${event.data.reserved_quantity}`)

  try {
    // 상품 ID가 있는 경우만 처리 (상품과 연관된 재고만)
    if (!event.data.product_id) {
      logger.debug(`상품 ID가 없는 재고 변경 이벤트 스킵 - Inventory: ${event.data.id}, SKU: ${event.data.sku}`)
      return
    }

    // Amazon과 동기화된 상품인지 확인
    const syncRecords = await amazonIntegrationService.getProductSyncStatus(event.data.product_id)
    
    if (!syncRecords || syncRecords.length === 0) {
      logger.debug(`Amazon 동기화되지 않은 상품의 재고 변경 - Product: ${event.data.product_id}, SKU: ${event.data.sku}`)
      return
    }

    // 완료된 동기화만 대상
    const completedSyncs = syncRecords.filter(record => 
      record.sync_status === 'completed' && record.amazon_sku
    )

    if (completedSyncs.length === 0) {
      logger.debug(`완료된 Amazon 동기화가 없는 상품의 재고 변경 - Product: ${event.data.product_id}, SKU: ${event.data.sku}`)
      return
    }

    // 재고 변경량 확인 (의미있는 변경인지)
    const previousStocked = event.data.previous_stocked_quantity || 0
    const previousReserved = event.data.previous_reserved_quantity || 0
    const currentStocked = event.data.stocked_quantity
    const currentReserved = event.data.reserved_quantity

    const previousAvailable = Math.max(0, previousStocked - previousReserved)
    const currentAvailable = Math.max(0, currentStocked - currentReserved)
    const quantityDifference = Math.abs(currentAvailable - previousAvailable)

    // 변경량이 임계값보다 작으면 스킵
    if (quantityDifference < 1) {
      logger.debug(`재고 변경량이 임계값 미만 - Product: ${event.data.product_id}, Difference: ${quantityDifference}, Previous: ${previousAvailable}, Current: ${currentAvailable}`)
      return
    }

    logger.info(`📦 Amazon 재고 동기화 시작 - Product: ${event.data.product_id}, SKU: ${event.data.sku}, Previous: ${previousAvailable}, Current: ${currentAvailable}, Difference: ${quantityDifference}, Records: ${completedSyncs.length}`)

    // 재고 아이템 데이터 구성
    const inventoryItems: MedusaInventoryItem[] = [{
      id: event.data.id,
      sku: event.data.sku,
      location_id: event.data.location_id,
      stocked_quantity: event.data.stocked_quantity,
      reserved_quantity: event.data.reserved_quantity,
      incoming_quantity: event.data.incoming_quantity || 0
    }]

    // Amazon 재고 동기화 실행
    const syncResults = await inventorySyncService.syncProductInventory(
      event.data.product_id,
      inventoryItems
    )

    // 결과 로깅
    const successfulSyncs = syncResults.filter(r => r.sync_status === 'success')
    const failedSyncs = syncResults.filter(r => r.sync_status === 'failed')

    if (successfulSyncs.length > 0) {
      logger.info(`✅ Amazon 재고 동기화 성공 - Product: ${event.data.product_id}, Success: ${successfulSyncs.length}, Failed: ${failedSyncs.length}, SKUs: ${successfulSyncs.map(r => r.sku).join(', ')}`)
    }

    if (failedSyncs.length > 0) {
      logger.error(`❌ Amazon 재고 동기화 일부 실패 - Product: ${event.data.product_id}, Failed: ${failedSyncs.length}, Errors: ${failedSyncs.map(r => `${r.sku}: ${r.error_message}`).join(', ')}`)
    }

    logger.info(`🏁 재고 변경 이벤트 처리 완료 - Product: ${event.data.product_id}, Total: ${syncResults.length}, Success: ${successfulSyncs.length}, Failed: ${failedSyncs.length}`)

  } catch (error) {
    logger.error(`💥 재고 변경 이벤트 처리 중 오류 - Product: ${event.data.product_id}, Inventory: ${event.data.id}, Error: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: [
    "inventory.item.created",
    "inventory.item.updated", 
    "inventory.item.deleted",
    "inventory.level.created",
    "inventory.level.updated"
  ],
} 