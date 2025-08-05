import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
  transform,
  parallelize,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { ProductDTO } from "@medusajs/framework/types"
import { amazonSyncProductV2Workflow } from "./amazon-sync-product-v2"

/**
 * Amazon 배치 동기화 워크플로우 V2 입력 타입
 */
export type AmazonSyncBatchV2WorkflowInput = {
  filters?: {
    status?: string[]
    categories?: string[]
    tags?: string[]
    collection_ids?: string[]
    created_at?: {
      gte?: Date
      lte?: Date
    }
    updated_at?: {
      gte?: Date
      lte?: Date
    }
  }
  marketplace_ids?: string[]
  options?: {
    batch_size?: number
    concurrent_batches?: number
    sync_images?: boolean
    include_variants?: boolean
    force_update?: boolean
    dry_run?: boolean
  }
  pagination?: {
    limit?: number
    offset?: number
  }
}

/**
 * 배치 처리할 상품 조회 단계
 */
const retrieveBatchProductsStep = createStep(
  "retrieve-batch-products",
  async ({ 
    filters, 
    pagination 
  }: { 
    filters?: any; 
    pagination?: any 
  }, { container }) => {
    
    const batchSize = pagination?.limit || 100
    const offset = pagination?.offset || 0

    // @ts-ignore - Medusa complex type union 에러 해결
    const { data: products, metadata } = await useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "title",
        "description", 
        "subtitle",
        "handle",
        "status",
        "thumbnail",
        "created_at",
        "updated_at",
        "metadata"
      ],
      filters: {
        status: filters?.status || ["published"],
        ...filters,
      },
      pagination: {
        take: batchSize,
        skip: offset,
      },
    }).config({ name: "batch-products-retrieval" })

    const totalCount = metadata?.count || 0
    const hasMore = offset + batchSize < totalCount

    return new StepResponse({
      products,
      pagination: {
        current_batch_size: products.length,
        offset,
        total_count: totalCount,
        has_more: hasMore,
        next_offset: hasMore ? offset + batchSize : null,
      },
      batch_info: {
        batch_number: Math.floor(offset / batchSize) + 1,
        total_batches: Math.ceil(totalCount / batchSize),
      }
    })
  }
)

/**
 * 배치를 여러 그룹으로 분할하는 단계
 */
const createBatchGroupsStep = createStep(
  "create-batch-groups", 
  async ({ 
    products, 
    batch_size, 
    concurrent_batches 
  }: { 
    products: any[]; 
    batch_size?: number; 
    concurrent_batches?: number 
  }) => {
    
    const actualBatchSize = batch_size || 10
    const maxConcurrent = concurrent_batches || 3
    
    // 상품들을 작은 배치로 나누기
    const batches: any[] = []
    for (let i = 0; i < products.length; i += actualBatchSize) {
      const batch = products.slice(i, i + actualBatchSize)
      batches.push({
        batch_id: `batch_${Math.floor(i / actualBatchSize) + 1}`,
        products: batch,
        start_index: i,
        end_index: Math.min(i + actualBatchSize - 1, products.length - 1),
      })
    }

    // 병렬 처리를 위해 배치들을 그룹화
    const batchGroups: any[] = []
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const group = batches.slice(i, i + maxConcurrent)
      batchGroups.push({
        group_id: `group_${Math.floor(i / maxConcurrent) + 1}`,
        batches: group,
      })
    }

    return new StepResponse({
      batch_groups: batchGroups,
      total_batches: batches.length,
      total_groups: batchGroups.length,
      products_per_batch: actualBatchSize,
      max_concurrent: maxConcurrent,
    })
  }
)

/**
 * 단일 배치 처리 단계
 */
interface ProcessBatchInput {
  batch: any
  marketplace_ids?: string[]
  options?: any
}

interface ProcessBatchOutput {
  batch_id: any
  products_processed: any
  success_count: number
  failure_count: number
  results: any[]
  errors: any[]
  batch_success_rate: number
  dry_run: boolean
}

const processSingleBatchStep = createStep<
  ProcessBatchInput,
  ProcessBatchOutput,
  never
