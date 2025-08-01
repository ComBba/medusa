// @ts-nocheck - 임시 타입 체크 비활성화 (점진적 개선 예정)
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AMAZON_INTEGRATION_MODULE } from "../../../../../modules/amazon-integration"
import AmazonIntegrationModuleService from "../../../../../modules/amazon-integration/service"
import { amazonSyncInventoryWorkflow } from "../../../../../workflows/amazon-sync-inventory"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/amazon/sync/inventory
 * 재고 정보를 Amazon에 동기화
 */
export const POST = async (
  req: MedusaRequest<{
    product_id?: string
    variant_id?: string
    marketplace_ids?: string[]
    options?: {
      force_update?: boolean
      quantity_threshold?: number
    }
  }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  
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
    
    // 각 variant의 재고 정보 조회
    const inventoryData = []
    for (const variant of variants) {
      // inventory items 조회
      const inventoryItems = await inventoryService.listInventoryItems({
        sku: variant.sku
      })
      
      for (const item of inventoryItems) {
        // 재고 수량 조회
        const levels = await inventoryService.listInventoryLevels({
          inventory_item_id: item.id
        })
        
        const totalQuantity = levels.reduce((sum, level) => sum + (level.stocked_quantity || 0), 0)
        
        inventoryData.push({
          variant_id: variant.id,
          sku: variant.sku,
          inventory_item_id: item.id,
          quantity: totalQuantity,
          reserved_quantity: levels.reduce((sum, level) => sum + (level.reserved_quantity || 0), 0),
          available_quantity: totalQuantity - levels.reduce((sum, level) => sum + (level.reserved_quantity || 0), 0)
        })
      }
    }
    
    // 동기화 옵션 설정
    const syncOptions = {
      force_update: options.force_update || false,
      quantity_threshold: options.quantity_threshold || 0,
      sync_type: "inventory" as const
    }
    
    // 재고 동기화 워크플로우 실행
    const { result } = await amazonSyncInventoryWorkflow(req.scope).run({
      input: {
        product,
        variants,
        inventory_data: inventoryData,
        marketplace_ids: targetMarketplaces,
        options: syncOptions
      }
    })
    
    // 동기화 결과 기록
    const syncResults = []
    for (const marketplaceId of targetMarketplaces) {
      for (const variant of variants) {
        const syncRecord = await amazonService.createProductSync({
          medusa_product_id: product.id,
          medusa_variant_id: variant.id,
          amazon_marketplace_id: marketplaceId,
          sync_type: "inventory",
          sync_status: "pending",
          metadata: {
            inventory_data: inventoryData.find(inv => inv.variant_id === variant.id),
            options: syncOptions,
            initiated_by: "manual",
            initiated_at: new Date().toISOString()
          }
        })
        syncResults.push(syncRecord)
      }
    }
    
    res.json({
      message: "재고 동기화가 시작되었습니다",
      product: {
        id: product.id,
        title: product.title
      },
      variants: variants.map(v => ({
        id: v.id,
        sku: v.sku,
        title: v.title
      })),
      inventory_data: inventoryData,
      target_marketplaces: targetMarketplaces,
      sync_records: syncResults,
      options: syncOptions,
      workflow_result: result
    })
    
  } catch (error) {
    console.error("Inventory sync error:", error)
    res.status(500).json({
      message: "재고 동기화 중 오류 발생",
      error: error.message
    })
  }
}

/**
 * GET /admin/amazon/sync/inventory/:product_id
 * 특정 상품의 재고 동기화 상태 조회
 */
export const GET = async (
  req: MedusaRequest<{}, { marketplace_id?: string, variant_id?: string }>,
  res: MedusaResponse
) => {
  const amazonService: AmazonIntegrationModuleService = req.scope.resolve(AMAZON_INTEGRATION_MODULE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  
  try {
    const { product_id } = req.params
    const { marketplace_id, variant_id } = req.query
    
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
      sync_type: "inventory"
    }
    
    if (marketplace_id) {
      filters.amazon_marketplace_id = marketplace_id
    }
    
    if (variant_id) {
      filters.medusa_variant_id = variant_id
    }
    
    const syncRecords = await amazonService.listAmazonProductSyncs(filters)
    
    // 현재 재고 상태 조회
    const currentInventory = []
    const variants = variant_id 
      ? product.variants.filter(v => v.id === variant_id)
      : product.variants
    
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
        
        currentInventory.push({
          variant_id: variant.id,
          sku: variant.sku,
          inventory_item_id: item.id,
          quantity: totalQuantity,
          reserved_quantity: reservedQuantity,
          available_quantity: totalQuantity - reservedQuantity,
          locations: levels.map(level => ({
            location_id: level.location_id,
            stocked_quantity: level.stocked_quantity,
            reserved_quantity: level.reserved_quantity
          }))
        })
      }
    }
    
    res.json({
      product: {
        id: product.id,
        title: product.title
      },
      current_inventory: currentInventory,
      sync_records: syncRecords,
      summary: {
        total_syncs: syncRecords.length,
        successful: syncRecords.filter(r => r.sync_status === 'completed').length,
        failed: syncRecords.filter(r => r.sync_status === 'failed').length,
        pending: syncRecords.filter(r => r.sync_status === 'pending').length
      }
    })
    
  } catch (error) {
    console.error("Inventory sync status error:", error)
    res.status(500).json({
      message: "재고 동기화 상태 조회 중 오류 발생",
      error: error.message
    })
  }
}