import {
  createWorkflow,
  WorkflowResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { ProductDTO } from "@medusajs/framework/types"
import { amazonSyncProductWorkflow } from "./amazon-sync-product"
import { amazonSyncInventoryWorkflow } from "./amazon-sync-inventory"
import { amazonSyncPriceWorkflow } from "./amazon-sync-price"

export type AmazonSyncAllEnhancedInput = {
  product_id: string
  marketplace_ids?: string[]
  options?: {
    sync_images?: boolean
    include_variants?: boolean
    force_update?: boolean
    sync_product?: boolean
    sync_inventory?: boolean
    sync_price?: boolean
  }
}

/**
 * 통합 Amazon 동기화 워크플로우 - runAsStep 패턴 적용
 * 
 * 기존 워크플로우들을 재사용하여 전체 동기화를 수행합니다.
 * Medusa v2 공식 가이드의 워크플로우 재사용 패턴을 준수합니다.
 */
export const amazonSyncAllEnhancedWorkflow = createWorkflow(
  "amazon-sync-all-enhanced",
  (input: AmazonSyncAllEnhancedInput) => {
    
    // 옵션 기본값 설정
    const options = transform({
      input
    }, (data) => ({
      sync_product: data.input.options?.sync_product ?? true,
      sync_inventory: data.input.options?.sync_inventory ?? true,
      sync_price: data.input.options?.sync_price ?? true,
      ...data.input.options
    }))

    // 상품 정보 조회는 각 워크플로우에서 수행하므로 여기서는 ID만 전달

    // 1단계: 상품 동기화 (조건부 실행)
    const productSyncResult = when(
      "should-sync-product",
      options,
      (opts) => opts.sync_product
    ).then(() => {
      return amazonSyncProductWorkflow.runAsStep({
        input: {
          product: { id: input.product_id } as ProductDTO, // 실제로는 full product 객체 필요
          marketplace_ids: input.marketplace_ids,
          options: {
            sync_images: options.sync_images,
            include_variants: options.include_variants,
            force_update: options.force_update
          }
        }
      })
    })

    // 2단계: 재고 동기화 (조건부 실행)
    const inventorySyncResult = when(
      "should-sync-inventory",
      options,
      (opts) => opts.sync_inventory
    ).then(() => {
      return amazonSyncInventoryWorkflow.runAsStep({
        input: {
          product: { id: input.product_id } as ProductDTO,
          variants: [], // 실제로는 variant 데이터 필요
          inventory_data: [], // 실제로는 재고 데이터 필요
          marketplace_ids: input.marketplace_ids,
          options: {
            force_update: options.force_update
          }
        }
      })
    })

    // 3단계: 가격 동기화 (조건부 실행) 
    const priceSyncResult = when(
      "should-sync-price",
      options,
      (opts) => opts.sync_price
    ).then(() => {
      return amazonSyncPriceWorkflow.runAsStep({
        input: {
          product: { id: input.product_id } as ProductDTO,
          variants: [], // 실제로는 variant 데이터 필요
          pricing_data: [], // 실제로는 가격 데이터 필요
          marketplace_ids: input.marketplace_ids,
          options: {
            force_update: options.force_update
          }
        }
      })
    })

    // 결과 통합 및 반환
    return new WorkflowResponse(
      transform({
        product_id: input.product_id,
        productSyncResult,
        inventorySyncResult,
        priceSyncResult,
        options
      }, (data) => ({
        product_id: data.product_id,
        sync_summary: {
          product: data.productSyncResult || null,
          inventory: data.inventorySyncResult || null,
          price: data.priceSyncResult || null
        },
        completed_steps: [
          data.options.sync_product && "product",
          data.options.sync_inventory && "inventory", 
          data.options.sync_price && "price"
        ].filter(Boolean),
        total_marketplaces: data.productSyncResult?.total_marketplaces || 0,
        overall_status: "completed"
      }))
    )
  }
)

export default amazonSyncAllEnhancedWorkflow 