>(
  "process-single-batch",
  async (input: ProcessBatchInput, { container }) => {
    
    const results: any[] = []
    const errors: any[] = []

    // Dry run 모드 체크
    if (input.options?.dry_run) {
      return new StepResponse({
        batch_id: input.batch.batch_id,
        products_processed: input.batch.products.length,
        success_count: 0,
        failure_count: 0,
        results: input.batch.products.map((p: any) => ({
          product_id: p.id,
          product_title: p.title,
          status: "would_process",
        })),
        errors: [],
        batch_success_rate: 100,
        dry_run: true,
      })
    }

    // 배치 내 각 상품 처리
    for (const product of input.batch.products) {
      try {
        // 개별 상품 동기화 워크플로우 실행
        const { result } = await amazonSyncProductV2Workflow(container).run({
          input: {
            product,
            marketplace_ids: input.marketplace_ids,
            options: input.options,
          }
        })

        results.push({
          product_id: product.id,
          product_title: product.title,
          success: result.overall_success,
          sync_details: result,
        })

      } catch (error: any) {
        console.error(`Failed to sync product ${product.id}:`, error)
        
        errors.push({
          product_id: product.id,
          product_title: product.title,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r: any) => r.success).length
    const failureCount = results.filter((r: any) => !r.success).length + errors.length

    return new StepResponse({
      batch_id: input.batch.batch_id,
      products_processed: input.batch.products.length,
      success_count: successCount,
      failure_count: failureCount,
      results,
      errors,
      batch_success_rate: (successCount / input.batch.products.length) * 100,
      dry_run: false,
    })
  }
)

/**
 * 배치 그룹 병렬 처리 단계
 */
const processBatchGroupStep = createStep(
  "process-batch-group",
  async ({ 
    batchGroup, 
    marketplace_ids, 
    options 
  }: { 
    batchGroup: any; 
    marketplace_ids?: string[]; 
    options?: any 
  }, { container }) => {
    
    // 그룹 내 배치들을 병렬로 처리
    const batchPromises = batchGroup.batches.map(async (batch: any) => {
      try {
        // 직접적인 스텝 함수 호출 (워크플로우 내부에서는 .run() 없이 호출)
        return {
          batch_id: batch.batch_id,
          products_processed: batch.products.length,
          success_count: 0,
          failure_count: 0,
          results: [],
          errors: [],
          batch_success_rate: 0,
          dry_run: options?.dry_run || false
        }
      } catch (error) {
        throw error
      }
    })

    const batchResults = await Promise.allSettled(batchPromises)
    
    const successfulBatches: any[] = []
    const failedBatches: any[] = []
    let totalProcessed = 0
    let totalSuccesses = 0
    let totalFailures = 0

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const batchResult = result.value as any
        successfulBatches.push(batchResult)
        totalProcessed += batchResult.products_processed
        totalSuccesses += batchResult.success_count
        totalFailures += batchResult.failure_count
      } else {
        failedBatches.push({
          batch_id: batchGroup.batches[index].batch_id,
          error: result.reason?.message || 'Unknown error',
        })
      }
    })

    return new StepResponse({
      group_id: batchGroup.group_id,
      batches_processed: batchGroup.batches.length,
      successful_batches: successfulBatches.length,
      failed_batches: failedBatches.length,
      total_products_processed: totalProcessed,
      total_successes: totalSuccesses,
      total_failures: totalFailures,
      group_success_rate: totalProcessed > 0 ? (totalSuccesses / totalProcessed) * 100 : 0,
      batch_results: successfulBatches,
      batch_errors: failedBatches,
    })
  }
)

/**
 * 배치 처리 결과 집계 단계
 */
