// @ts-nocheck - 임시 타입 체크 비활성화 (점진적 개선 예정)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { amazonSyncPriceWorkflow } from "../../../../../workflows/amazon-sync-price"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/amazon/sync/price
 * 가격 정보를 Amazon에 동기화
 */
export const POST = async (
  req: MedusaRequest<{
    product_id?: string
    variant_id?: string
    marketplace_ids?: string[]
    options?: {
      force_update?: boolean
      currency?: string
      include_promotions?: boolean
    }
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const pricingService = req.scope.resolve(Modules.PRICING)
  
  try {
    const { product_id, variant_id, marketplace_ids, options = {} } = req.body
    
    if (!product_id && !variant_id) {
      return res.status(400).json({
        message: "product_id 또는 variant_id 중 하나는 필수입니다"
      })
    }
    
    let product
    let variants = []
    
    if (product_id) {
      // 상품 전체 variants 조회
      product = await productService.retrieveProduct(product_id, {
        relations: ["variants"]
      })
      
      if (!product) {
        return res.status(404).json({
          message: "상품을 찾을 수 없습니다"
        })
      }
      
      variants = product.variants || []
    } else if (variant_id) {
      // 특정 variant만 조회
      const variant = await productService.retrieveProductVariant(variant_id)
      if (!variant) {
        return res.status(404).json({
          message: "상품 변형을 찾을 수 없습니다"
        })
      }
      
      // variant에서 product 정보 가져오기
      product = await productService.retrieveProduct(variant.product_id)
      variants = [variant]
    }
    
    // 활성화된 마켓플레이스 목록 가져오기
    let targetMarketplaces = marketplace_ids
    if (!targetMarketplaces || targetMarketplaces.length === 0) {
      const activeMarketplaces = await amazonService.getActiveMarketplaces()
      targetMarketplaces = activeMarketplaces.map(m => m.marketplace_id)
    }
    
    if (targetMarketplaces.length === 0) {
      return res.status(400).json({
        message: "활성화된 Amazon 마켓플레이스가 없습니다"
      })
    }
    
    // 각 variant의 가격 정보 조회
    const pricingData = []
    const currency = options.currency || "USD"
    
    for (const variant of variants) {
      try {
        // 가격 정보 조회
        const priceSet = await pricingService.retrievePriceSet(variant.price_set_id)
        
        // 통화별 가격 찾기
        const prices = priceSet?.prices || []
        const priceForCurrency = prices.find(p => p.currency_code === currency)
        
        if (priceForCurrency) {
          pricingData.push({
            variant_id: variant.id,
            sku: variant.sku,
            currency_code: currency,
            amount: priceForCurrency.amount,
            compare_at_amount: priceForCurrency.compare_at_amount,
            price_set_id: variant.price_set_id,
            price_rules: priceSet.price_rules || []
          })
        } else {
          console.warn(`No price found for variant ${variant.id} in currency ${currency}`)
        }
      } catch (error) {
        console.error(`Error retrieving price for variant ${variant.id}:`, error)
      }
    }
    
    if (pricingData.length === 0) {
      return res.status(400).json({
        message: `지정된 통화(${currency})에 대한 가격 정보가 없습니다`
      })
    }
    
    // 동기화 옵션 설정
    const syncOptions = {
      force_update: options.force_update || false,
      currency,
      include_promotions: options.include_promotions || false,
      sync_type: "price" as const
    }
    
    // 가격 동기화 워크플로우 실행
    const { result } = await amazonSyncPriceWorkflow(req.scope).run({
      input: {
        product,
        variants,
        pricing_data: pricingData,
        marketplace_ids: targetMarketplaces,
        options: syncOptions
      }
    })
    
    // 동기화 결과 기록
    const syncResults = []
    for (const marketplaceId of targetMarketplaces) {
      for (const variant of variants) {
        const priceData = pricingData.find(p => p.variant_id === variant.id)
        
        const syncRecord = await amazonService.createProductSync({
          medusa_product_id: product.id,
          medusa_variant_id: variant.id,
          amazon_marketplace_id: marketplaceId,
          sync_type: "price",
          sync_status: "pending",
          metadata: {
            pricing_data: priceData,
            options: syncOptions,
            initiated_by: "manual",
            initiated_at: new Date().toISOString()
          }
        })
        syncResults.push(syncRecord)
      }
    }
    
    res.json({
      message: "가격 동기화가 시작되었습니다",
      product: {
        id: product.id,
        title: product.title
      },
      variants: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        title: v.title
      })),
      pricing_data: pricingData,
      target_marketplaces: targetMarketplaces,
      sync_records: syncResults,
      options: syncOptions,
      workflow_result: result
    })
    
  } catch (error) {
    console.error("Price sync error:", error)
    res.status(500).json({
      message: "가격 동기화 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * GET /admin/amazon/sync/price/:product_id
 * 특정 상품의 가격 동기화 상태 조회
 */
export const GET = async (
  req: MedusaRequest<{}, { marketplace_id?: string, variant_id?: string, currency?: string }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const pricingService = req.scope.resolve(Modules.PRICING)
  
  try {
    const { product_id } = req.params
    const { marketplace_id, variant_id, currency = "USD" } = req.query
    
    if (!product_id) {
      return res.status(400).json({
        message: "product_id는 필수입니다"
      })
    }
    
    // 상품 존재 확인
    const product = await productService.retrieveProduct(product_id, {
      relations: ["variants"]
    })
    
    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다"
      })
    }
    
    // 동기화 레코드 조회 필터
    const filters: any = { 
      medusa_product_id: product_id,
      sync_type: "price"
    }
    
    if (marketplace_id) {
      filters.amazon_marketplace_id = marketplace_id
    }
    
    if (variant_id) {
      filters.medusa_variant_id = variant_id
    }
    
    const syncRecords = await amazonService.listAmazonProductSyncs(filters)
    
    // 현재 가격 상태 조회
    const currentPricing = []
    const variants = variant_id 
      ? product.variants.filter(v => v.id === variant_id)
      : product.variants
    
    for (const variant of variants) {
      try {
        const priceSet = await pricingService.retrievePriceSet(variant.price_set_id)
        
        if (priceSet) {
          const prices = priceSet.prices || []
          const priceForCurrency = prices.find(p => p.currency_code === currency)
          
          currentPricing.push({
            variant_id: variant.id,
            sku: variant.sku,
            price_set_id: variant.price_set_id,
            current_price: priceForCurrency ? {
              currency_code: priceForCurrency.currency_code,
              amount: priceForCurrency.amount,
              compare_at_amount: priceForCurrency.compare_at_amount,
              min_quantity: priceForCurrency.min_quantity,
              max_quantity: priceForCurrency.max_quantity
            } : null,
            all_prices: prices.map(p => ({
              currency_code: p.currency_code,
              amount: p.amount,
              compare_at_amount: p.compare_at_amount
            })),
            price_rules: priceSet.price_rules || []
          })
        }
      } catch (error) {
        console.error(`Error retrieving pricing for variant ${variant.id}:`, error)
        currentPricing.push({
          variant_id: variant.id,
          sku: variant.sku,
          error: "가격 정보 조회 실패"
        })
      }
    }
    
    res.json({
      product: {
        id: product.id,
        title: product.title
      },
      current_pricing: currentPricing,
      sync_records: syncRecords,
      summary: {
        total_syncs: syncRecords.length,
        successful: syncRecords.filter(r => r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_status === 'failed').length,
        pending: syncRecords.filter(r => r.sync_status === 'pending').length
      },
      currency
    })
    
  } catch (error) {
    console.error("Price sync status error:", error)
    res.status(500).json({
      message: "가격 동기화 상태 조회 중 오류 발생",
      error: error.message
    })
  }
}