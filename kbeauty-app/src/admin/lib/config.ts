import Medusa from "@medusajs/js-sdk"

/**
 * Admin용 Medusa JS SDK 설정
 * Amazon 통합 시스템에서 사용하는 클라이언트 설정
 */
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_MEDUSA_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:10000",
  debug: import.meta.env.DEV,
  auth: {
    type: "session"
  }
})

/**
 * Amazon 동기화 API 클라이언트
 * 커스텀 Amazon 통합 엔드포인트를 위한 래퍼 함수들
 */
export class AmazonSyncClient {
  private sdk: typeof Medusa.prototype

  constructor(sdkInstance = sdk) {
    this.sdk = sdkInstance
  }

  /**
   * 모든 Amazon 마켓플레이스 목록 조회 (표준 Medusa v2 패턴)
   */
  async getMarketplaces() {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/marketplaces", {
        method: "GET",
      })
      return response
    } catch (error) {
      console.error("Failed to fetch Amazon marketplaces:", error)
      throw error
    }
  }

  /**
   * 마켓플레이스 설정 업데이트 (표준 Medusa v2 패턴)
   */
  async updateMarketplace(marketplaceId: string, data: {
    seller_id?: string
    mws_token?: string
    is_active?: boolean
    auto_sync?: boolean
  }) {
    try {
      // API 엔드포인트가 기대하는 필드명으로 변환
      const requestData = {
        seller_id: data.seller_id,
        mws_auth_token: data.mws_token, // mws_token -> mws_auth_token 변환
        is_active: data.is_active,
        auto_sync: data.auto_sync,
      }
      
      console.log('Updating marketplace:', marketplaceId, requestData)
      
      const response = await this.sdk.client.fetch(`/admin/amazon/marketplaces/${marketplaceId}`, {
        method: "POST",
        body: requestData,
      })
      
      console.log('Update marketplace response:', response)
      return response
    } catch (error) {
      console.error(`Failed to update marketplace ${marketplaceId}:`, error)
      throw error
    }
  }

  /**
   * Amazon SP-API 연결 테스트 (표준 Medusa v2 패턴)
   */
  async testConnection(marketplaceId: string, sellerId?: string) {
    try {
      const requestBody: any = { marketplace_id: marketplaceId }
      if (sellerId) {
        requestBody.seller_id = sellerId
      }
      
      console.log('Testing connection with:', requestBody)
      
      const response = await this.sdk.client.fetch("/admin/amazon/test-connection", {
        method: "POST",
        body: requestBody,
      })
      return response
    } catch (error) {
      console.error(`Failed to test connection for ${marketplaceId}:`, error)
      throw error
    }
  }

  /**
   * 상품을 Amazon에 동기화 (표준 Medusa v2 패턴)
   */
  async syncProduct(productId: string, marketplaceIds: string[] = []) {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/sync/product", {
        method: "POST",
        body: {
          product_id: productId,
          marketplace_ids: marketplaceIds,
        },
      })
      return response
    } catch (error) {
      console.error(`Failed to sync product ${productId}:`, error)
      throw error
    }
  }

  /**
   * 재고 동기화 (표준 Medusa v2 패턴)
   */
  async syncInventory(productId: string, marketplaceIds: string[] = []) {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/sync/inventory", {
        method: "POST",
        body: {
          product_id: productId,
          marketplace_ids: marketplaceIds,
        },
      })
      return response
    } catch (error) {
      console.error(`Failed to sync inventory for ${productId}:`, error)
      throw error
    }
  }

  /**
   * 가격 동기화 (표준 Medusa v2 패턴)
   */
  async syncPrice(productId: string, marketplaceIds: string[] = []) {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/sync/price", {
        method: "POST",
        body: {
          product_id: productId,
          marketplace_ids: marketplaceIds,
        },
      })
      return response
    } catch (error) {
      console.error(`Failed to sync price for ${productId}:`, error)
      throw error
    }
  }

  /**
   * 일괄 동기화 (표준 Medusa v2 패턴)
   */
  async syncAll(productId: string, marketplaceIds: string[] = []) {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/sync/all", {
        method: "POST",
        body: {
          product_id: productId,
          marketplace_ids: marketplaceIds,
        },
      })
      return response
    } catch (error) {
      console.error(`Failed to sync all for ${productId}:`, error)
      throw error
    }
  }

  /**
   * 동기화 상태 조회 (표준 Medusa v2 패턴)
   */
  async getSyncStatus(productId?: string) {
    try {
      const url = productId 
        ? `/admin/amazon/sync/status/${productId}`
        : "/admin/amazon/sync/status"
      
      const response = await this.sdk.client.fetch(url, {
        method: "GET",
      })
      return response
    } catch (error) {
      console.error("Failed to get sync status:", error)
      throw error
    }
  }

  /**
   * 동기화 통계 조회 (표준 Medusa v2 패턴)
   */
  async getSyncStats() {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/sync/stats", {
        method: "GET",
      })
      return response
    } catch (error) {
      console.error("Failed to get sync stats:", error)
      throw error
    }
  }

  /**
   * 동기화 레코드 목록 조회 (표준 Medusa v2 패턴)
   */
  async getSyncRecords(queryParams: string = '') {
    try {
      const url = `/admin/amazon/sync${queryParams ? `?${queryParams}` : ''}`
      const response = await this.sdk.client.fetch(url, {
        method: "GET",
      })
      return response
    } catch (error) {
      console.error("Failed to get sync records:", error)
      throw error
    }
  }

  /**
   * 동기화 재시도 (표준 Medusa v2 패턴)
   */
  async retrySync(data: {
    sync_record_ids?: string[]
    marketplace_id?: string
  }) {
    try {
      const response = await this.sdk.client.fetch("/admin/amazon/sync", {
        method: "PUT",
        body: data,
      })
      return response
    } catch (error) {
      console.error("Failed to retry sync:", error)
      throw error
    }
  }
}