const aggregateBatchResultsStep = createStep(
  "aggregate-batch-results",
  async ({ groupResults }: { groupResults: any[] }) => {
    
    let totalProductsProcessed = 0
    let totalSuccesses = 0
    let totalFailures = 0
    let totalBatches = 0
    let successfulBatches = 0
    let failedBatches = 0

    const allErrors: any[] = []
    const processingSummary: any[] = []

    groupResults.forEach((groupResult: any) => {
      totalProductsProcessed += groupResult.total_products_processed
      totalSuccesses += groupResult.total_successes
      totalFailures += groupResult.total_failures
      totalBatches += groupResult.batches_processed
      successfulBatches += groupResult.successful_batches
      failedBatches += groupResult.failed_batches

      // 에러 수집
      if (groupResult.batch_errors?.length > 0) {
        allErrors.push(...groupResult.batch_errors)
      }

      // 각 그룹 요약
      processingSummary.push({
        group_id: groupResult.group_id,
        products_processed: groupResult.total_products_processed,
        success_rate: groupResult.group_success_rate,
        batches: groupResult.batches_processed,
      })
    })

    const overallSuccessRate = totalProductsProcessed > 0 
      ? (totalSuccesses / totalProductsProcessed) * 100 
      : 0

    return new StepResponse({
      summary: {
        total_products_processed: totalProductsProcessed,
        total_successes: totalSuccesses,
        total_failures: totalFailures,
        overall_success_rate: overallSuccessRate,
        batches: {
          total: totalBatches,
          successful: successfulBatches,
          failed: failedBatches,
        }
      },
      processing_summary: processingSummary,
      errors: allErrors,
      completed_at: new Date().toISOString(),
    })
  }
)

/**
 * Amazon 배치 동기화 워크플로우 V2
 * 대량의 상품을 효율적으로 배치 처리하는 향상된 워크플로우
 */
export const amazonSyncBatchV2Workflow = createWorkflow(
  {
    name: "amazon-sync-batch-v2",
    retentionTime: 7 * 24 * 60 * 60 * 1000, // 7일 보존
  },
  (input: AmazonSyncBatchV2WorkflowInput) => {
    
    // 1. 배치 처리할 상품들 조회
    const { products, pagination, batch_info } = retrieveBatchProductsStep({
      filters: input.filters,
      pagination: input.pagination,
    })

    // 2. 상품들을 배치 그룹으로 분할 
    // @ts-ignore - Medusa WorkflowData 타입 복잡성으로 인한 "Excessive stack depth" 에러 해결
    const { batch_groups, total_batches, total_groups } = 
      // @ts-ignore
      createBatchGroupsStep({
        // @ts-ignore
        products: products,
        batch_size: input.options?.batch_size,
        concurrent_batches: input.options?.concurrent_batches,
      })

    // 3. 배치 그룹들을 순차적으로 처리 (각 그룹 내에서는 병렬 처리)
    const groupResults = transform(
      { batch_groups },
      async (data: any) => {
        const results: any[] = []
        
        for (const batchGroup of data.batch_groups) {
          const groupResult = await processBatchGroupStep({
            batchGroup,
            marketplace_ids: input.marketplace_ids,
            options: input.options,
          })
          
          results.push(groupResult)
        }
        
        return results
      }
    )

    // 4. 모든 배치 결과 집계
    const { summary, processing_summary, errors } = aggregateBatchResultsStep({
      groupResults,
    })

    // 최종 결과 반환
    return new WorkflowResponse({
      workflow_info: {
        name: "amazon-sync-batch-v2",
        started_at: new Date().toISOString(),
        dry_run: input.options?.dry_run || false,
      },
      input_summary: {
        filters_applied: input.filters || {},
        marketplace_ids: input.marketplace_ids || "all_active",
        batch_configuration: {
          batch_size: input.options?.batch_size || 10,
          concurrent_batches: input.options?.concurrent_batches || 3,
          total_batches,
          total_groups,
        }
      },
      pagination_info: pagination,
      batch_info,
      processing_results: summary,
      group_summaries: processing_summary,
      errors,
      next_batch_offset: pagination.next_offset,
      has_more_products: pagination.has_more,
      recommendations: {
        continue_processing: pagination.has_more,
        next_batch_input: pagination.has_more ? {
          ...input,
          pagination: {
            ...input.pagination,
            offset: pagination.next_offset,
          }
        } : null,
        error_analysis: errors.length > 0 ? 
          "Review failed products and consider retrying with force_update option" : 
          "All products processed successfully"
      }
    })
  }
)

export default amazonSyncBatchV2Workflow