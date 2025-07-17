import { model } from "@medusajs/framework/utils"

/**
 * Amazon 마켓플레이스 설정 정보
 */
const AmazonMarketplace = model.define("amazon_marketplace", {
  id: model.id().primaryKey(),
  
  // 마켓플레이스 정보
  marketplace_id: model.text().unique(), // 예: ATVPDKIKX0DER (US), A1PA6795UKMFR9 (DE)
  country_code: model.text(), // US, DE, JP, UK, FR, IT, ES, CA, AU, MX
  name: model.text(), // Amazon.com, Amazon.de, Amazon.co.jp 등
  currency_code: model.text(), // USD, EUR, JPY, GBP 등
  
  // API 설정
  region: model.text(), // NA, EU, FE (North America, Europe, Far East)
  endpoint: model.text(), // sellingpartnerapi-na.amazon.com 등
  
  // 계정 연동 정보  
  seller_id: model.text().nullable(),
  mws_auth_token: model.text().nullable(),
  
  // 설정
  is_active: model.boolean().default(false),
  auto_sync: model.boolean().default(true), // 자동 동기화 여부
})

export default AmazonMarketplace 