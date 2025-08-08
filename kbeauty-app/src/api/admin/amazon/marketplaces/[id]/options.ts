import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * OPTIONS 요청 처리 (CORS preflight)
 */
export async function OPTIONS(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'https://admin.kbeauty.market')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400') // 24시간
  
  return res.status(200).end()
}
