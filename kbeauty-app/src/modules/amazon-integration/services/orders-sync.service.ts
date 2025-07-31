import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService, { AmazonOrder, AmazonOrderItem } from "./amazon.service"

export interface OrdersSyncConfig {
  auto_sync: boolean
  poll_interval_minutes: number
  batch_size: number
  create_medusa_orders: boolean // Amazon 주문을 Medusa에 생성할지 여부
  sync_status_updates: boolean // Medusa → Amazon 상태 업데이트 여부
  retry_attempts: number
}

export interface MedusaOrderData {
  id: string
  amazon_order_id?: string
  status: string
  currency_code: string
  total: number
  customer_email?: string
  shipping_address: any
  items: MedusaOrderItem[]
  fulfillment_status?: string
  payment_status?: string
}

export interface MedusaOrderItem {
  id: string
  variant_id: string
  product_id: string
  title: string
  sku: string
  quantity: number
  unit_price: number
  total: number
}

export interface OrderSyncResult {
  amazon_order_id: string
  medusa_order_id?: string
  marketplace: string
  sync_action: 'created' | 'updated' | 'status_synced' | 'skipped' | 'failed'
  error_message?: string
  order_total: number
  currency: string
}

export interface OrderStatusMapping {
  amazon_status: string
  medusa_status: string
  requires_action: boolean
}

/**
 * Amazon 주문 동기화 서비스
 * 
 * Amazon 주문을 Medusa로 가져오고, 
 * Medusa 주문 상태를 Amazon에 업데이트합니다.
 */
class OrdersSyncService {
  private logger: Logger
  private amazonIntegrationService: AmazonIntegrationModuleService
  private amazonService: AmazonService
  private config: OrdersSyncConfig
  
