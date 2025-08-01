import { ProductVariantDTO } from "@medusajs/framework/types"
import { AmazonInventoryData, AmazonMarketplaceConfig } from '../types/index'

/**
 * Medusa 재고 정보를 Amazon 포맷으로 변환하는 서비스
 */
export class InventoryMapperService {
  
  /**
   * Medusa 재고 데이터를 Amazon 재고 포맷으로 변환
   */
  static mapMedusaToAmazon(
    inventoryData: {
      variant_id: string
      sku: string
      inventory_item_id: string
      quantity: number
      reserved_quantity: number
      available_quantity: number
    },
    variant: ProductVariantDTO,
    marketplace: AmazonMarketplaceConfig
  ): AmazonInventoryData {
    
    // Amazon 요구사항에 맞는 SKU 생성 (특수문자 제거 및 길이 제한)
    const amazonSku = this.formatSKUForAmazon(variant.sku || variant.id)
    
    // 재고 수량 계산 (예약된 수량 제외)
    const availableQuantity = Math.max(0, inventoryData.available_quantity)
    
    // 재고 상태 결정
    const fulfillmentCenterStock = this.calculateFulfillmentStock(
      availableQuantity,
      marketplace
    )
    
    return {
      // 기본 식별자
      sku: amazonSku,
      marketplace_id: marketplace.marketplace_id,
      
      // 재고 수량 정보
      quantity: availableQuantity,
      fulfillment_availability: fulfillmentCenterStock,
      
      // Amazon Fulfillment 정보
      is_fba: marketplace.use_fba || false,
      fulfillment_center_id: marketplace.fulfillment_center_id,
      
      // 재고 운영 정보
      handling_time: this.getHandlingTime(marketplace),
      restock_date: this.getRestockDate(inventoryData, marketplace),
      
      // 재고 임계값 설정
      leadtime_to_ship: this.getLeadTimeToShip(marketplace),
      merchant_shipping_group: this.getMerchantShippingGroup(marketplace),
      
      // 메타데이터
      last_updated: new Date().toISOString(),
      sync_source: "medusa",
      medusa_variant_id: variant.id,
      medusa_inventory_item_id: inventoryData.inventory_item_id
    }
  }
  
  /**
   * SKU를 Amazon 요구사항에 맞게 포맷팅
   */
  private static formatSKUForAmazon(sku: string): string {
    // Amazon SKU 요구사항:
    // - 최대 40자
    // - 영숫자, 하이픈(-), 밑줄(_), 점(.)만 허용
    // - 공백 제거
    
    let formattedSku = sku
      .replace(/[^a-zA-Z0-9\-_.]/g, '-') // 허용되지 않는 문자를 하이픈으로 변경
      .replace(/\s+/g, '-') // 공백을 하이픈으로 변경
      .replace(/-+/g, '-') // 연속된 하이픈을 하나로 통합
      .replace(/^-|-$/g, '') // 시작과 끝의 하이픈 제거
    
    // 길이 제한 (40자)
    if (formattedSku.length > 40) {
      formattedSku = formattedSku.substring(0, 40)
    }
    
    return formattedSku
  }
  
  /**
   * 배송센터별 재고 분배 계산
   */
  private static calculateFulfillmentStock(
    totalQuantity: number,
    marketplace: AmazonMarketplaceConfig
  ) {
    // FBA 사용 시와 MF (Merchant Fulfilled) 시 다른 로직
    if (marketplace.use_fba) {
      return {
        fulfillment_network: "AMAZON" as const,
        total_quantity: totalQuantity,
        available_quantity: totalQuantity,
        inbound_quantity: 0,
        reserved_quantity: 0
      }
    } else {
      return {
        fulfillment_network: "MERCHANT" as const,
        total_quantity: totalQuantity,
        available_quantity: totalQuantity,
        pending_quantity: 0,
        reserved_quantity: 0
      }
    }
  }
  
  /**
   * 처리 시간 계산 (영업일 기준)
   */
  private static getHandlingTime(marketplace: AmazonMarketplaceConfig): number {
    // 마켓플레이스별 기본 처리 시간
    const defaultHandlingTimes = {
      'ATVPDKIKX0DER': 2, // US
      'A1PA6795UKMFR9': 2, // DE
      'A1VC38T7YXB528': 1, // JP
      'A1F83G8C2ARO7P': 2, // UK
      'A13V1IB3VIYZZH': 2, // FR
      'APJ6JRA9NG5V4': 2,  // IT
      'A1RKKUPIHCS9HS': 2, // ES
      'A2EUQ1WTGCTBG2': 2, // CA
      'A39IBJ37TRP1C6': 2  // AU
    }
    
    return marketplace.handling_time || 
           defaultHandlingTimes[marketplace.marketplace_id] || 
           2 // 기본값 2일
  }
  
  /**
   * 재입고 예상일 계산
   */
  private static getRestockDate(
    inventoryData: any,
    marketplace: AmazonMarketplaceConfig
  ): string | null {
    // 재고가 0인 경우 재입고 예상일 설정
    if (inventoryData.available_quantity <= 0) {
      const restockDays = marketplace.default_restock_days || 7
      const restockDate = new Date()
      restockDate.setDate(restockDate.getDate() + restockDays)
      return restockDate.toISOString().split('T')[0] // YYYY-MM-DD 형식
    }
    
    return null
  }
  
