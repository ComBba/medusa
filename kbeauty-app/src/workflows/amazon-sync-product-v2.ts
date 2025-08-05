import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { ProductDTO } from "@medusajs/framework/types"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"

/**
 * Amazon 상품 동기화 워크플로우 V2 입력 타입
 * Medusa 2.0 최신 패턴을 따름
 */
export type AmazonSyncProductV2WorkflowInput = {
  product_id?: string
  product?: ProductDTO
  marketplace_ids?: string[]
  options?: {
    sync_images?: boolean
    include_variants?: boolean
    force_update?: boolean
    batch_size?: number
  }
}

/**
 * 상품 데이터 조회 단계 (useQueryGraphStep 사용)
 */
interface RetrieveProductInput {
  product_id?: string
  product?: ProductDTO
}

interface RetrieveProductOutput {
  product: ProductDTO
}

const retrieveProductDataStep = createStep<
  RetrieveProductInput,
  RetrieveProductOutput,
  never
>(
  "retrieve-product-data",
  async (input: RetrieveProductInput, { container }) => {
    // 이미 product가 제공된 경우 바로 반환
    if (input.product) {
      return new StepResponse({ product: input.product })
    }

    if (!input.product_id) {
      throw new Error("Either product_id or product must be provided")
    }

    // useQueryGraphStep을 사용한 효율적인 데이터 조회
    const productQuery = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "title", 
        "description",
        "subtitle",
        "handle",
        "status",
        "thumbnail",
        "images.*",
        "variants.*",
        "variants.prices.*",
        "variants.options.*",
        "options.*",
        "options.values.*",
        "categories.*",
        "tags.*",
        "metadata"
      ],
      filters: {
        id: input.product_id,
      },
      options: {
        throwIfKeyNotFound: true,
      },
    }).config({ name: "product-retrieval" })

    const products = productQuery.data
    if (!products || products.length === 0) {
      throw new Error(`Product with ID ${input.product_id} not found`)
    }

    return new StepResponse({ product: products[0] as ProductDTO })
  }
)

/**
 * 마켓플레이스 준비 단계 (향상된 버전)
 */
interface PrepareMarketplacesInput {
  marketplace_ids?: string[]
}

interface PrepareMarketplacesOutput {
  marketplaces: any[]
  marketplace_count: number
}

const prepareActiveMarketplacesStep = createStep<
  PrepareMarketplacesInput,
  PrepareMarketplacesOutput,
  never
>(
  "prepare-active-marketplaces",
  async (input: PrepareMarketplacesInput, { container }) => {
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)
    
    // 모든 활성 마켓플레이스 조회
    const allMarketplaces = await amazonService.getActiveMarketplaces()
    
    if (allMarketplaces.length === 0) {
      throw new Error("No active Amazon marketplaces found. Please activate at least one marketplace.")
    }

    // 특정 마켓플레이스가 지정된 경우 필터링
    const targetMarketplaces = input.marketplace_ids?.length
      ? allMarketplaces.filter(m => 
          input.marketplace_ids!.includes(m.id) || 
          input.marketplace_ids!.includes(m.marketplace_id)
        )
      : allMarketplaces

    if (targetMarketplaces.length === 0) {
      throw new Error(`No matching marketplaces found for IDs: ${input.marketplace_ids?.join(', ')}`)
    }

    return new StepResponse({ 
      marketplaces: targetMarketplaces,
      marketplace_count: targetMarketplaces.length 
    })
  }
)

/**
 * 동기화 레코드 생성/업데이트 단계
 */
