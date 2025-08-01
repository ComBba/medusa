import { ProductVariantDTO } from "@medusajs/framework/types"
import { AmazonPriceData, AmazonMarketplaceConfig } from '../types/index'

/**
 * Medusa 가격 정보를 Amazon 포맷으로 변환하는 서비스
 */
export class PriceMapperService {
  
  /**
   * Medusa 가격 데이터를 Amazon 가격 포맷으로 변환
   */
  static mapMedusaToAmazon(
    pricingData: {
      variant_id: string
      sku: string
      currency_code: string
      amount: number
      compare_at_amount?: number
      price_set_id: string
      price_rules?: any[]
    },
    variant: ProductVariantDTO,
    marketplace: AmazonMarketplaceConfig
  ): AmazonPriceData {
    
    // Amazon 요구사항에 맞는 SKU 생성
    const amazonSku = this.formatSKUForAmazon(variant.sku || variant.id)
    
    // 가격을 마켓플레이스 통화로 변환
    const convertedPrice = this.convertCurrency(
      pricingData.amount,
      pricingData.currency_code,
      marketplace.currency_code || 'USD'
    )
    
    const convertedCompareAtPrice = pricingData.compare_at_amount 
      ? this.convertCurrency(
          pricingData.compare_at_amount,
          pricingData.currency_code,
          marketplace.currency_code || 'USD'
        )
      : undefined
    
    // Amazon 가격 포맷으로 변환 (센트 단위를 달러 단위로)
    const standardPrice = this.formatPriceForAmazon(convertedPrice, marketplace.currency_code || 'USD')
    const salePrice = convertedCompareAtPrice && convertedCompareAtPrice < convertedPrice
      ? this.formatPriceForAmazon(convertedPrice, marketplace.currency_code || 'USD')
      : undefined
    const listPrice = convertedCompareAtPrice && convertedCompareAtPrice > convertedPrice
      ? this.formatPriceForAmazon(convertedCompareAtPrice, marketplace.currency_code || 'USD')
      : undefined
    
    // 세일 기간 설정
    const saleStartDate = this.getSaleStartDate(pricingData.price_rules)
    const saleEndDate = this.getSaleEndDate(pricingData.price_rules)
    
    return {
      // 기본 식별자
      sku: amazonSku,
      marketplace_id: marketplace.marketplace_id,
      currency: marketplace.currency_code || 'USD',
      
      // 가격 정보
      standard_price: standardPrice,
      list_price: listPrice,
      sale_price: salePrice,
      
      // 세일 기간
      sale_start_date: saleStartDate,
      sale_end_date: saleEndDate,
      
      // 최소/최대 주문 수량
      minimum_seller_allowed_price: this.getMinimumPrice(standardPrice, marketplace),
      maximum_seller_allowed_price: this.getMaximumPrice(standardPrice, marketplace),
      
      // 가격 유형
      pricing_action: salePrice ? "PartialUpdate" : "PartialUpdate",
      price_type: "Standard",
      
      // K-Beauty 특화 설정
      business_price: this.getBusinessPrice(standardPrice, marketplace),
      quantity_break_type: this.getQuantityBreakType(pricingData.price_rules),
      quantity_discounts: this.getQuantityDiscounts(pricingData.price_rules, standardPrice),
      
      // 메타데이터
      last_updated: new Date().toISOString(),
      sync_source: "medusa",
      medusa_variant_id: variant.id,
      medusa_price_data: {
        price_set_id: pricingData.price_set_id,
        amount: typeof pricingData.amount === 'object' ? pricingData.amount : { numeric: pricingData.amount },
        currency_code: pricingData.currency_code
      }
    }
  }
  
  /**
   * SKU를 Amazon 요구사항에 맞게 포맷팅
   */
  private static formatSKUForAmazon(sku: string): string {
    let formattedSku = sku
      .replace(/[^a-zA-Z0-9\-_.]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    if (formattedSku.length > 40) {
      formattedSku = formattedSku.substring(0, 40)
    }
    
    return formattedSku
  }
  
  /**
   * 통화 변환 (실제 환율 API 연동 필요)
   */
  private static convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return amount
    }
    
