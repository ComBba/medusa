import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../lib/config"

export interface FetchError extends Error {
  status?: number
  statusText?: string
}

export interface AmazonSyncOptions {
  sync_images?: boolean
  include_variants?: boolean
  force_update?: boolean
}

export interface AmazonSyncResult {
  product_id: string
  product_title: string
  processed_marketplaces: number
  sync_records_created: number
  mapping_results: {
    successful: number
    failed: number
    failures?: any[]
  }
  upload_results: {
    successful: number
    failed: number
    details: any[]
  }
  overall_success: boolean
  timestamp: string
}

export interface BatchSyncOptions extends AmazonSyncOptions {
  batch_size?: number
  concurrent_batches?: number
  dry_run?: boolean
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
}

/**
 * Amazon 상품 동기화를 위한 React 훅
 */
export const useAmazonSync = () => {
  const queryClient = useQueryClient()
  const [syncProgress, setSyncProgress] = useState<{
    isRunning: boolean
    currentStep?: string
    progress?: number
  }>({ isRunning: false })

  // 단일 상품 동기화
  const syncProduct = useMutation({
    mutationFn: async ({
      product_id,
      marketplace_ids,
      options
    }: {
      product_id: string
      marketplace_ids?: string[]
      options?: AmazonSyncOptions
    }): Promise<AmazonSyncResult> => {
      setSyncProgress({ isRunning: true, currentStep: "상품 데이터 조회" })
      
      try {
        const response = await fetch(`/admin/amazon/sync/product`, {
          method: "POST",
          body: JSON.stringify({
            product_id,
            marketplace_ids,
            options
          }),
          headers: {
            "Content-Type": "application/json"
          }
        })

        if (!response.ok) {
          const error = new Error(`동기화 실패: ${response.statusText}`) as FetchError
          error.status = response.status
          error.statusText = response.statusText
          throw error
        }

        const result = await response.json()
        setSyncProgress({ isRunning: false })
        
        return result.data as AmazonSyncResult
      } catch (error) {
        setSyncProgress({ isRunning: false })
        throw error
      }
    },
    onSuccess: (data) => {
      // 관련 쿼리들 무효화
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-status"] })
      queryClient.invalidateQueries({ queryKey: ["amazon-marketplace"] })
      queryClient.invalidateQueries({ queryKey: ["product", data.product_id] })
    },
    onError: () => {
      setSyncProgress({ isRunning: false })
    }
  })

  // 배치 동기화
  const syncBatch = useMutation<
    any,
    FetchError,
    BatchSyncOptions
  >({
    mutationFn: async (options: BatchSyncOptions) => {
      setSyncProgress({ isRunning: true, currentStep: "배치 준비 중" })
      
      try {
        const response = await fetch(`/admin/amazon/sync/batch`, {
          method: "POST",
          body: JSON.stringify(options),
          headers: {
            "Content-Type": "application/json"
          }
        })

        if (!response.ok) {
          const error = new Error(`배치 동기화 실패: ${response.statusText}`) as FetchError
          error.status = response.status
          error.statusText = response.statusText
          throw error
        }

        const result = await response.json()
        setSyncProgress({ isRunning: false })
        
        return result.data
      } catch (error) {
        setSyncProgress({ isRunning: false })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-status"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
    onError: () => {
      setSyncProgress({ isRunning: false })
    }
  })

  return {
    syncProduct: syncProduct.mutateAsync,
    syncBatch: syncBatch.mutateAsync,
    isSyncing: syncProduct.isPending || syncBatch.isPending,
    syncProgress,
    error: syncProduct.error || syncBatch.error
  }
}

/**
 * Amazon 동기화 상태 조회를 위한 훅
 */
export const useAmazonSyncStatus = (productId?: string) => {
  return useQuery({
    queryKey: ["amazon-sync-status", productId],
    queryFn: async () => {
      const url = productId 
        ? `/admin/amazon/sync/product/${productId}`
        : `/admin/amazon/sync/batch/status`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const error = new Error(`상태 조회 실패: ${response.statusText}`) as FetchError
        error.status = response.status
        error.statusText = response.statusText
        throw error
      }
      
      const result = await response.json()
      return result.data
    },
    refetchInterval: 5000, // 5초마다 자동 갱신
    enabled: true
  })
}

/**
 * Amazon 마켓플레이스 상태 조회를 위한 훅
 */
export const useAmazonMarketplaces = () => {
  return useQuery({
    queryKey: ["amazon-marketplace"],
    queryFn: async () => {
      const response = await fetch(`/admin/amazon/marketplaces`)
      
      if (!response.ok) {
        const error = new Error(`마켓플레이스 조회 실패: ${response.statusText}`) as FetchError
        error.status = response.status
        error.statusText = response.statusText
        throw error
      }
      
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
  })
}

/**
 * Amazon 마켓플레이스 활성화/비활성화를 위한 훅
 */
export const useAmazonMarketplaceToggle = () => {
  const queryClient = useQueryClient()

  return useMutation<
    any,
    FetchError,
    {
      marketplace_id: string
      is_active: boolean
    }
  >({
    mutationFn: async ({
      marketplace_id,
      is_active
    }) => {
      const response = await fetch(`/admin/amazon/marketplaces/${marketplace_id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active }),
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        const error = new Error(`마켓플레이스 상태 변경 실패: ${response.statusText}`) as FetchError
        error.status = response.status
        error.statusText = response.statusText
        throw error
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-marketplace"] })
    }
  })
}

/**
 * Amazon 동기화 이력 조회를 위한 훅
 */
export const useAmazonSyncHistory = (filters?: {
  product_id?: string
  marketplace_id?: string
  status?: string
  limit?: number
  offset?: number
}) => {
  return useQuery({
    queryKey: ["amazon-sync-history", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      if (filters?.product_id) params.append("product_id", filters.product_id)
      if (filters?.marketplace_id) params.append("marketplace_id", filters.marketplace_id)
      if (filters?.status) params.append("status", filters.status)
      if (filters?.limit) params.append("limit", filters.limit.toString())
      if (filters?.offset) params.append("offset", filters.offset.toString())
      
      const response = await fetch(`/admin/amazon/sync/history?${params.toString()}`)
      
      if (!response.ok) {
        const error = new Error(`동기화 이력 조회 실패: ${response.statusText}`) as FetchError
        error.status = response.status
        error.statusText = response.statusText
        throw error
      }
      
      const result = await response.json()
      return result.data
    },
    enabled: true
  })
}

/**
 * Amazon 동기화 실패 항목 재시도를 위한 훅
 */
export const useAmazonSyncRetry = () => {
  const queryClient = useQueryClient()

  return useMutation<
    any,
    FetchError,
    string[]
  >({
    mutationFn: async (syncRecordIds: string[]) => {
      const response = await fetch(`/admin/amazon/sync/retry`, {
        method: "POST",
        body: JSON.stringify({ sync_record_ids: syncRecordIds }),
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        const error = new Error(`재시도 실패: ${response.statusText}`) as FetchError
        error.status = response.status
        error.statusText = response.statusText
        throw error
      }

      const result = await response.json()
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-status"] })
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-history"] })
    }
  })
}

export default useAmazonSync