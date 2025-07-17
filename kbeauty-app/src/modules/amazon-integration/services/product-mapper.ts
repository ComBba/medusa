import { ProductDTO } from "@medusajs/framework/types"
import { AmazonProductData, AmazonMarketplaceConfig } from '../types'

/**
 * K-뷰티 상품 카테고리 매핑
 */
const KBEAUTY_CATEGORY_MAPPING = {
  'skincare': 'Beauty',
  'makeup': 'Beauty', 
  'haircare': 'Beauty',
  'bodycare': 'Beauty',
  'tools': 'Beauty',
  'face-mask': 'Beauty',
  'serum': 'Beauty',
  'cream': 'Beauty',
  'cleanser': 'Beauty',
  'toner': 'Beauty',
  'sunscreen': 'Beauty'
}

/**
 * Amazon 상품 타입 매핑 (Beauty 카테고리)
 */
const AMAZON_PRODUCT_TYPE_MAPPING = {
  'skincare': 'BEAUTY',
  'makeup': 'BEAUTY', 
  'haircare': 'BEAUTY',
  'bodycare': 'BEAUTY',
  'tools': 'BEAUTY',
  'face-mask': 'BEAUTY',
  'serum': 'BEAUTY',
  'cream': 'BEAUTY',
  'cleanser': 'BEAUTY',
  'toner': 'BEAUTY',
  'sunscreen': 'BEAUTY'
}

/**
 * Medusa 상품을 Amazon 포맷으로 변환하는 서비스
 */
export class ProductMapperService {
  
  /**
   * Medusa 상품을 Amazon 상품 데이터로 변환
   */
  static mapMedusaToAmazon(
    medusaProduct: ProductDTO, 
    marketplace: AmazonMarketplaceConfig
  ): AmazonProductData {
    
    // SKU 생성 (kbeauty 접두어 + Medusa 상품 ID)
    const sku = `kbeauty-${medusaProduct.id}`
    
    // 카테고리 매핑
    const category = this.mapCategory(medusaProduct)
    const productType = this.mapProductType(medusaProduct)
    
    // 가격 정보 (첫 번째 variant의 가격 사용)
    const price = this.extractPrice(medusaProduct, marketplace.currency_code)
    
    // 이미지 URLs 추출
    const images = this.extractImages(medusaProduct)
    
    // 상품 설명 생성 (K-뷰티 특화)
    const description = this.generateKBeautyDescription(medusaProduct)
    
    // 상품 제목 최적화 (SEO 고려)
    const title = this.optimizeTitle(medusaProduct, marketplace.country_code)
    
    return {
      sku,
      title,
      description,
      brand: this.extractBrand(medusaProduct),
      manufacturer: 'kbeauty.market',
      category,
      product_type: productType,
      price,
      currency: marketplace.currency_code,
      quantity: this.calculateTotalQuantity(medusaProduct),
      images,
      attributes: this.generateAttributes(medusaProduct),
      shipping_weight: medusaProduct.weight || 0.1, // 기본 100g
      dimensions: {
        length: medusaProduct.length || 10,
        width: medusaProduct.width || 10, 
        height: medusaProduct.height || 5
      }
    }
  }

  /**
   * 카테고리 매핑
   */
  private static mapCategory(product: ProductDTO): string {
    // 상품 카테고리나 태그에서 K-뷰티 카테고리 추출
    const categories = product.categories || []
    const tags = product.tags || []
    
    for (const category of categories) {
      const categoryName = category.name?.toLowerCase()
      if (categoryName && KBEAUTY_CATEGORY_MAPPING[categoryName]) {
        return KBEAUTY_CATEGORY_MAPPING[categoryName]
      }
    }
    
    for (const tag of tags) {
      const tagValue = tag.value?.toLowerCase()
      if (tagValue && KBEAUTY_CATEGORY_MAPPING[tagValue]) {
        return KBEAUTY_CATEGORY_MAPPING[tagValue]
      }
    }
    
    return 'Beauty' // 기본값
  }

  /**
   * Amazon 상품 타입 매핑
   */
  private static mapProductType(product: ProductDTO): string {
    const categories = product.categories || []
    const tags = product.tags || []
    
    for (const category of categories) {
      const categoryName = category.name?.toLowerCase()
      if (categoryName && AMAZON_PRODUCT_TYPE_MAPPING[categoryName]) {
        return AMAZON_PRODUCT_TYPE_MAPPING[categoryName]
      }
    }
    
    for (const tag of tags) {
      const tagValue = tag.value?.toLowerCase()
      if (tagValue && AMAZON_PRODUCT_TYPE_MAPPING[tagValue]) {
        return AMAZON_PRODUCT_TYPE_MAPPING[tagValue]
      }
    }
    
    return 'BEAUTY' // 기본값
  }

  /**
   * 가격 추출 (지역별 통화 고려)
   */
  private static extractPrice(product: ProductDTO, currencyCode: string): number {
    const variants = product.variants || []
    
    if (variants.length === 0) {
      return 0
    }
    
    // 첫 번째 variant의 가격 사용
    const firstVariant = variants[0]
    const prices = firstVariant.prices || []
    
    // 해당 통화의 가격 찾기
    const targetPrice = prices.find(price => 
      price.currency_code?.toUpperCase() === currencyCode.toUpperCase()
    )
    
    if (targetPrice) {
      return targetPrice.amount / 100 // cents to dollars
    }
    
    // USD 가격이 있으면 기본 환율로 변환 (간단한 구현)
    const usdPrice = prices.find(price => 
      price.currency_code?.toUpperCase() === 'USD'
    )
    
    if (usdPrice) {
      return this.convertCurrency(usdPrice.amount / 100, 'USD', currencyCode)
    }
    
    return 0
  }

