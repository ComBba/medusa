// @ts-nocheck - 임시 타입 체크 비활성화 (점진적 개선 예정)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { amazonSyncProductWorkflow } from "../../../../../workflows/amazon-sync-product"
import { amazonSyncInventoryWorkflow } from "../../../../../workflows/amazon-sync-inventory"
import { amazonSyncPriceWorkflow } from "../../../../../workflows/amazon-sync-price"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/amazon/sync/all
 * 상품의 모든 정보(상품, 재고, 가격)를 Amazon에 동기화
 */
export const POST = async (
  req: MedusaRequest<{
    product_id: string
    marketplace_ids?: string[]
    options?: {
      force_update?: boolean
      include_variants?: boolean
      sync_images?: boolean
      quantity_threshold?: number
      currency?: string
      include_promotions?: boolean
      parallel_execution?: boolean
    }
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const pricingService = req.scope.resolve(Modules.PRICING)
  
  try {
    const { product_id, marketplace_ids, options = {} } = req.body
    
    if (!product_id) {
      return res.status(400).json({
        message: "product_id는 필수입니다"
      })
    }
    
    // 상품 조회 (모든 관련 데이터 포함)
    const product = await productService.retrieveProduct(product_id, {
      relations: ["variants", "images", "categories", "tags"]
    })
    
    if (!product) {
      return res.status(404).json({
        message: "상품을 찾을 수 없습니다"
      })
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
    
    const variants = product.variants || []
    const currency = options.currency || "USD"
    
    // 재고 정보 수집
    const inventoryData = []
    for (const variant of variants) {
      const inventoryItems = await inventoryService.listInventoryItems({
        sku: variant.sku
      })
      
      for (const item of inventoryItems) {
        const levels = await inventoryService.listInventoryLevels({
          inventory_item_id: item.id
        })
        
        const totalQuantity = levels.reduce((sum, level) => sum + (level.stocked_quantity || 0), 0)
        const reservedQuantity = levels.reduce((sum, level) => sum + (level.reserved_quantity || 0), 0)
        
        inventoryData.push({
          variant_id: variant.id,
          sku: variant.sku,
          inventory_item_id: item.id,
          quantity: totalQuantity,
          reserved_quantity: reservedQuantity,
          available_quantity: totalQuantity - reservedQuantity
        })
      }
    }
    
    // 가격 정보 수집
    const pricingData = []
    for (const variant of variants) {
      try {
        const priceSet = await pricingService.retrievePriceSet(variant.price_set_id)
        
        if (priceSet) {
          const prices = priceSet.prices || []
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
          }
        }
      } catch (error) {
        console.error(`Error retrieving price for variant ${variant.id}:`, error)
      }
    }
    
    // 통합 동기화 옵션 설정
    const syncOptions = {
      force_update: options.force_update || false,
      include_variants: options.include_variants !== false,
      sync_images: options.sync_images !== false,
      quantity_threshold: options.quantity_threshold || 0,
      currency,
      include_promotions: options.include_promotions || false,
      parallel_execution: options.parallel_execution !== false,
      sync_type: "all" as const
    }
    
    // 동기화 결과 저장
    const syncResults = {
      product: null,
      inventory: null,
      price: null,
      sync_records: []
    }
    
    // 동기화 실행 (병렬 또는 순차)
    if (syncOptions.parallel_execution) {
      // 병렬 실행
      const [productResult, inventoryResult, priceResult] = await Promise.allSettled([
        // 상품 동기화
        amazonSyncProductWorkflow(req.scope).run({
          input: {
            product,
            marketplace_ids: targetMarketplaces,
            options: { ...syncOptions, sync_type: "product" }
          }
        }),
        
        // 재고 동기화
        amazonSyncInventoryWorkflow(req.scope).run({
          input: {
            product,
            variants,
            inventory_data: inventoryData,
            marketplace_ids: targetMarketplaces,
            options: { ...syncOptions, sync_type: "inventory" }
          }
        }),
        
        // 가격 동기화
        amazonSyncPriceWorkflow(req.scope).run({
          input: {
            product,
            variants,
            pricing_data: pricingData,
            marketplace_ids: targetMarketplaces,
            options: { ...syncOptions, sync_type: "price" }
          }
        })
      ])
      
      syncResults.product = productResult.status === 'fulfilled' ? productResult.value : { error: productResult.reason }
      syncResults.inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : { error: inventoryResult.reason }
      syncResults.price = priceResult.status === 'fulfilled' ? priceResult.value : { error: priceResult.reason }
      
    } else {
      // 순차 실행 (상품 → 재고 → 가격)
      try {
        // 1. 상품 동기화
        syncResults.product = await amazonSyncProductWorkflow(req.scope).run({
          input: {
            product,
            marketplace_ids: targetMarketplaces,
            options: { ...syncOptions, sync_type: "product" }
          }
        })
        
        // 2. 재고 동기화
        syncResults.inventory = await amazonSyncInventoryWorkflow(req.scope).run({
          input: {
            product,
            variants,
            inventory_data: inventoryData,
            marketplace_ids: targetMarketplaces,
            options: { ...syncOptions, sync_type: "inventory" }
          }
        })
        
        // 3. 가격 동기화
        syncResults.price = await amazonSyncPriceWorkflow(req.scope).run({
          input: {
            product,
            variants,
            pricing_data: pricingData,
            marketplace_ids: targetMarketplaces,
            options: { ...syncOptions, sync_type: "price" }
          }
        })
        
      } catch (error) {
        console.error("Sequential sync error:", error)
        throw error
      }
    }
    
    // 동기화 레코드 생성
    const syncTypes = ["product", "inventory", "price"]
    for (const marketplaceId of targetMarketplaces) {
      for (const syncType of syncTypes) {
        const syncRecord = await amazonService.createProductSync({
          medusa_product_id: product_id,
          amazon_marketplace_id: marketplaceId,
          sync_type: syncType as any,
          sync_status: "pending",
          metadata: {
            sync_all: true,
            inventory_data: inventoryData,
            pricing_data: pricingData,
            options: syncOptions,
            initiated_by: "manual",
            initiated_at: new Date().toISOString()
          }
        })
        syncResults.sync_records.push(syncRecord)
      }
    }
    
    // 전체 성공/실패 상태 계산
    const hasErrors = [
      syncResults.product,
      syncResults.inventory,
      syncResults.price
    ].some(result => result?.error)
    
    res.json({
      message: hasErrors 
        ? "일부 동기화가 실패했습니다" 
        : "전체 동기화가 시작되었습니다",
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle
      },
      variants: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        title: v.title
      })),
      inventory_data: inventoryData,
      pricing_data: pricingData,
      target_marketplaces: targetMarketplaces,
      sync_options: syncOptions,
      workflow_results: {
        product: syncResults.product,
        inventory: syncResults.inventory,
        price: syncResults.price
      },
      sync_records: syncResults.sync_records,
      summary: {
        total_marketplaces: targetMarketplaces.length,
        total_variants: variants.length,
        sync_types: syncTypes.length,
        parallel_execution: syncOptions.parallel_execution,
        has_errors: hasErrors
      }
    })
    
  } catch (error) {
    console.error("All sync error:", error)
    res.status(500).json({
      message: "전체 동기화 중 오류 발생",
      error: error.message
    })
  }
}