/**
 * Amazon 동기화 클라이언트 인스턴스
 */
export const amazonSyncClient = new AmazonSyncClient()

/**
 * React Query와 함께 사용하기 위한 헬퍼 함수들
 */
export const amazonQueries = {
  marketplaces: () => ({
    queryKey: ["amazon", "marketplaces"],
    queryFn: () => amazonSyncClient.getMarketplaces(),
  }),
  
  syncStatus: (productId?: string) => ({
    queryKey: ["amazon", "sync-status", productId],
    queryFn: () => amazonSyncClient.getSyncStatus(productId),
  }),
  
  syncStats: () => ({
    queryKey: ["amazon", "sync-stats"],
    queryFn: () => amazonSyncClient.getSyncStats(),
  }),
}

/**
 * React Query Mutations
 */
export const amazonMutations = {
  updateMarketplace: () => ({
    mutationFn: ({ marketplaceId, data }: { 
      marketplaceId: string, 
      data: Parameters<AmazonSyncClient['updateMarketplace']>[1] 
    }) => amazonSyncClient.updateMarketplace(marketplaceId, data),
  }),
  
  testConnection: () => ({
    mutationFn: (marketplaceId: string) => amazonSyncClient.testConnection(marketplaceId),
  }),
  
  syncProduct: () => ({
    mutationFn: ({ productId, marketplaceIds }: { 
      productId: string, 
      marketplaceIds?: string[] 
    }) => amazonSyncClient.syncProduct(productId, marketplaceIds),
  }),
  
  syncInventory: () => ({
    mutationFn: ({ productId, marketplaceIds }: { 
      productId: string, 
      marketplaceIds?: string[] 
    }) => amazonSyncClient.syncInventory(productId, marketplaceIds),
  }),
  
  syncPrice: () => ({
    mutationFn: ({ productId, marketplaceIds }: { 
      productId: string, 
      marketplaceIds?: string[] 
    }) => amazonSyncClient.syncPrice(productId, marketplaceIds),
  }),
  
  syncAll: () => ({
    mutationFn: ({ productId, marketplaceIds }: { 
      productId: string, 
      marketplaceIds?: string[] 
    }) => amazonSyncClient.syncAll(productId, marketplaceIds),
  }),
}

export default sdk