export interface AmazonMarketplaceConfig {
  marketplace_id: string
  country_code: string
  name: string
  currency_code: string
  region: string
  endpoint: string
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

export type AmazonRegion = "NA" | "EU" | "FE" // North America, Europe, Far East

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