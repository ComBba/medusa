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

  /**
   * 상품 동기화 레코드 생성 (편의 메서드)
   */
  async createProductSync(data: any) {
    return await this.createAmazonProductSyncs(data)
  }

  /**
   * 상품 동기화 레코드 업데이트 (편의 메서드)
   */
  async updateProductSync(id: string, data: any) {
    return await this.updateAmazonProductSyncs({ id }, data)
  }

  /**
   * 상품 동기화 레코드 삭제 (편의 메서드)
   */
  async deleteProductSync(id: string) {
    return await this.deleteAmazonProductSyncs({ id })
  }

  /**
   * 마켓플레이스 생성 (편의 메서드)
   */
  async createMarketplace(data: any) {
    return await this.createAmazonMarketplaces(data)
  }

  /**
   * 마켓플레이스 업데이트 (편의 메서드)
   * Medusa v2 Framework의 올바른 update 패턴 사용
   */
  async updateMarketplace(id: string, data: any) {
    // 먼저 기존 엔티티를 조회
    const existingMarketplaces = await this.listAmazonMarketplaces({ id })
    
    if (existingMarketplaces.length === 0) {
      throw new Error(`마켓플레이스를 찾을 수 없습니다: ${id}`)
    }
    
    // Medusa v2의 올바른 배열 기반 update 패턴 사용
    const updated = await this.updateAmazonMarketplaces([
      {
        selector: { id }, // 업데이트할 엔티티 선택자
        data: data        // 업데이트할 데이터
      }
    ])
    
    return updated
  }

  /**
   * 마켓플레이스 삭제 (편의 메서드)
   */
  async deleteMarketplace(id: string) {
    return await this.deleteAmazonMarketplaces({ id })
  }
}

export default AmazonIntegrationModuleService 