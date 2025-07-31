import { 
  type SubscriberConfig,
  type SubscriberArgs,
} from "@medusajs/framework"
import { Logger } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../index"
import AmazonIntegrationModuleService from "../service"
import AmazonService from "../services/amazon.service"
import OrdersSyncService from "../services/orders-sync.service"

export interface OrderEventData {
  id: string
  display_id?: number
  status: string
  currency_code: string
  total: number
  customer_id?: string
  email?: string
  shipping_address?: any
  billing_address?: any
  items?: Array<{
    id: string
    variant_id: string
    product_id: string
    title: string
    sku: string
    quantity: number
    unit_price: number
    total: number
  }>
  fulfillments?: Array<{
    id: string
    location_id: string
    tracking_numbers: string[]
    shipped_at?: Date
    canceled_at?: Date
    data?: any
  }>
  payments?: Array<{
    id: string
    amount: number
    currency_code: string
    status: string
  }>
  metadata?: Record<string, any>
  previous_status?: string
}

export interface FulfillmentEventData {
  id: string
  order_id: string
  location_id: string
  tracking_numbers: string[]
  shipped_at?: Date
  canceled_at?: Date
  items: Array<{
    id: string
    order_id: string
    item_id: string
    quantity: number
  }>
  metadata?: Record<string, any>
}

/**
 * 주문 이벤트 구독자
 * 
 * Medusa 주문 상태 변경을 Amazon으로 동기화합니다.
 * - order.placed
 * - order.completed  
 * - order.canceled
 * - fulfillment.created (배송 시작)
 * - fulfillment.shipped (배송 완료)
 * - fulfillment.canceled (배송 취소)
 */
export default async function orderEventsSubscriber({
  event,
  container,
}: SubscriberArgs<OrderEventData | FulfillmentEventData>) {

  const logger: Logger = container.resolve("logger")
  const amazonIntegrationService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
  const amazonService = new AmazonService({ logger })
  const ordersSyncService = new OrdersSyncService({
    logger,
    amazonIntegrationService,
    amazonService
  })

  const eventOrderId = (event.data as any).order_id || event.data.id
  logger.info(`📦 주문 이벤트 수신 - Event: ${event.name}, Order: ${eventOrderId}`)

  try {
    // Amazon 기원 주문인지 확인 (Amazon에서 온 주문은 역동기화 방지)
    const orderData = event.data as OrderEventData
    if (orderData.metadata?.amazon_order_id) {
      logger.debug(`Amazon 기원 주문 이벤트 스킵 - Order: ${orderData.id}, Amazon Order: ${orderData.metadata.amazon_order_id}`)
      return
    }

    // 이벤트 타입별 처리
    if (event.name.includes('fulfillment')) {
      await handleFulfillmentEvent(event, ordersSyncService, logger)
    } else {
      await handleOrderEvent(event, ordersSyncService, logger)
    }

  } catch (error) {
    const errorOrderId = (event.data as any).order_id || event.data.id
    logger.error(`💥 주문 이벤트 처리 중 오류 - Event: ${event.name}, Order: ${errorOrderId}, Error: ${error.message}`)
  }
}

/**
 * 주문 상태 변경 이벤트 처리
 */
async function handleOrderEvent(
  event: any,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  const orderData = event.data as OrderEventData

  // Amazon과 연관된 주문인지 확인 (상품 기준)
  const hasAmazonProducts = await checkIfOrderHasAmazonProducts(orderData, logger)
  
  if (!hasAmazonProducts) {
    logger.debug(`Amazon 상품이 없는 주문 - Order: ${orderData.id}`)
    return
  }

  logger.info(`🔄 Amazon 연관 주문 상태 변경 - Order: ${orderData.id}, Status: ${orderData.status}, Previous: ${orderData.previous_status}`)

  switch (event.name) {
    case 'order.placed':
      await handleOrderPlaced(orderData, ordersSyncService, logger)
      break
    
    case 'order.completed':
      await handleOrderCompleted(orderData, ordersSyncService, logger)
      break
    
    case 'order.canceled':
      await handleOrderCanceled(orderData, ordersSyncService, logger)
      break
    
    default:
      logger.debug(`처리하지 않는 주문 이벤트 - Event: ${event.name}, Order: ${orderData.id}`)
  }
}

/**
 * 배송 이벤트 처리
 */
async function handleFulfillmentEvent(
  event: any,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  const fulfillmentData = event.data as FulfillmentEventData

  logger.info(`🚚 배송 이벤트 처리 - Event: ${event.name}, Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}, Tracking: ${fulfillmentData.tracking_numbers?.length || 0}`)

  switch (event.name) {
    case 'fulfillment.created':
      await handleFulfillmentCreated(fulfillmentData, ordersSyncService, logger)
      break
    
    case 'fulfillment.shipped':
      await handleFulfillmentShipped(fulfillmentData, ordersSyncService, logger)
      break
    
    case 'fulfillment.canceled':
      await handleFulfillmentCanceled(fulfillmentData, ordersSyncService, logger)
      break
    
    default:
      logger.debug(`처리하지 않는 배송 이벤트 - Event: ${event.name}, Fulfillment: ${fulfillmentData.id}`)
  }
}