  /**
   * 간단한 환율 변환 (실제로는 실시간 환율 API 사용 권장)
   */
  private static convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    const exchangeRates: Record<string, number> = {
      'USD_EUR': 0.85,
      'USD_GBP': 0.75,
      'USD_JPY': 110,
      'USD_KRW': 1300,
      'USD_CAD': 1.25,
      'USD_AUD': 1.35
    }
    
    const key = `${fromCurrency}_${toCurrency}`
    const rate = exchangeRates[key] || 1
    
    return amount * rate
  }

  /**
   * 이미지 URLs 추출
   */
  private static extractImages(product: ProductDTO): string[] {
    const images = product.images || []
    return images.map(img => img.url).filter(Boolean) as string[]
  }

  /**
   * K-뷰티 특화 상품 설명 생성
   */
  private static generateKBeautyDescription(product: ProductDTO): string {
    let description = product.description || ''
    
    // K-뷰티 키워드 추가
    const kbeautyKeywords = [
      'Korean Beauty',
      'K-Beauty', 
      'Korean Skincare',
      'Premium Quality',
      'Natural Ingredients'
    ]
    
    // 기존 설명에 K-뷰티 키워드가 없으면 추가
    const hasKBeautyKeywords = kbeautyKeywords.some(keyword => 
      description.toLowerCase().includes(keyword.toLowerCase())
    )
    
    if (!hasKBeautyKeywords) {
      description = `${description}\n\nAuthentic Korean Beauty (K-Beauty) product from kbeauty.market. Premium quality skincare with natural ingredients.`
    }
    
    return description.substring(0, 2000) // Amazon 설명 길이 제한
  }

  /**
   * 상품 제목 최적화 (지역별 SEO 고려)
   */
  private static optimizeTitle(product: ProductDTO, countryCode: string): string {
    let title = product.title || ''
    
    // 지역별 키워드 최적화
    const regionKeywords: Record<string, string[]> = {
      'US': ['Korean', 'K-Beauty', 'Skincare'],
      'JP': ['韓国', 'K-Beauty', 'スキンケア'],
      'DE': ['Koreanisch', 'K-Beauty', 'Hautpflege'],
      'UK': ['Korean', 'K-Beauty', 'Skincare'],
      'FR': ['Coréen', 'K-Beauty', 'Soin'],
      'IT': ['Coreano', 'K-Beauty', 'Skincare'],
      'ES': ['Coreano', 'K-Beauty', 'Cuidado']
    }
    
    const keywords = regionKeywords[countryCode] || regionKeywords['US']
    
    // 제목에 핵심 키워드가 없으면 추가
    if (!keywords.some(keyword => title.includes(keyword))) {
      title = `${keywords[0]} ${title}`
    }
    
    return title.substring(0, 150) // Amazon 제목 길이 제한
  }

  /**
   * 브랜드명 추출
   */
  private static extractBrand(product: ProductDTO): string {
    // 메타데이터에서 브랜드 정보 추출
    const metadata = product.metadata as Record<string, any> || {}
    
    if (metadata.brand) {
      return metadata.brand
    }
    
    // 상품 타입에서 브랜드 추출
    if (product.type?.value) {
      return product.type.value
    }
    
    return 'kbeauty.market' // 기본 브랜드명
  }

  /**
   * 총 재고 수량 계산
   */
  private static calculateTotalQuantity(product: ProductDTO): number {
    const variants = product.variants || []
    let totalQuantity = 0
    
    for (const variant of variants) {
      // 재고 정보가 있으면 합산
      if (variant.inventory_quantity) {
        totalQuantity += variant.inventory_quantity
      }
    }
    
    return totalQuantity || 1 // 최소 1개
  }

  /**
   * Amazon 속성 생성
   */
  private static generateAttributes(product: ProductDTO): Record<string, any> {
    const attributes: Record<string, any> = {}
    
    // 기본 속성
    attributes['item_package_quantity'] = 1
    attributes['manufacturer'] = 'kbeauty.market'
    attributes['country_of_origin'] = 'KR' // 한국
    
    // 메타데이터에서 추가 속성 추출
    const metadata = product.metadata as Record<string, any> || {}
    
    // 성분 정보
    if (metadata.ingredients) {
      attributes['ingredients'] = metadata.ingredients
    }
    
    // 사용법
    if (metadata.usage) {
      attributes['directions'] = metadata.usage
    }
    
    // 피부 타입
    if (metadata.skin_type) {
      attributes['skin_type'] = metadata.skin_type
    }
    
    // 용량/크기
    if (metadata.size || metadata.volume) {
      attributes['size'] = metadata.size || metadata.volume
    }
    
    return attributes
  }

  /**
   * 다중 마켓플레이스를 위한 배치 변환
   */
  static mapToMultipleMarketplaces(
    medusaProduct: ProductDTO,
    marketplaces: AmazonMarketplaceConfig[]
  ): AmazonProductData[] {
    return marketplaces.map(marketplace => 
      this.mapMedusaToAmazon(medusaProduct, marketplace)
    )
  }
}

export default ProductMapperService 