  /**
   * 리드타임 계산
   */
  private static getLeadTimeToShip(marketplace: AmazonMarketplaceConfig): number {
    // 마켓플레이스별 기본 리드타임 (일 단위)
    const defaultLeadTimes = {
      'ATVPDKIKX0DER': 1, // US - 빠른 배송
      'A1PA6795UKMFR9': 2, // DE
      'A1VC38T7YXB528': 1, // JP - 빠른 배송
      'A1F83G8C2ARO7P': 2, // UK
      'A13V1IB3VIYZZH': 2, // FR
      'APJ6JRA9NG5V4': 2,  // IT
      'A1RKKUPIHCS9HS': 2, // ES
      'A2EUQ1WTGCTBG2': 2, // CA
      'A39IBJ37TRP1C6': 3  // AU - 더 긴 배송
    }
    
    return marketplace.lead_time_to_ship || 
           defaultLeadTimes[marketplace.marketplace_id] || 
           2 // 기본값 2일
  }
  
  /**
   * 배송 그룹 설정
   */
  private static getMerchantShippingGroup(marketplace: AmazonMarketplaceConfig): string {
    // K-Beauty 제품에 특화된 배송 그룹
    if (marketplace.use_fba) {
      return "FBA_DEFAULT"
    }
    
    // 마켓플레이스별 배송 그룹
    const shippingGroups = {
      'ATVPDKIKX0DER': 'BEAUTY_US', // US
      'A1PA6795UKMFR9': 'BEAUTY_EU', // DE
      'A1VC38T7YXB528': 'BEAUTY_JP', // JP
      'A1F83G8C2ARO7P': 'BEAUTY_UK', // UK
      'A13V1IB3VIYZZH': 'BEAUTY_EU', // FR
      'APJ6JRA9NG5V4': 'BEAUTY_EU',  // IT
      'A1RKKUPIHCS9HS': 'BEAUTY_EU', // ES
      'A2EUQ1WTGCTBG2': 'BEAUTY_CA', // CA
      'A39IBJ37TRP1C6': 'BEAUTY_AU'  // AU
    }
    
    return marketplace.merchant_shipping_group || 
           shippingGroups[marketplace.marketplace_id] || 
           'BEAUTY_DEFAULT'
  }
  
  /**
   * 재고 업데이트 배치 생성 (여러 상품을 한번에 처리)
   */
  static createInventoryBatch(
    inventoryUpdates: Array<{
      inventoryData: any
      variant: ProductVariantDTO
      marketplace: AmazonMarketplaceConfig
    }>
  ): AmazonInventoryData[] {
    
    return inventoryUpdates.map(update => 
      this.mapMedusaToAmazon(
        update.inventoryData,
        update.variant,
        update.marketplace
      )
    )
  }
  
  /**
   * 재고 동기화를 위한 Amazon Feed XML 생성
   */
  static generateInventoryFeedXML(inventoryData: AmazonInventoryData[]): string {
    const timestamp = new Date().toISOString()
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>MERCHANT_ID</MerchantIdentifier>
  </Header>
  <MessageType>Inventory</MessageType>
  <PurgeAndReplace>false</PurgeAndReplace>
`

    inventoryData.forEach((inventory, index) => {
      xml += `
  <Message>
    <MessageID>${index + 1}</MessageID>
    <Inventory>
      <SKU>${inventory.sku}</SKU>
      <Quantity>${inventory.quantity}</Quantity>
      <FulfillmentLatency>${inventory.handling_time}</FulfillmentLatency>
      ${inventory.restock_date ? `<RestockDate>${inventory.restock_date}</RestockDate>` : ''}
    </Inventory>
  </Message>`
    })

    xml += `
</AmazonEnvelope>`

    return xml
  }
  
  /**
   * 재고 상태 유효성 검사
   */
  static validateInventoryData(inventoryData: AmazonInventoryData): { 
    isValid: boolean
    errors: string[] 
  } {
    const errors: string[] = []
    
    // 필수 필드 검사
    if (!inventoryData.sku || inventoryData.sku.length === 0) {
      errors.push("SKU는 필수입니다")
    }
    
    if (inventoryData.sku && inventoryData.sku.length > 40) {
      errors.push("SKU는 40자 이하여야 합니다")
    }
    
    if (inventoryData.quantity < 0) {
      errors.push("재고 수량은 0 이상이어야 합니다")
    }
    
    if (inventoryData.handling_time < 0 || inventoryData.handling_time > 30) {
      errors.push("처리 시간은 0-30일 사이여야 합니다")
    }
    
    // Amazon SKU 형식 검사
    const skuPattern = /^[a-zA-Z0-9\-_.]+$/
    if (inventoryData.sku && !skuPattern.test(inventoryData.sku)) {
      errors.push("SKU는 영숫자, 하이픈(-), 밑줄(_), 점(.)만 포함할 수 있습니다")
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

export default InventoryMapperService