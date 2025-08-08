import { MedusaService } from "@medusajs/framework/utils"
import AmazonMarketplace from "./models/amazon-marketplace"
import AmazonProductSync from "./models/amazon-product-sync"
import { AmazonSPAPIClient, AmazonSPAPIConfig } from "./services/amazon-sp-api-client"

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
  private spApiClient: AmazonSPAPIClient | null = null

  constructor(dependencies: InjectedDependencies) {
    super(...arguments)
    this.dependencies_ = dependencies
  }

  /**
   * Amazon SP-API 클라이언트 초기화
   */
  private initializeSpApiClient(): AmazonSPAPIClient {
    if (this.spApiClient) {
      return this.spApiClient
    }

    const config = this.getSpApiConfig()
    
    if (!config.isConfigured) {
      throw new Error('Amazon SP-API 설정이 완료되지 않았습니다. 환경변수를 확인해주세요.')
    }

    const spApiConfig: AmazonSPAPIConfig = {
      region: this.mapAwsRegionToSpApiRegion(config.region || 'us-east-1'),
      refreshToken: config.refreshToken || '',
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      sandbox: process.env.AMAZON_SP_API_SANDBOX === 'true',
      marketplace: process.env.AMAZON_MARKETPLACE_IDS?.split(',')[0]
    }

    this.spApiClient = new AmazonSPAPIClient(spApiConfig)
    return this.spApiClient
  }

  /**
   * SP-API 클라이언트 가져오기 (Lazy Loading)
   */
  private getSpApiClient(): AmazonSPAPIClient {
    return this.initializeSpApiClient()
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

  /**
   * 상품 동기화 레코드 개수 조회
   */
  async countAmazonProductSyncs(filters: any = {}) {
    const records = await this.listAmazonProductSyncs(filters)
    return records.length
  }

  /**
   * Amazon SP-API를 사용하여 상품을 Amazon에 제출
   * 새로운 공식 SDK 사용
   */
  async submitProductToAmazon(productId: string, marketplaceId: string, mode: string = 'VALIDATION_PREVIEW') {
    try {
      const spApiClient = this.getSpApiClient()
      const spApiConfig = this.getSpApiConfig()

      // 샌드박스 환경 사용 여부 확인
      const isSandbox = process.env.AMAZON_SANDBOX_MODE === 'true' || mode === 'VALIDATION_PREVIEW'

      console.log(`🧪 [AMAZON SYNC] 샌드박스 모드: ${isSandbox ? 'YES' : 'NO'}`)
      console.log(`🔗 [AMAZON SYNC] 지역: ${spApiConfig.region}`)
      console.log(`📝 [AMAZON SYNC] 모드: ${mode}`)

      // Medusa 상품 정보 조회
      const productData = await this.getProductForAmazonSync(productId)
      
      // Amazon 리스팅 속성 생성
      const listingAttributes = this.createAmazonListingAttributes(productData, marketplaceId)

      // 상품 제출 (PUT 메서드로 생성/업데이트)
      const submissionResult = await spApiClient.putListingsItem(
        process.env.AMAZON_SELLER_ID || '',
        productData.sku,
        [marketplaceId],
        'PRODUCT', // 기본 제품 타입
        listingAttributes
      )

      console.log(`✅ [AMAZON SYNC] 제품 ${productId} 제출 완료:`, submissionResult)

      // 동기화 기록 업데이트
      await this.updateSyncRecord(productId, marketplaceId, 'completed', submissionResult)

      return submissionResult

    } catch (error) {
      console.error(`❌ [AMAZON SYNC] 제품 ${productId} 제출 실패:`, error)
      
      // 동기화 실패 기록
      await this.updateSyncRecord(productId, marketplaceId, 'failed', { error: error.message })
      
      throw error
    }
  }

  /**
   * 상품 가격 업데이트 (새로운 SDK 사용)
   */
  async updateProductPrice(productId: string, marketplaceId: string, price: number, currency: string = 'USD') {
    try {
      const spApiClient = this.getSpApiClient()
      const spApiConfig = this.getSpApiConfig()
      const productData = await this.getProductForAmazonSync(productId)

      const result = await spApiClient.updatePrice(
        process.env.AMAZON_SELLER_ID || '',
        productData.sku,
        marketplaceId,
        price,
        currency
      )

      console.log(`💰 [AMAZON SYNC] 가격 업데이트 완료: ${productId} -> ${price} ${currency}`)
      
      await this.updateSyncRecord(productId, marketplaceId, 'completed', { type: 'price_update', result })

      return result
    } catch (error) {
      console.error(`❌ [AMAZON SYNC] 가격 업데이트 실패:`, error)
      await this.updateSyncRecord(productId, marketplaceId, 'failed', { error: error.message })
      throw error
    }
  }

  /**
   * 상품 재고 업데이트 (새로운 SDK 사용)
   */
  async updateProductInventory(productId: string, marketplaceId: string, quantity: number) {
    try {
      const spApiClient = this.getSpApiClient()
      const spApiConfig = this.getSpApiConfig()
      const productData = await this.getProductForAmazonSync(productId)

      const result = await spApiClient.updateInventory(
        process.env.AMAZON_SELLER_ID || '',
        productData.sku,
        marketplaceId,
        quantity
      )

      console.log(`📦 [AMAZON SYNC] 재고 업데이트 완료: ${productId} -> ${quantity}개`)
      
      await this.updateSyncRecord(productId, marketplaceId, 'completed', { type: 'inventory_update', result })

      return result
    } catch (error) {
      console.error(`❌ [AMAZON SYNC] 재고 업데이트 실패:`, error)
      await this.updateSyncRecord(productId, marketplaceId, 'failed', { error: error.message })
      throw error
    }
  }

  /**
   * 아마존 마켓플레이스 연결 테스트 (새로운 SDK 사용)
   */
  async testAmazonConnection() {
    try {
      const spApiClient = this.getSpApiClient()
      const result = await spApiClient.testConnection()

      console.log(`🔗 [AMAZON SYNC] 연결 테스트:`, result)
      return result
    } catch (error) {
      console.error(`❌ [AMAZON SYNC] 연결 테스트 실패:`, error)
      throw error
    }
  }

  /**
   * 마켓플레이스 참여 정보 조회 (새로운 SDK 사용)
   */
  async getMarketplaceParticipations() {
    try {
      const spApiClient = this.getSpApiClient()
      const result = await spApiClient.getMarketplaceParticipations()

      console.log(`🌍 [AMAZON SYNC] 마켓플레이스 참여 정보 조회 완료`)
      return result
    } catch (error) {
      console.error(`❌ [AMAZON SYNC] 마켓플레이스 참여 정보 조회 실패:`, error)
      throw error
    }
  }

  /**
   * Amazon 리스팅 정보 조회 (새로운 SDK 사용)
   */
  async getAmazonListing(sku: string, marketplaceId: string) {
    try {
      const spApiClient = this.getSpApiClient()
      const spApiConfig = this.getSpApiConfig()

      const result = await spApiClient.getListingsItem(
        process.env.AMAZON_SELLER_ID || '',
        sku,
        [marketplaceId]
      )

      console.log(`📋 [AMAZON SYNC] 리스팅 정보 조회 완료: ${sku}`)
      return result
    } catch (error) {
      console.error(`❌ [AMAZON SYNC] 리스팅 정보 조회 실패:`, error)
      throw error
    }
  }

  /**
   * AWS 리전을 SP-API 리전으로 매핑
   */
  private mapAwsRegionToSpApiRegion(awsRegion: string): string {
    const regionMap: Record<string, string> = {
      'us-east-1': 'na',
      'us-west-2': 'na',
      'eu-west-1': 'eu',
      'ap-southeast-1': 'fe',
      'ap-northeast-1': 'fe'
    }
    
    return regionMap[awsRegion] || 'na'
  }

  /**
   * SP-API 설정 가져오기
   */
  private getSpApiConfig() {
    const config = {
      clientId: process.env.AMAZON_LWA_CLIENT_ID,
      clientSecret: process.env.AMAZON_LWA_CLIENT_SECRET,
      refreshToken: process.env.AMAZON_LWA_REFRESH_TOKEN,
      sellerId: process.env.AMAZON_SELLER_ID,
      region: process.env.AMAZON_SP_API_REGION || 'us-east-1',
      isConfigured: false
    }

    config.isConfigured = !!(config.clientId && config.clientSecret && config.refreshToken && config.sellerId)

    return config
  }

  /**
   * 샌드박스 엔드포인트 가져오기 (2024-2025 최신)
   * 모든 지역에서 통일된 샌드박스 엔드포인트 사용
   */
  private getSandboxEndpoint(region: string) {
    // 2024-2025 최신: 모든 지역에서 동일한 샌드박스 엔드포인트 사용
    return 'https://sandbox.sellingpartnerapi.amazon.com'
  }

    /**
   * 프로덕션 엔드포인트 가져오기 (공식 문서 기준)
   * Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints
   */
  private getProductionEndpoint(region: string) {
    const endpoints: Record<string, string> = {
      'NA': 'https://sellingpartnerapi-na.amazon.com',    // North America
      'EU': 'https://sellingpartnerapi-eu.amazon.com',    // Europe
      'FE': 'https://sellingpartnerapi-fe.amazon.com'     // Far East
    }
    return endpoints[region] || endpoints['NA']
  }

  /**
   * 마켓플레이스 ID 매핑 (공식 문서 기준)
   * Reference: https://developer-docs.amazon.com/sp-api/docs/marketplace-ids
   */
  private getMarketplaceInfo() {
    return {
      // North America
      'ATVPDKIKX0DER': { name: 'United States', region: 'NA', country: 'US' },
      'A2EUQ1WTGCTBG2': { name: 'Canada', region: 'NA', country: 'CA' },
      'A1AM78C64UM0Y8': { name: 'Mexico', region: 'NA', country: 'MX' },
      'A2Q3Y263D00KWC': { name: 'Brazil', region: 'NA', country: 'BR' },
      
      // Europe
      'A1PA6795UKMFR9': { name: 'Germany', region: 'EU', country: 'DE' },
      'A1F83G8C2ARO7P': { name: 'United Kingdom', region: 'EU', country: 'UK' },
      'A13V1IB3VIYZZH': { name: 'France', region: 'EU', country: 'FR' },
      'APJ6JRA9NG5V4': { name: 'Italy', region: 'EU', country: 'IT' },
      'A1RKKUPIHCS9HS': { name: 'Spain', region: 'EU', country: 'ES' },
      'A1805IZSGTT6HS': { name: 'Netherlands', region: 'EU', country: 'NL' },
      'AMEN7PMS3EDWL': { name: 'Belgium', region: 'EU', country: 'BE' },
      'A2NODRKZP88ZB9': { name: 'Sweden', region: 'EU', country: 'SE' },
      'A1C3SOZRARQ6R3': { name: 'Poland', region: 'EU', country: 'PL' },
      'A28R8C7NBKEWEA': { name: 'Ireland', region: 'EU', country: 'IE' },
      'A33AVAJ2PDY3EV': { name: 'Turkey', region: 'EU', country: 'TR' },
      'A17E79C6D8DWNP': { name: 'Saudi Arabia', region: 'EU', country: 'SA' },
      'A2VIGQ35RCS4UG': { name: 'United Arab Emirates', region: 'EU', country: 'AE' },
      'A21TJRUUN4KGV': { name: 'India', region: 'EU', country: 'IN' },
      'AE08WJ6YKNBMC': { name: 'South Africa', region: 'EU', country: 'ZA' },
      'ARBP9OOSHTCHU': { name: 'Egypt', region: 'EU', country: 'EG' },
      
      // Far East
      'A1VC38T7YXB528': { name: 'Japan', region: 'FE', country: 'JP' },
      'A39IBJ37TRP1C6': { name: 'Australia', region: 'FE', country: 'AU' },
      'A19VAU5U5O7RUS': { name: 'Singapore', region: 'FE', country: 'SG' }
    }
  }

  /**
   * Amazon 동기화를 위한 상품 정보 조회
   * 실제 구현에서는 ProductService를 사용해야 함
   */
  private async getProductForAmazonSync(productId: string) {
    // 임시 구현 - 실제로는 Medusa ProductService에서 상품 정보를 가져와야 함
    return {
      id: productId,
      sku: `SKU-${productId}`,
      title: `K-Beauty Product ${productId}`,
      description: `Premium Korean beauty product for international market`,
      price: 29.99,
      weight: 100,
      dimensions: {
        length: 10,
        width: 5,
        height: 3
      },
      images: [
        `https://example.com/product-${productId}-1.jpg`,
        `https://example.com/product-${productId}-2.jpg`
      ]
    }
  }

  /**
   * Amazon 리스팅 속성 생성 (새로운 SDK용)
   */
  private createAmazonListingAttributes(product: any, marketplaceId: string) {
    return {
      item_name: [
        {
          value: product.title,
          language_tag: "en_US"
        }
      ],
      product_description: [
        {
          value: product.description,
          language_tag: "en_US"
        }
      ],
      purchasable_offer: [
        {
          marketplace_id: marketplaceId,
          currency: "USD",
          our_price: [
            {
              schedule: [
                {
                  value_with_tax: product.price
                }
              ]
            }
          ]
        }
      ],
      fulfillment_availability: [
        {
          fulfillment_channel_code: "DEFAULT",
          quantity: 100, // 기본 재고
          marketplace_id: marketplaceId
        }
      ],
      item_weight: [
        {
          unit: "grams",
          value: product.weight || 100
        }
      ],
      item_dimensions: [
        {
          length: {
            unit: "centimeters",
            value: product.dimensions?.length || 10
          },
          width: {
            unit: "centimeters", 
            value: product.dimensions?.width || 5
          },
          height: {
            unit: "centimeters",
            value: product.dimensions?.height || 3
          }
        }
      ],
      main_product_image_locator: [
        {
          media_location: product.images?.[0] || "https://example.com/default-image.jpg"
        }
      ]
    }
  }

  /**
   * 동기화 기록 업데이트
   */
  private async updateSyncRecord(productId: string, marketplaceId: string, status: 'completed' | 'failed', data: any) {
    try {
      // 기존 동기화 기록 찾기
      const existingSyncs = await this.listAmazonProductSyncs({
        medusa_product_id: productId,
        marketplace_id: marketplaceId
      })

      const syncData = {
        medusa_product_id: productId,
        marketplace_id: marketplaceId,
        sync_status: status,
        last_sync_at: new Date(),
        sync_data: data,
        error_message: status === 'failed' ? data.error : null
      }

      if (existingSyncs.length > 0) {
        // 기존 기록 업데이트
        await this.updateAmazonProductSyncs([{
          selector: { id: existingSyncs[0].id },
          data: syncData
        }])
      } else {
        // 새 기록 생성
        await this.createAmazonProductSyncs(syncData)
      }
    } catch (error) {
      console.error(`동기화 기록 업데이트 실패:`, error)
    }
  }

  /**
   * Amazon 리스팅 페이로드 생성 (레거시 - 하위 호환성 유지)
   */
  private createAmazonListingPayload(product: any, marketplaceId: string, mode: string) {
    return {
      productType: "BEAUTY",
      requirements: mode,
      attributes: {
        item_name: [
          {
            value: product.title,
            language_tag: "en_US"
          }
        ],
        brand: [
          {
            value: "K-Beauty",
            language_tag: "en_US"
          }
        ],
        manufacturer: [
          {
            value: "Korean Beauty Co.",
            language_tag: "en_US"
          }
        ],
        item_type_name: [
          {
            value: "Beauty Product",
            language_tag: "en_US"
          }
        ],
        externally_assigned_product_identifier: [
          {
            type: "UPC",
            value: `8${Math.random().toString().slice(2, 13)}`
          }
        ],
        purchasable_offer: [
          {
            marketplace_id: marketplaceId,
            currency: "USD",
            our_price: [
              {
                schedule: [
                  {
                    value_with_tax: product.price
                  }
                ]
              }
            ]
          }
        ],
        fulfillment_availability: [
          {
            fulfillment_channel_code: "AMAZON_NA",
            quantity: 10
          }
        ]
      }
    }
  }

  /**
   * SP-API Listings Items API 호출 (공식 규격)
   * Reference: https://developer-docs.amazon.com/sp-api/reference/listings-items-v2021-08-01
   */
  private async callSpApiListings(
    baseUrl: string,
    config: any,
    payload: any,
    sku: string,
    marketplaceId: string
  ) {
    try {
      // 1. LWA Access Token 획득 (실제 구현에서는 토큰 캐싱 필요)
      const accessToken = await this.getLwaAccessToken(config)
      
      // 2. SP-API 엔드포인트 구성 (공식 스키마)
      const sellerId = config.sellerId
      const endpoint = `${baseUrl}/listings/2021-08-01/items/${sellerId}/${sku}`
      const queryParams = `marketplaceIds=${marketplaceId}`
      const fullUrl = `${endpoint}?${queryParams}`
      
      // 3. 공식 HTTP 헤더 구성
      const headers = {
        'host': new URL(baseUrl).hostname,
        'x-amz-access-token': accessToken,
        'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
        'content-type': 'application/json',
        'user-agent': 'KBeauty-SP-API-Client/1.0'
      }
      
      console.log(`📡 [SP-API] PUT ${fullUrl}`)
      console.log(`🔑 [SP-API] Headers:`, Object.keys(headers).join(', '))
      console.log(`📦 [SP-API] Marketplace: ${marketplaceId}`)
      console.log(`📝 [SP-API] Payload:`, JSON.stringify(payload, null, 2))

      // 4. 실제 환경에서는 여기서 fetch/axios 호출
      // const response = await fetch(fullUrl, {
      //   method: 'PUT',
      //   headers: headers,
      //   body: JSON.stringify(payload)
      // })

      // 5. 샌드박스 시뮬레이션 응답 (공식 스키마 기준)
      const mockResponse = {
        sku: sku,
        status: "ACCEPTED",
        submissionId: `amzn1.sp-api.submission.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`,
        issues: [],
        warnings: config.isSandbox ? [
          {
            code: "SANDBOX_MODE",
            message: "이 제품은 샌드박스 환경에서 테스트되었습니다",
            severity: "WARNING"
          },
          {
            code: "VALIDATION_PREVIEW",
            message: "VALIDATION_PREVIEW 모드에서 실행됨 - 실제 리스팅이 생성되지 않습니다",
            severity: "INFO"
          }
        ] : []
      }

      // 6. API 지연 시뮬레이션 (실제 네트워크 호출 대신)
      await new Promise(resolve => setTimeout(resolve, 1500))

      console.log(`✅ [SP-API] 응답:`, mockResponse)
      return mockResponse
      
    } catch (error) {
      console.error('❌ [SP-API] Listings API 호출 실패:', error)
      throw new Error(`SP-API 호출 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * LWA (Login with Amazon) Access Token 획득
   * Reference: https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api
   */
  private async getLwaAccessToken(config: any): Promise<string> {
    try {
      const tokenEndpoint = 'https://api.amazon.com/auth/o2/token'
      
      // 실제 환경에서는 여기서 LWA 토큰 요청
      console.log('🔑 [LWA] Access Token 요청 시뮬레이션')
      
      // 토큰 캐싱 시뮬레이션 (실제로는 토큰 만료 시간 체크 필요)
      return `Atza|simulated_access_token_${Date.now()}`
      
    } catch (error) {
      console.error('❌ [LWA] 토큰 획득 실패:', error)
      throw new Error('LWA 인증 실패')
    }
  }
}

export default AmazonIntegrationModuleService 