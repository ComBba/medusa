import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { ProductDTO, ProductVariantDTO } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { InventoryMapperService } from "../modules/amazon-integration/services/inventory-mapper"
import { AmazonSPAPIClient } from "../modules/amazon-integration/services/sp-api-client"
import { AmazonInventoryData, AmazonMarketplaceConfig } from "../modules/amazon-integration/types"

export type AmazonSyncInventoryWorkflowInput = {
  product: ProductDTO
  variants: ProductVariantDTO[]
  inventory_data: Array<{
    variant_id: string
    sku: string
    inventory_item_id: string
    quantity: number
    reserved_quantity: number
    available_quantity: number
  }>
  marketplace_ids?: string[]
  options?: {
    force_update?: boolean
    quantity_threshold?: number
    sync_type?: string
  }
}

/**
 * 재고 동기화 레코드 생성 단계
 */
const createInventorySyncRecordStep = createStep(
  "create-inventory-sync-record",
  async ({ 
    product, 
    variants,
    inventory_data,
    marketplace_ids,
    options = {}
  }: AmazonSyncInventoryWorkflowInput, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 활성화된 마켓플레이스 조회
    const marketplaces = await amazonService.getActiveMarketplaces()
    
    // 특정 마켓플레이스가 지정된 경우 필터링
    const targetMarketplaces = marketplace_ids 
      ? marketplaces.filter(m => marketplace_ids.includes(m.marketplace_id))
      : marketplaces
      
    if (targetMarketplaces.length === 0) {
      return new StepResponse(
        { 
          syncRecords: [],
          marketplaces: [],
          product,
          variants,
          inventory_data,
          message: "No active marketplaces found"
        }, 
        null
      )
    }

    // 수량 임계값 체크
    const quantityThreshold = options.quantity_threshold || 0
    const filteredInventoryData = inventory_data.filter(inv => 
      inv.available_quantity >= quantityThreshold
    )

    if (filteredInventoryData.length === 0) {
      return new StepResponse(
        { 
          syncRecords: [],
          marketplaces: targetMarketplaces,
          product,
          variants,
          inventory_data: [],
          message: `No inventory data meets the quantity threshold (${quantityThreshold})`
        }, 
        null
      )
    }

    // 각 마켓플레이스와 variant별로 동기화 레코드 생성
    const syncRecords: any[] = []
    
    for (const marketplace of targetMarketplaces) {
      for (const inventoryItem of filteredInventoryData) {
        // 기존 동기화 레코드가 있는지 확인 (force_update가 false인 경우)
        if (!options.force_update) {
          const existingRecords = await amazonService.listAmazonProductSyncs({
            medusa_product_id: product.id!,
            medusa_variant_id: inventoryItem.variant_id,
            amazon_marketplace_id: marketplace.marketplace_id,
            sync_type: "inventory"
          })
          
          // 최근 성공한 동기화가 있다면 스킵
          const recentSuccessfulSync = existingRecords.find(record => 
            record.sync_status === "completed" &&
            new Date(record.updated_at) > new Date(Date.now() - 30 * 60 * 1000) // 30분 내
          )
          
          if (recentSuccessfulSync) {
            console.log(`Skipping inventory sync for ${inventoryItem.sku} on ${marketplace.marketplace_id} - recent successful sync exists`)
            continue
          }
        }
        
        const syncRecord = await amazonService.createProductSync({
          medusa_product_id: product.id!,
          medusa_variant_id: inventoryItem.variant_id,
          amazon_marketplace_id: marketplace.marketplace_id,
          sync_type: "inventory",
          sync_status: "pending",
          sync_attempts: 0,
          metadata: {
            inventory_data: inventoryItem,
            options,
            initiated_at: new Date().toISOString()
          }
        })
        
        syncRecords.push(syncRecord)
      }
    }

    return new StepResponse(
      { 
        syncRecords, 
        marketplaces: targetMarketplaces,
        product,
        variants,
        inventory_data: filteredInventoryData
      },
      syncRecords.map(record => record.id)
    )
  },
  
  // 보상 함수 - 실패 시 생성된 동기화 레코드 삭제
  async (syncRecordIds, { container }) => {
    if (!syncRecordIds?.length) return
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    try {
      for (const recordId of syncRecordIds) {
        await amazonService.deleteProductSync(recordId)
      }
    } catch (error) {
      console.error("Failed to cleanup inventory sync records:", error)
    }
  }
)

/**
 * Amazon에 재고 정보 업데이트 단계
 */