const manageProductSyncRecordsStep = createStep(
  "manage-product-sync-records",
  async ({ 
    product, 
    marketplaces, 
    force_update 
  }: { 
    product: ProductDTO; 
    marketplaces: any[]; 
    force_update?: boolean 
  }, { container }) => {
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)

    const syncRecords: any[] = []
    const existingRecords: any[] = []

    // 각 마켓플레이스별로 동기화 레코드 처리
    for (const marketplace of marketplaces) {
      try {
        // 기존 동기화 레코드 확인
        const existing = await amazonService.listAmazonProductSyncs({
          medusa_product_id: product.id,
          amazon_marketplace_id: marketplace.id,
        })

        if (existing && existing.length > 0) {
          const record = existing[0] as any
          existingRecords.push(record)

          // 강제 업데이트가 아니고 이미 성공한 경우 스킵
          if (!force_update && record.sync_status === "completed") {
            continue
          }

          // 기존 레코드 상태 업데이트
          const updatedRecord = await amazonService.updateAmazonProductSyncs(record.id, {
            sync_status: "pending",
            sync_attempts: (record.sync_attempts || 0) + 1,
            last_sync_attempt: new Date(),
            error_message: null,
          } as any)
          
          syncRecords.push(updatedRecord as any)
        } else {
          // 새 동기화 레코드 생성
          const newRecord = await amazonService.createAmazonProductSyncs({
            medusa_product_id: product.id!,
            amazon_marketplace_id: marketplace.id,
            sync_status: "pending",
            sync_attempts: 1,
            sync_type: "product",
            created_at: new Date(),
            updated_at: new Date(),
          } as any)
          
          syncRecords.push(newRecord as any)
        }
      } catch (error) {
        console.error(`Error managing sync record for marketplace ${marketplace.id}:`, error)
        // 에러가 있어도 계속 진행
        continue
      }
    }

    return new StepResponse(
      { 
        syncRecords,
        processedCount: syncRecords.length,
        skippedCount: existingRecords.length - syncRecords.length
      },
      { recordIds: syncRecords.map((r: any) => r.id) }
    )
  },
  
  // 보상 함수 - 에러 시 생성된 레코드들 롤백
  async (compensationData, { container }) => {
    if (!compensationData?.recordIds?.length) return

    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)
    
    try {
      // 생성된 레코드들을 failed 상태로 변경
      for (const recordId of compensationData.recordIds) {
        await amazonService.updateAmazonProductSyncs(recordId, {
          sync_status: "failed",
          error_message: "Workflow compensation - operation rolled back",
        })
      }
    } catch (error) {
      console.error("Failed to compensate sync records:", error)
    }
  }
)

/**
 * 상품 매핑 및 변환 단계
 */
const mapProductToAmazonFormatStep = createStep(
  "map-product-to-amazon-format",
  async ({ 
    product, 
    marketplaces, 
    options 
  }: { 
    product: ProductDTO; 
    marketplaces: any[]; 
    options?: any 
  }, { container }) => {
    const productMapper = container.resolve("productMapper") as any

    const mappedProducts: any[] = []

    for (const marketplace of marketplaces) {
      try {
        const amazonProduct = await productMapper.mapToAmazonProduct(
          product,
          marketplace.marketplace_id,
          {
            includeVariants: options?.include_variants ?? true,
            includeImages: options?.sync_images ?? true,
            marketplace: marketplace,
          }
        )

        mappedProducts.push({
          marketplace: marketplace,
          amazonProduct: amazonProduct,
          mappingSuccess: true,
        })
      } catch (error: any) {
        console.error(`Failed to map product for marketplace ${marketplace.marketplace_id}:`, error)
        
        mappedProducts.push({
          marketplace: marketplace,
          amazonProduct: null,
          mappingSuccess: false,
          error: error.message,
        })
      }
    }

    const successfulMappings = mappedProducts.filter((m: any) => m.mappingSuccess)
    const failedMappings = mappedProducts.filter((m: any) => !m.mappingSuccess)

    return new StepResponse({
      mappedProducts: successfulMappings,
      failedMappings,
      successCount: successfulMappings.length,
      failureCount: failedMappings.length,
    })
  }
)

/**
 * Amazon SP-API 업로드 단계
 */