/**
 * 주문 생성 처리
 */
async function handleOrderPlaced(
  orderData: OrderEventData,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  logger.info(`📝 새 주문 생성 감지 - Order: ${orderData.id}, Total: ${orderData.total}, Currency: ${orderData.currency_code}`)
  
  // 새 주문의 경우 일반적으로 Amazon 동기화가 필요하지 않음
  // (Amazon에서 온 주문을 Medusa로 동기화하는 것이 일반적)
  logger.debug(`새 주문은 Amazon 동기화 대상이 아님 - Order: ${orderData.id}`)
}

/**
 * 주문 완료 처리
 */
async function handleOrderCompleted(
  orderData: OrderEventData,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  logger.info(`✅ 주문 완료 처리 - Order: ${orderData.id}`)

  // 주문 완료는 일반적으로 결제 완료를 의미
  // Amazon과의 특별한 동기화는 필요하지 않을 수 있음
  logger.debug(`주문 완료 - Amazon 동기화 스킵 - Order: ${orderData.id}`)
}

/**
 * 주문 취소 처리
 */
async function handleOrderCanceled(
  orderData: OrderEventData,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  logger.info(`❌ 주문 취소 처리 - Order: ${orderData.id}`)

  // Amazon 기원 주문이 Medusa에서 취소된 경우 Amazon에 알려야 할 수 있음
  // 하지만 일반적으로는 Amazon에서 먼저 취소되고 Medusa로 전파됨
  logger.debug(`주문 취소 - Amazon 동기화 검토 필요 - Order: ${orderData.id}`)
}

/**
 * 배송 생성 처리
 */
async function handleFulfillmentCreated(
  fulfillmentData: FulfillmentEventData,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  logger.info(`📋 배송 생성 처리 - Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}`)

  // 배송이 시작되었지만 아직 shipped가 아닌 상태
  // Amazon에는 실제 배송 완료 시점에 알리는 것이 좋음
  logger.debug(`배송 생성 - 실제 배송 시까지 대기 - Fulfillment: ${fulfillmentData.id}`)
}

/**
 * 배송 완료 처리 - Amazon에 추적 정보 전송
 */
async function handleFulfillmentShipped(
  fulfillmentData: FulfillmentEventData,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  logger.info(`🚚 배송 완료 - Amazon 동기화 시작 - Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}, Tracking: ${fulfillmentData.tracking_numbers?.length || 0}`)

  try {
    const trackingNumber = fulfillmentData.tracking_numbers?.[0]
    
    if (!trackingNumber) {
      logger.warn(`추적 번호가 없는 배송 - Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}`)
      return
    }

    // Amazon에 배송 정보 업데이트
    const result = await ordersSyncService.syncMedusaOrderStatusToAmazon(
      fulfillmentData.order_id,
      'fulfilled',
      {
        tracking_number: trackingNumber,
        carrier_code: 'CUSTOM', // 실제 택배사 코드로 매핑 필요
        ship_date: fulfillmentData.shipped_at || new Date()
      }
    )

    if (result.success) {
      logger.info(`✅ Amazon 배송 정보 업데이트 완료 - Order: ${fulfillmentData.order_id}, Tracking: ${trackingNumber}, Message: ${result.message}`)
    } else {
      logger.error(`❌ Amazon 배송 정보 업데이트 실패 - Order: ${fulfillmentData.order_id}, Tracking: ${trackingNumber}, Error: ${result.message}`)
    }

  } catch (error) {
    logger.error(`💥 배송 완료 처리 중 오류 - Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}, Error: ${error.message}`)
  }
}

/**
 * 배송 취소 처리
 */
async function handleFulfillmentCanceled(
  fulfillmentData: FulfillmentEventData,
  ordersSyncService: OrdersSyncService,
  logger: Logger
) {
  logger.info(`🚫 배송 취소 처리 - Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}`)

  // 배송이 취소된 경우 Amazon에 알려야 할 수 있음
  logger.debug(`배송 취소 - Amazon 동기화 검토 필요 - Fulfillment: ${fulfillmentData.id}, Order: ${fulfillmentData.order_id}`)
}

/**
 * 주문에 Amazon 동기화된 상품이 포함되어 있는지 확인
 */
async function checkIfOrderHasAmazonProducts(
  orderData: OrderEventData,
  logger: Logger
): Promise<boolean> {
  // TODO: 실제 구현에서는 주문 아이템들의 상품 ID를 확인하여
  // Amazon 동기화 레코드가 있는지 확인해야 함
  
  if (!orderData.items || orderData.items.length === 0) {
    return false
  }

  // 임시로 true 반환 (실제로는 각 상품별로 동기화 상태 확인 필요)
  logger.debug(`주문 상품 Amazon 동기화 상태 확인 필요 - Order: ${orderData.id}, Items: ${orderData.items.length}, Products: ${orderData.items.map(item => item.product_id).join(', ')}`)

  return true
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.completed",
    "order.canceled",
    "fulfillment.created",
    "fulfillment.shipped",
    "fulfillment.canceled"
  ],
} 