const updateAmazonInventoryStep = createStep(
  "update-amazon-inventory",
  async ({ 
    syncRecords, 
    marketplaces, 
    product,
    variants,
    inventory_data
  }: {
    syncRecords: any[]
    marketplaces: any[]
    product: ProductDTO
    variants: ProductVariantDTO[]
    inventory_data: any[]
    message?: string
  }, { container }) => {
    
    const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
    
    if (!syncRecords?.length) {
      return new StepResponse({
        results: [],
        skipped: true,
        message: "No sync records to process"
      })
    }
    
    const results: Array<{
      marketplace_id: string
      variant_id: string
      sku: string
      success: boolean
      feed_id?: string
      previous_quantity?: number
      new_quantity: number
      error?: { code: string; message: string }
    }> = []
    
    // 마켓플레이스별로 그룹화
    const recordsByMarketplace = syncRecords.reduce((acc, record) => {
      const marketplaceId = record.amazon_marketplace_id
      if (!acc[marketplaceId]) {
        acc[marketplaceId] = []
      }
      acc[marketplaceId].push(record)
      return acc
    }, {})
    
    for (const [marketplaceId, records] of Object.entries(recordsByMarketplace) as [string, any[]][]) {
      const marketplace = marketplaces.find(m => m.marketplace_id === marketplaceId)
      if (!marketplace) {
        console.error(`Marketplace not found: ${marketplaceId}`)
        continue
      }
      
      try {
        // Amazon SP-API 클라이언트 생성
        const apiClient = new AmazonSPAPIClient({
          region: marketplace.region,
          credentials: {
            seller_id: marketplace.seller_id,
            marketplace_id: marketplace.marketplace_id,
          },
          sandbox: process.env.NODE_ENV !== 'production'
        })

        // 재고 업데이트 데이터 준비
        const inventoryUpdates: AmazonInventoryData[] = []
        
        for (const record of records) {
          const inventoryItem = inventory_data.find(inv => inv.variant_id === record.medusa_variant_id)
          const variant = variants.find(v => v.id === record.medusa_variant_id)
          
          if (!inventoryItem || !variant) {
            console.error(`Inventory or variant not found for record ${record.id}`)
            continue
          }
          
          // 동기화 상태를 'processing'으로 업데이트
          await amazonService.updateProductSync(record.id, {
            sync_status: "processing",
            sync_attempts: record.sync_attempts + 1,
          })

          // Amazon 재고 형식으로 변환
          const amazonInventoryData = InventoryMapperService.mapMedusaToAmazon(
            inventoryItem,
            variant,
            marketplace
          )
          
          inventoryUpdates.push(amazonInventoryData)
        }

        // Amazon에 재고 업데이트 제출
        const submitResult = await apiClient.submitInventoryFeed(inventoryUpdates)
        
        if (submitResult.success) {
          // 성공 시 모든 레코드 업데이트
          for (const record of records) {
            const inventoryItem = inventory_data.find(inv => inv.variant_id === record.medusa_variant_id)
            const variant = variants.find(v => v.id === record.medusa_variant_id)
            
            await amazonService.updateProductSync(record.id, {
              sync_status: "completed",
              feed_submission_id: submitResult.feed_submission_id,
              last_sync_at: new Date(),
              error_message: null,
              error_code: null,
              metadata: {
                ...record.metadata,
                feed_result: submitResult,
                completed_at: new Date().toISOString()
              }
            })
            
            results.push({
              marketplace_id: marketplaceId,
              variant_id: record.medusa_variant_id,
              sku: variant?.sku || 'unknown',
              success: true,
              feed_id: submitResult.feed_submission_id,
              new_quantity: inventoryItem?.available_quantity || 0
            })
          }
        } else {
          // 실패 시 모든 레코드에 에러 정보 저장
          for (const record of records) {
            const variant = variants.find(v => v.id === record.medusa_variant_id)
            
            await amazonService.updateProductSync(record.id, {
              sync_status: "failed",
              error_message: submitResult.error?.message,
              error_code: submitResult.error?.code,
            })
            
            results.push({
              marketplace_id: marketplaceId,
              variant_id: record.medusa_variant_id,
              sku: variant?.sku || 'unknown',
              success: false,
              new_quantity: 0,
              error: submitResult.error
            })
          }
        }
        
      } catch (error) {
        // 예외 발생 시 해당 마켓플레이스의 모든 레코드에 에러 처리
        for (const record of records) {
          const variant = variants.find(v => v.id === record.medusa_variant_id)
          
          await amazonService.updateProductSync(record.id, {
            sync_status: "failed",
            error_message: error.message,
            error_code: "UNEXPECTED_ERROR",
          })
          
          results.push({
            marketplace_id: marketplaceId,
            variant_id: record.medusa_variant_id,
            sku: variant?.sku || 'unknown',
            success: false,
            new_quantity: 0,
            error: {
              code: "UNEXPECTED_ERROR",
              message: error.message
            }
          })
        }
      }
    }

    return new StepResponse({ results })
  }
)

/**
 * Amazon 재고 동기화 워크플로우
 */
export const amazonSyncInventoryWorkflow = createWorkflow(
  "amazon-sync-inventory",
  (input: AmazonSyncInventoryWorkflowInput) => {
    
    // 1단계: 재고 동기화 레코드 생성
    const syncRecordStep = createInventorySyncRecordStep(input)
    
    // 2단계: Amazon에 재고 정보 업데이트
    const updateResults = updateAmazonInventoryStep(syncRecordStep)

    return new WorkflowResponse({
      product_id: input.product.id,
      variants_count: input.variants.length,
      inventory_updates: updateResults,
      sync_options: input.options
    })
  }
)

export default amazonSyncInventoryWorkflow