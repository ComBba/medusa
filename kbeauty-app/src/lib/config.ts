import Medusa from "@medusajs/js-sdk"

/**
 * Medusa JS SDK 인스턴스 설정
 * Admin API와 Store API 모두 지원
 */
export const sdk = new Medusa({
  baseUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  apiKey: process.env.MEDUSA_API_KEY, // 서버 사이드에서만 사용
})

export default sdk