const uploadToAmazonStep = createStep(
  "upload-to-amazon",
  async ({ 
    mappedProducts,
    syncRecords 
  }: { 
    mappedProducts: any[]; 
    syncRecords: any[] 
  }, { container }) => {
    const spApiClient = container.resolve("amazonSPAPIClient") as any
    const amazonService: AmazonIntegrationModuleService = 
      container.resolve(AMAZON_INTEGRATION_MODULE)

    const uploadResults: any[] = []

    for (const mapping of mappedProducts) {
      const marketplace = mapping.marketplace
      const amazonProduct = mapping.amazonProduct
      
      // 해당 마켓플레이스의 동기화 레코드 찾기
      const syncRecord = syncRecords.find((r: any) => r.amazon_marketplace_id === marketplace.id)
      
      if (!syncRecord) {
        console.error(`No sync record found for marketplace ${marketplace.marketplace_id}`)
        continue
      }

      try {
        // SP-API를 통한 상품 업로드
        const uploadResult = await spApiClient.submitProduct(
          amazonProduct,
          marketplace.marketplace_id
        )

        // 성공 시 동기화 레코드 업데이트
        await amazonService.updateAmazonProductSyncs(syncRecord.id, {
          sync_status: "completed",
          amazon_product_id: uploadResult.productId,
          feed_submission_id: uploadResult.feedSubmissionId,
          last_successful_sync: new Date(),
          error_message: null,
        } as any)

        uploadResults.push({
          marketplace: marketplace,
          success: true,
          uploadResult,
          syncRecordId: syncRecord.id,
        })

      } catch (error: any) {
        console.error(`Failed to upload to marketplace ${marketplace.marketplace_id}:`, error)

        // 실패 시 동기화 레코드 업데이트
        await amazonService.updateAmazonProductSyncs(syncRecord.id, {
          sync_status: "failed",
          error_message: error.message,
          last_sync_attempt: new Date(),
        } as any)

        uploadResults.push({
          marketplace: marketplace,
          success: false,
          error: error.message,
          syncRecordId: syncRecord.id,
        })
      }
    }

    const successfulUploads = uploadResults.filter((r: any) => r.success)
    const failedUploads = uploadResults.filter((r: any) => !r.success)

    return new StepResponse({
      uploadResults,
      successfulUploads,
      failedUploads,
      totalProcessed: uploadResults.length,
      successCount: successfulUploads.length,
      failureCount: failedUploads.length,
    })
  }
)

/**
 * Amazon 상품 동기화 워크플로우 V2
 * Medusa 2.0의 최신 패턴을 활용한 개선된 버전
 */
export const amazonSyncProductV2Workflow = createWorkflow(
  { 
    name: "amazon-sync-product-v2",
    retentionTime: 24 * 60 * 60 * 1000, // 24시간 보존
  },
  (input: AmazonSyncProductV2WorkflowInput) => {
    // 1. 상품 데이터 조회 (useQueryGraphStep 활용)
    const productData = retrieveProductDataStep({
      product_id: input.product_id,
      product: input.product,
    })

    // 2. 활성 마켓플레이스 준비
    const marketplaceData = prepareActiveMarketplacesStep({
      marketplace_ids: input.marketplace_ids,
    })

    // 3. 동기화 레코드 관리
    const syncData = manageProductSyncRecordsStep({
      product: productData.product,
      marketplaces: marketplaceData.marketplaces,
      force_update: input.options?.force_update,
    })

    // 4. 상품을 Amazon 형식으로 매핑
    const mappingData = mapProductToAmazonFormatStep({
      product: productData.product,
      marketplaces: marketplaceData.marketplaces,
      options: input.options,
    })

    // 5. Amazon SP-API로 업로드 (매핑에 성공한 상품들만)
    const uploadData = when(
      { mappedProducts: mappingData.mappedProducts },
      (data: any) => data.mappedProducts.length > 0
    ).then(() => {
      return uploadToAmazonStep({
        mappedProducts: mappingData.mappedProducts,
        syncRecords: syncData.syncRecords,
      })
    })

    // 최종 결과 반환
    return new WorkflowResponse({
      product_id: productData.product.id,
      product_title: productData.product.title,
      processed_marketplaces: marketplaceData.marketplaces.length,
      sync_records_created: syncData.syncRecords.length,
      mapping_results: {
        successful: mappingData.mappedProducts?.length || 0,
        failed: mappingData.failedMappings?.length || 0,
        failures: mappingData.failedMappings,
      },
      upload_results: {
        successful: uploadData?.successfulUploads?.length || 0,
        failed: uploadData?.failedUploads?.length || 0,
        details: uploadData?.uploadResults || [],
      },
      overall_success: (uploadData?.failedUploads?.length || 0) === 0,
      timestamp: new Date().toISOString(),
    })
  }
)

export default amazonSyncProductV2Workflow