  // Amazon ↔ Medusa 상태 매핑
  private readonly statusMapping: OrderStatusMapping[] = [
    { amazon_status: 'Pending', medusa_status: 'pending', requires_action: false },
    { amazon_status: 'Unshipped', medusa_status: 'requires_action', requires_action: true },
    { amazon_status: 'PartiallyShipped', medusa_status: 'partially_fulfilled', requires_action: false },
    { amazon_status: 'Shipped', medusa_status: 'fulfilled', requires_action: false },
    { amazon_status: 'Cancelled', medusa_status: 'canceled', requires_action: false },
    { amazon_status: 'Unfulfillable', medusa_status: 'requires_action', requires_action: true }
  ]

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
      poll_interval_minutes: 15, // 15분마다 새 주문 확인
      batch_size: 20,
      create_medusa_orders: true,
      sync_status_updates: true,
      retry_attempts: 3
    }
  }

  /**
   * 모든 활성 마켓플레이스에서 새로운 주문을 조회하고 동기화
   */
  async syncNewOrdersFromAmazon(): Promise<OrderSyncResult[]> {
    this.logger.info(`Amazon 신규 주문 동기화 시작`)

    try {
      const activeMarketplaces = await this.amazonIntegrationService.getActiveMarketplaces()
      
      if (activeMarketplaces.length === 0) {
        this.logger.warn(`활성화된 Amazon 마켓플레이스가 없습니다`)
        return []
      }

      const allResults: OrderSyncResult[] = []

      // 각 마켓플레이스별로 주문 조회
      for (const marketplace of activeMarketplaces) {
        try {
          // 지난 24시간 주문 조회 (실제로는 마지막 동기화 시점부터)
          const lastSyncTime = await this.getLastOrderSyncTime(marketplace.id)
          const ordersResult = await this.amazonService.getNewOrders(
            marketplace,
            lastSyncTime
          )

          if (!ordersResult.success) {
            this.logger.error(`${marketplace.name} 주문 조회 실패 - Marketplace: ${marketplace.id}`)
            continue
          }

          this.logger.info(`${marketplace.name} 신규 주문 - Count: ${ordersResult.orders.length}`)

          // 각 주문 처리
          for (const amazonOrder of ordersResult.orders) {
            try {
              const syncResult = await this.processAmazonOrder(amazonOrder, marketplace)
              allResults.push(syncResult)
            } catch (error) {
              allResults.push({
                amazon_order_id: amazonOrder.amazon_order_id,
                marketplace: marketplace.country_code,
                sync_action: 'failed',
                error_message: error.message,
                order_total: amazonOrder.order_total.amount,
                currency: amazonOrder.order_total.currency_code
              })

              this.logger.error(`주문 처리 실패 - Amazon Order: ${amazonOrder.amazon_order_id}, Error: ${error.message}`)
            }
          }

          // 마지막 동기화 시간 업데이트
          await this.updateLastOrderSyncTime(marketplace.id, new Date())

        } catch (error) {
          this.logger.error(`마켓플레이스 주문 동기화 실패 - Marketplace: ${marketplace.name}, Error: ${error.message}`)
        }
      }

      this.logger.info(`Amazon 주문 동기화 완료 - Total: ${allResults.length}, Success: ${allResults.filter(r => r.sync_action !== 'failed').length}, Failed: ${allResults.filter(r => r.sync_action === 'failed').length}`)

      return allResults
    } catch (error) {
      this.logger.error(`Amazon 주문 동기화 중 오류: ${error.message}`)
      return []
    }
  }

  /**
   * 개별 Amazon 주문을 처리하여 Medusa 주문으로 변환/생성
   */
  private async processAmazonOrder(
    amazonOrder: AmazonOrder,
    marketplace: any
  ): Promise<OrderSyncResult> {
    try {
      // 이미 처리된 주문인지 확인
      const existingOrder = await this.findMedusaOrderByAmazonId(amazonOrder.amazon_order_id)
      
      if (existingOrder) {
        // 기존 주문 상태 업데이트
        return await this.updateExistingOrder(existingOrder, amazonOrder, marketplace)
      }

      // 새 주문 생성
      if (this.config.create_medusa_orders) {
        return await this.createMedusaOrderFromAmazon(amazonOrder, marketplace)
      } else {
        return {
          amazon_order_id: amazonOrder.amazon_order_id,
          marketplace: marketplace.country_code,
          sync_action: 'skipped',
          error_message: '주문 생성이 비활성화됨',
          order_total: amazonOrder.order_total.amount,
          currency: amazonOrder.order_total.currency_code
        }
      }
    } catch (error) {
      return {
        amazon_order_id: amazonOrder.amazon_order_id,
        marketplace: marketplace.country_code,
        sync_action: 'failed',
        error_message: error.message,
        order_total: amazonOrder.order_total.amount,
        currency: amazonOrder.order_total.currency_code
      }
    }
  }

  /**
   * Amazon 주문으로부터 새로운 Medusa 주문 생성
   */
  private async createMedusaOrderFromAmazon(
    amazonOrder: AmazonOrder,
    marketplace: any
  ): Promise<OrderSyncResult> {
    try {
      // Amazon 주문 아이템을 Medusa 상품으로 매핑
      const mappedItems = await this.mapAmazonItemsToMedusa(amazonOrder.order_items, marketplace)
      
      if (mappedItems.length === 0) {
        return {
          amazon_order_id: amazonOrder.amazon_order_id,
          marketplace: marketplace.country_code,
          sync_action: 'failed',
          error_message: '매핑 가능한 상품이 없습니다',
          order_total: amazonOrder.order_total.amount,
          currency: amazonOrder.order_total.currency_code
        }
      }

      // Medusa 주문 데이터 구성
      const medusaOrderData: MedusaOrderData = {
        id: '', // 생성 후 할당됨
        amazon_order_id: amazonOrder.amazon_order_id,
        status: this.mapAmazonStatusToMedusa(amazonOrder.order_status),
        currency_code: amazonOrder.order_total.currency_code,
        total: amazonOrder.order_total.amount,
        customer_email: amazonOrder.buyer_email,
        shipping_address: amazonOrder.ship_to_address,
        items: mappedItems
      }

      // TODO: 실제 Medusa Order Service를 사용해서 주문 생성
      // const createdOrder = await orderService.create(medusaOrderData)
      const mockOrderId = `medusa_order_${Date.now()}`

      this.logger.info(`Amazon 주문을 Medusa 주문으로 생성 - Amazon Order: ${amazonOrder.amazon_order_id}, Medusa Order: ${mockOrderId}, Total: ${amazonOrder.order_total.amount} ${amazonOrder.order_total.currency_code}`)

      return {
        amazon_order_id: amazonOrder.amazon_order_id,
        medusa_order_id: mockOrderId,
        marketplace: marketplace.country_code,
        sync_action: 'created',
        order_total: amazonOrder.order_total.amount,
        currency: amazonOrder.order_total.currency_code
      }
    } catch (error) {
      this.logger.error(`Medusa 주문 생성 실패 - Order: ${amazonOrder.amazon_order_id}, Error: ${error.message}`)
      
      throw error
    }
  }

  /**
   * Amazon 주문 아이템을 Medusa 상품으로 매핑
   */
  private async mapAmazonItemsToMedusa(
    amazonItems: AmazonOrderItem[],
    marketplace: any
  ): Promise<MedusaOrderItem[]> {
    const mappedItems: MedusaOrderItem[] = []

    for (const amazonItem of amazonItems) {
      try {
        // SKU로 Amazon 동기화 레코드 찾기
        const syncRecords = await this.amazonIntegrationService.listAmazonProductSyncs({
          amazon_sku: amazonItem.seller_sku,
          amazon_marketplace_id: marketplace.id
        })

        if (syncRecords.length === 0) {
          this.logger.warn(`SKU에 해당하는 동기화 레코드를 찾을 수 없습니다 - SKU: ${amazonItem.seller_sku}`)
          continue
        }

        const syncRecord = syncRecords[0]
        
        // TODO: 실제 Product Service를 사용해서 상품 정보 조회
        // const product = await productService.retrieve(syncRecord.medusa_product_id)
        
        mappedItems.push({
          id: `item_${Date.now()}_${amazonItem.order_item_id}`,
          variant_id: `variant_${syncRecord.medusa_product_id}`, // 임시값
          product_id: syncRecord.medusa_product_id,
          title: amazonItem.title,
          sku: amazonItem.seller_sku,
          quantity: amazonItem.quantity_ordered,
          unit_price: amazonItem.item_price.amount / amazonItem.quantity_ordered,
          total: amazonItem.item_price.amount
        })
      } catch (error) {
        this.logger.error(`Amazon 아이템 매핑 실패 - Item: ${amazonItem.order_item_id}, SKU: ${amazonItem.seller_sku}, Error: ${error.message}`)
      }
    }

    return mappedItems
  }

  /**
   * Medusa 주문 상태를 Amazon으로 동기화
   */
  async syncMedusaOrderStatusToAmazon(
    medusaOrderId: string,
    newStatus: string,
    trackingInfo?: {
      tracking_number: string
      carrier_code: string
      ship_date?: Date
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Amazon 주문 ID 찾기
      const amazonOrderId = await this.findAmazonOrderIdByMedusa(medusaOrderId)
      
      if (!amazonOrderId) {
        return {
          success: false,
          message: 'Amazon 주문 ID를 찾을 수 없습니다'
        }
      }

      // 마켓플레이스 정보 조회
      const marketplace = await this.findMarketplaceByOrderId(amazonOrderId)
      
      if (!marketplace) {
        return {
          success: false,
          message: '마켓플레이스 정보를 찾을 수 없습니다'
        }
      }

      // 상태별 처리
      if (newStatus === 'fulfilled' && trackingInfo) {
        // 배송 완료 처리
        const result = await this.amazonService.updateOrderStatus(
          amazonOrderId,
          {
            tracking_number: trackingInfo.tracking_number,
            carrier_code: trackingInfo.carrier_code,
            ship_date: trackingInfo.ship_date || new Date()
          },
          marketplace
        )

        if (result.success) {
          this.logger.info(`Amazon 주문 배송 정보 업데이트 완료 - Medusa Order: ${medusaOrderId}, Amazon Order: ${amazonOrderId}, Tracking: ${trackingInfo.tracking_number}`)
          
          return {
            success: true,
            message: '배송 정보가 Amazon에 업데이트되었습니다'
          }
        } else {
          return {
            success: false,
            message: 'Amazon 배송 정보 업데이트 실패'
          }
        }
      }

      // 기타 상태 변경 (필요에 따라 구현)
      return {
        success: true,
        message: '상태 동기화가 완료되었습니다'
      }
    } catch (error) {
      this.logger.error(`Medusa → Amazon 상태 동기화 실패 - Order: ${medusaOrderId}, Error: ${error.message}`)
      
      return {
        success: false,
        message: error.message
      }
    }
  }

  /**
   * 주문 동기화 통계 조회
   */
  async getOrderSyncStats(): Promise<{
    total_synced_orders: number
    pending_orders: number
    failed_sync_count: number
    last_sync_time: Date | null
    config: OrdersSyncConfig
  }> {
    try {
      // TODO: 실제 데이터베이스에서 통계 조회
      return {
        total_synced_orders: 0,
        pending_orders: 0,
        failed_sync_count: 0,
        last_sync_time: new Date(),
        config: this.config
      }
    } catch (error) {
      this.logger.error(`주문 동기화 통계 조회 실패 - Error: ${error.message}`)
      return {
        total_synced_orders: 0,
        pending_orders: 0,
        failed_sync_count: 0,
        last_sync_time: null,
        config: this.config
      }
    }
  }

  /**
   * 주문 동기화 설정 업데이트
   */
  updateConfig(newConfig: Partial<OrdersSyncConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.logger.info(`주문 동기화 설정 업데이트 - Config: ${JSON.stringify(this.config)}`)
  }

  // ===========================================
  // 유틸리티 메서드들
  // ===========================================

  private async getLastOrderSyncTime(marketplaceId: string): Promise<Date> {
    // TODO: 실제 데이터베이스에서 마지막 동기화 시간 조회
    return new Date(Date.now() - 24 * 60 * 60 * 1000) // 기본: 24시간 전
  }

  private async updateLastOrderSyncTime(marketplaceId: string, syncTime: Date): Promise<void> {
    // TODO: 실제 데이터베이스에 마지막 동기화 시간 저장
    this.logger.debug(`마지막 주문 동기화 시간 업데이트 - Marketplace: ${marketplaceId}, Time: ${syncTime}`)
  }

  private async findMedusaOrderByAmazonId(amazonOrderId: string): Promise<MedusaOrderData | null> {
    // TODO: 실제 Order Service를 사용해서 Amazon 주문 ID로 Medusa 주문 찾기
    return null
  }

  private async findAmazonOrderIdByMedusa(medusaOrderId: string): Promise<string | null> {
    // TODO: 실제 데이터베이스에서 Medusa 주문 ID로 Amazon 주문 ID 찾기
    return null
  }

  private async findMarketplaceByOrderId(amazonOrderId: string): Promise<any | null> {
    // TODO: Amazon 주문 ID로 마켓플레이스 정보 찾기
    return null
  }

  private async updateExistingOrder(
    existingOrder: MedusaOrderData,
    amazonOrder: AmazonOrder,
    marketplace: any
  ): Promise<OrderSyncResult> {
    try {
      const newStatus = this.mapAmazonStatusToMedusa(amazonOrder.order_status)
      
      if (existingOrder.status !== newStatus) {
        // TODO: 실제 Order Service를 사용해서 주문 상태 업데이트
        this.logger.info(`주문 상태 업데이트 - Order: ${existingOrder.id}, Status: ${existingOrder.status} -> ${newStatus}, Amazon: ${amazonOrder.amazon_order_id}`)
      }

      return {
        amazon_order_id: amazonOrder.amazon_order_id,
        medusa_order_id: existingOrder.id,
        marketplace: marketplace.country_code,
        sync_action: 'updated',
        order_total: amazonOrder.order_total.amount,
        currency: amazonOrder.order_total.currency_code
      }
    } catch (error) {
      throw new Error(`기존 주문 업데이트 실패: ${error.message}`)
    }
  }

  private mapAmazonStatusToMedusa(amazonStatus: string): string {
    const mapping = this.statusMapping.find(m => m.amazon_status === amazonStatus)
    return mapping?.medusa_status || 'pending'
  }

  private mapMedusaStatusToAmazon(medusaStatus: string): string {
    const mapping = this.statusMapping.find(m => m.medusa_status === medusaStatus)
    return mapping?.amazon_status || 'Pending'
  }
}

export default OrdersSyncService 