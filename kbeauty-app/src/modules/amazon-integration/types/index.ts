export interface AmazonMarketplaceConfig {
  marketplace_id: string
  country_code: string
  name: string
  currency_code: string
  region: string
  endpoint: string
  
  // FBA/Fulfillment 설정
  use_fba?: boolean
  fulfillment_center_id?: string
  handling_time?: number
  lead_time_to_ship?: number
  merchant_shipping_group?: string
  
  // 재고 관리 설정
  default_restock_days?: number
  
  // B2B 설정
  b2b_discount_percentage?: number
  
  // 동기화 설정
  is_active?: boolean
  seller_id?: string
  mws_token?: string
}

export interface AmazonCredentials {
  seller_id: string
  marketplace_id: string
  access_key?: string
  secret_key?: string
  role_arn?: string
  refresh_token?: string
  client_id?: string
  client_secret?: string
}

export interface AmazonProductData {
  sku: string
  title: string
  description?: string
  brand?: string
  manufacturer?: string
  category?: string
  product_type: string
  price: number
  currency: string
  quantity?: number
  images?: string[]
  attributes?: Record<string, any>
  shipping_weight?: number
  dimensions?: {
    length?: number
    width?: number
    height?: number
  }
}

export interface AmazonSyncResult {
  success: boolean
  asin?: string
  sku?: string
  feed_submission_id?: string
  error?: {
    code: string
    message: string
  }
}

export type SyncStatus = "pending" | "processing" | "completed" | "failed" | "cancelled"

export type SyncType = "product" | "inventory" | "price" | "all"

export type AmazonRegion = "NA" | "EU" | "FE" // North America, Europe, Far East

export interface AmazonInventoryData {
  sku: string
  marketplace_id: string
  quantity: number
  fulfillment_availability?: {
    fulfillment_network: "AMAZON" | "MERCHANT"
    total_quantity: number
    available_quantity: number
    inbound_quantity?: number
    reserved_quantity?: number
    pending_quantity?: number
  }
  is_fba?: boolean
  fulfillment_center_id?: string
  handling_time: number
  restock_date?: string | null
  leadtime_to_ship: number
  merchant_shipping_group: string
  last_updated: string
  sync_source: string
  medusa_variant_id: string
  medusa_inventory_item_id: string
}

export interface AmazonPriceData {
  sku: string
  marketplace_id: string
  currency: string
  standard_price: string
  list_price?: string
  sale_price?: string
  sale_start_date?: string
  sale_end_date?: string
  minimum_seller_allowed_price?: string
  maximum_seller_allowed_price?: string
  pricing_action: string
  price_type: string
  business_price?: string
  quantity_break_type?: "percent" | "fixed"
  quantity_discounts?: Array<{
    quantity_lower_bound: number
    quantity_price: string
  }>
  last_updated: string
  sync_source: string
  medusa_variant_id: string
  // Medusa v2에서는 pricing이 별도 관계로 관리됨
  medusa_price_data?: {
    price_set_id?: string
    amount?: BigNumberValue
    currency_code?: string
    region_id?: string
  }
}

// Medusa v2 BigNumberValue 타입 정의
export interface BigNumberValue {
  numeric: number
  raw?: any
  bigNumber?: any
}

// Medusa v2 호환 가격 정보 타입
export interface MedusaPriceInfo {
  id: string
  amount: BigNumberValue
  currency_code: string
  min_quantity?: BigNumberValue | null
  max_quantity?: BigNumberValue | null
  price_set?: {
    id: string
  } | null
}

// 임시 타입 확장 (점진적 개선을 위해)
export interface ExtendedProductVariantDTO {
  id: string
  title: string
  sku: string | null
  price_set_id?: string
  [key: string]: any // 유연한 타입 처리
}

export interface ExtendedMoneyAmountDTO {
  id: string
  currency_code: string
  amount: BigNumberValue | number
  compare_at_amount?: BigNumberValue | number | null
  [key: string]: any
}

export interface ExtendedPriceSetDTO {
  id: string
  prices?: ExtendedMoneyAmountDTO[]
  price_rules?: any
  [key: string]: any
}

// 성공률 통계 타입
export interface SyncSuccessRateStats {
  total_syncs: number
  successful_syncs: number
  failed_syncs: number
  pending_syncs: number
  processing_syncs: number
  success_rate?: number // 추가 필드
}

export interface AmazonAPIResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  pagination?: {
    next_token?: string
    has_more?: boolean
  }
} 