import { MedusaService } from "@medusajs/framework/utils"
import AmazonMarketplace from "./models/amazon-marketplace"
import AmazonProductSync from "./models/amazon-product-sync"

type InjectedDependencies = {
  // 추후 필요한 의존성들 추가 예정
}

/**
 * Amazon 연동 모듈의 메인 서비스
 * 
 * Amazon SP-API와의 통신, 상품 동기화, 마켓플레이스 관리 등을 담당
 */
class AmazonIntegrationModuleService extends MedusaService({
  AmazonMarketplace,
  AmazonProductSync,
}) {
  protected readonly dependencies_: InjectedDependencies

  constructor(dependencies: InjectedDependencies) {
    super(...arguments)
    this.dependencies_ = dependencies
  }

  /**
   * 활성화된 Amazon 마켓플레이스 목록 조회
   */
  async getActiveMarketplaces() {
    return await this.listAmazonMarketplaces({
      is_active: true,
    })
  }

  /**
   * 특정 상품의 Amazon 동기화 상태 조회
   */
  async getProductSyncStatus(productId: string) {
    return await this.listAmazonProductSyncs({
      medusa_product_id: productId,
    })
  }

  /**
   * 동기화 실패한 상품들 조회
   */
  async getFailedSyncs() {
    return await this.listAmazonProductSyncs({
      sync_status: "failed",
    })
  }

  /**
   * 동기화 재시도가 필요한 상품들 조회
   */
  async getPendingSyncs() {
    return await this.listAmazonProductSyncs({
      sync_status: "pending",
    })
  }

  /**
   * 마켓플레이스별 동기화 통계 조회
   */
  async getSyncStatistics(marketplaceId?: string) {
    const filters = marketplaceId ? { amazon_marketplace_id: marketplaceId } : {}
    const syncs = await this.listAmazonProductSyncs(filters)
    
    const stats = {
      total: syncs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }

    syncs.forEach(sync => {
      stats[sync.sync_status]++
    })

    return stats
  }
}

export default AmazonIntegrationModuleService 