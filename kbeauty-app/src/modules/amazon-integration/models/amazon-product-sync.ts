import { model } from "@medusajs/framework/utils"

/**
 * Medusa 상품과 Amazon 상품 간의 동기화 상태 추적
 */
const AmazonProductSync = model.define("amazon_product_sync", {
  id: model.id().primaryKey(),
  
  // 연관 정보
  medusa_product_id: model.text(), // Medusa 상품 ID
  amazon_marketplace_id: model.text(), // Amazon 마켓플레이스 ID
  
  // Amazon 상품 정보
  amazon_asin: model.text().nullable(), // Amazon Standard Identification Number
  amazon_sku: model.text().nullable(), // Stock Keeping Unit
  amazon_listing_id: model.text().nullable(),
  
  // 동기화 상태
  sync_status: model.enum([
    "pending",    // 동기화 대기
    "processing", // 동기화 진행 중
    "completed",  // 동기화 완료
    "failed",     // 동기화 실패
    "cancelled"   // 동기화 취소
  ]).default("pending"),
  
  // 상세 정보
  last_sync_at: model.dateTime().nullable(),
  sync_attempts: model.number().default(0),
  max_attempts: model.number().default(3),
  
  // 에러 정보
  error_message: model.text().nullable(),
  error_code: model.text().nullable(),
  
  // Amazon API 응답
  feed_submission_id: model.text().nullable(), // Amazon Feed API 제출 ID
  processing_status: model.text().nullable(), // Amazon에서의 처리 상태
})

export default AmazonProductSync 