    // TODO: 실제 환율 API (예: Exchange Rates API, Fixer.io) 연동
    // 임시로 간단한 환율 매핑 사용
    const exchangeRates = {
      'USD': { 'EUR': 0.85, 'GBP': 0.73, 'JPY': 110, 'CAD': 1.25, 'AUD': 1.35 },
      'EUR': { 'USD': 1.18, 'GBP': 0.86, 'JPY': 129, 'CAD': 1.47, 'AUD': 1.59 },
      'GBP': { 'USD': 1.37, 'EUR': 1.16, 'JPY': 151, 'CAD': 1.71, 'AUD': 1.85 },
      'JPY': { 'USD': 0.009, 'EUR': 0.008, 'GBP': 0.007, 'CAD': 0.011, 'AUD': 0.012 },
      'CAD': { 'USD': 0.80, 'EUR': 0.68, 'GBP': 0.58, 'JPY': 88, 'AUD': 1.08 },
      'AUD': { 'USD': 0.74, 'EUR': 0.63, 'GBP': 0.54, 'JPY': 81, 'CAD': 0.93 }
    }
    
    const rate = exchangeRates[fromCurrency]?.[toCurrency]
    if (rate) {
      return Math.round(amount * rate)
    }
    
    console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}, using 1:1`)
    return amount
  }
  
  /**
   * 가격을 Amazon 형식으로 포맷 (센트 → 달러)
   */
  private static formatPriceForAmazon(amountInCents: number, currency: string): string {
    // JPY는 소수점이 없음
    if (currency === 'JPY') {
      return amountInCents.toString()
    }
    
    // 다른 통화는 센트를 달러로 변환 (100센트 = 1달러)
    const dollars = amountInCents / 100
    return dollars.toFixed(2)
  }
  
  /**
   * 세일 시작일 계산
   */
  private static getSaleStartDate(priceRules?: any[]): string | undefined {
    if (!priceRules || priceRules.length === 0) return undefined
    
    // 현재 활성화된 프로모션 찾기
    const activeRule = priceRules.find(rule => 
      rule.starts_at && new Date(rule.starts_at) <= new Date()
    )
    
    return activeRule?.starts_at
  }
  
  /**
   * 세일 종료일 계산
   */
  private static getSaleEndDate(priceRules?: any[]): string | undefined {
    if (!priceRules || priceRules.length === 0) return undefined
    
    const activeRule = priceRules.find(rule => 
      rule.ends_at && new Date(rule.ends_at) > new Date()
    )
    
    return activeRule?.ends_at
  }
  
  /**
   * 최소 허용 가격 계산 (Amazon 정책에 따라)
   */
  private static getMinimumPrice(standardPrice: string, marketplace: AmazonMarketplaceConfig): string {
    const price = parseFloat(standardPrice)
    // 일반적으로 표준 가격의 50% 이하로는 설정하지 않음
    const minPrice = price * 0.5
    return minPrice.toFixed(2)
  }
  
  /**
   * 최대 허용 가격 계산
   */
  private static getMaximumPrice(standardPrice: string, marketplace: AmazonMarketplaceConfig): string {
    const price = parseFloat(standardPrice)
    // 일반적으로 표준 가격의 200% 이상으로는 설정하지 않음
    const maxPrice = price * 2.0
    return maxPrice.toFixed(2)
  }
  
  /**
   * 비즈니스 가격 설정 (B2B 고객용)
   */
  private static getBusinessPrice(standardPrice: string, marketplace: AmazonMarketplaceConfig): string | undefined {
    // B2B 할인이 설정된 경우
    if (marketplace.b2b_discount_percentage) {
      const price = parseFloat(standardPrice)
      const discountedPrice = price * (1 - marketplace.b2b_discount_percentage / 100)
      return discountedPrice.toFixed(2)
    }
    
    return undefined
  }
  
  /**
   * 수량 할인 유형 결정
   */
  private static getQuantityBreakType(priceRules?: any[]): "percent" | "fixed" | undefined {
    if (!priceRules || priceRules.length === 0) return undefined
    
    const quantityRule = priceRules.find(rule => rule.type === 'quantity_discount')
    if (quantityRule) {
      return quantityRule.value_type === 'percentage' ? 'percent' : 'fixed'
    }
    
    return undefined
  }
  
  /**
   * 수량별 할인 가격 계산
   */
  private static getQuantityDiscounts(priceRules?: any[], standardPrice?: string): Array<{
    quantity_lower_bound: number
    quantity_price: string
  }> | undefined {
    
    if (!priceRules || priceRules.length === 0 || !standardPrice) return undefined
    
    const quantityRules = priceRules.filter(rule => rule.type === 'quantity_discount')
    if (quantityRules.length === 0) return undefined
    
    const basePrice = parseFloat(standardPrice)
    
    return quantityRules.map(rule => {
      let discountedPrice: number
      
      if (rule.value_type === 'percentage') {
        discountedPrice = basePrice * (1 - rule.value / 100)
      } else {
        discountedPrice = basePrice - (rule.value / 100) // Medusa는 센트 단위
      }
      
      return {
        quantity_lower_bound: rule.min_quantity || 1,
        quantity_price: Math.max(0, discountedPrice).toFixed(2)
      }
    }).sort((a, b) => a.quantity_lower_bound - b.quantity_lower_bound)
  }
  
  /**
   * 가격 업데이트 배치 생성
   */
  static createPricingBatch(
    pricingUpdates: Array<{
      pricingData: any
      variant: ProductVariantDTO
      marketplace: AmazonMarketplaceConfig
    }>
  ): AmazonPriceData[] {
    
    return pricingUpdates.map(update => 
      this.mapMedusaToAmazon(
        update.pricingData,
        update.variant,
        update.marketplace
      )
    )
  }
  
  /**
   * 가격 동기화를 위한 Amazon Feed XML 생성
   */
  static generatePriceFeedXML(priceData: AmazonPriceData[]): string {
    const timestamp = new Date().toISOString()
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>MERCHANT_ID</MerchantIdentifier>
  </Header>
  <MessageType>Price</MessageType>
  <PurgeAndReplace>false</PurgeAndReplace>
`

    priceData.forEach((price, index) => {
      xml += `
  <Message>
    <MessageID>${index + 1}</MessageID>
    <Price>
      <SKU>${price.sku}</SKU>
      <StandardPrice currency="${price.currency}">${price.standard_price}</StandardPrice>
      ${price.sale_price ? `<Sale>
        <StartDate>${price.sale_start_date}</StartDate>
        <EndDate>${price.sale_end_date}</EndDate>
        <SalePrice currency="${price.currency}">${price.sale_price}</SalePrice>
      </Sale>` : ''}
      ${price.business_price ? `<BusinessPrice currency="${price.currency}">${price.business_price}</BusinessPrice>` : ''}
    </Price>
  </Message>`
    })

    xml += `
</AmazonEnvelope>`

    return xml
  }
  
  /**
   * 가격 데이터 유효성 검사
   */
  static validatePriceData(priceData: AmazonPriceData): { 
    isValid: boolean
    errors: string[] 
  } {
    const errors: string[] = []
    
    // 필수 필드 검사
    if (!priceData.sku || priceData.sku.length === 0) {
      errors.push("SKU는 필수입니다")
    }
    
    if (!priceData.standard_price || parseFloat(priceData.standard_price) <= 0) {
      errors.push("표준 가격은 0보다 커야 합니다")
    }
    
    if (!priceData.currency) {
      errors.push("통화 코드는 필수입니다")
    }
    
    // 가격 범위 검사
    const standardPrice = parseFloat(priceData.standard_price || '0')
    
    if (priceData.sale_price) {
      const salePrice = parseFloat(priceData.sale_price)
      if (salePrice >= standardPrice) {
        errors.push("세일 가격은 표준 가격보다 낮아야 합니다")
      }
    }
    
    if (priceData.list_price) {
      const listPrice = parseFloat(priceData.list_price)
      if (listPrice <= standardPrice) {
        errors.push("정가는 표준 가격보다 높아야 합니다")
      }
    }
    
    // 통화 코드 검사
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
    if (priceData.currency && !validCurrencies.includes(priceData.currency)) {
      errors.push(`지원되지 않는 통화입니다: ${priceData.currency}`)
    }
    
    // 세일 기간 검사
    if (priceData.sale_start_date && priceData.sale_end_date) {
      const startDate = new Date(priceData.sale_start_date)
      const endDate = new Date(priceData.sale_end_date)
      
      if (endDate <= startDate) {
        errors.push("세일 종료일은 시작일보다 늦어야 합니다")
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  /**
   * 마켓플레이스별 가격 현지화
   */
  static localizePrice(
    price: number,
    fromCurrency: string,
    marketplace: AmazonMarketplaceConfig
  ): { amount: string, currency: string } {
    const targetCurrency = marketplace.currency_code || 'USD'
    const convertedAmount = this.convertCurrency(price, fromCurrency, targetCurrency)
    const formattedAmount = this.formatPriceForAmazon(convertedAmount, targetCurrency)
    
    return {
      amount: formattedAmount,
      currency: targetCurrency
    }
  }
}

export default PriceMapperService