const SellingPartner = require('amazon-sp-api')
import { ModuleServiceInitializeOptions } from "@medusajs/framework/types"

export interface AmazonSPAPIConfig {
  region: string
  refreshToken: string
  accessToken?: string
  clientId: string
  clientSecret: string
  sandbox?: boolean
  marketplace?: string
}

/**
 * Amazon SP-API 클라이언트 서비스
 * 공식 amazon-sp-api SDK를 사용하여 Amazon과의 통신을 담당
 */
export class AmazonSPAPIClient {
  private client: any
  private config: AmazonSPAPIConfig

  constructor(config: AmazonSPAPIConfig) {
    this.config = config
    this.initializeClient()
  }

  private initializeClient() {
    this.client = new SellingPartner({
      region: this.config.region,
      refresh_token: this.config.refreshToken,
      access_token: this.config.accessToken,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: this.config.clientId,
        SELLING_PARTNER_APP_CLIENT_SECRET: this.config.clientSecret,
      },
      options: {
        use_sandbox: this.config.sandbox || false,
        auto_request_tokens: true,
        auto_request_throttled: true,
        version_fallback: true,
      }
    })
  }

  /**
   * 마켓플레이스 참여 정보 조회
   */
  async getMarketplaceParticipations() {
    try {
      const result = await this.client.callAPI({
        operation: 'getMarketplaceParticipations',
        endpoint: 'sellers'
      })
      return result
    } catch (error) {
      throw new Error(`마켓플레이스 참여 정보 조회 실패: ${error.message}`)
    }
  }

  /**
   * 상품 정보 조회
   */
  async getCatalogItem(asin: string, marketplaceIds: string[]) {
    try {
      const result = await this.client.callAPI({
        operation: 'getCatalogItem',
        endpoint: 'catalogItems',
        path: {
          asin: asin
        },
        query: {
          marketplaceIds: marketplaceIds,
          includedData: ['identifiers', 'images', 'productTypes', 'salesRanks', 'summaries']
        }
      })
      return result
    } catch (error) {
      throw new Error(`상품 정보 조회 실패: ${error.message}`)
    }
  }

  /**
   * 리스팅 아이템 조회
   */
  async getListingsItem(sellerId: string, sku: string, marketplaceIds: string[]) {
    try {
      const result = await this.client.callAPI({
        operation: 'getListingsItem',
        endpoint: 'listingsItems',
        path: {
          sellerId: sellerId,
          sku: sku
        },
        query: {
          marketplaceIds: marketplaceIds,
          includedData: ['summaries', 'attributes', 'offers', 'fulfillmentAvailability', 'procurement']
        }
      })
      return result
    } catch (error) {
      throw new Error(`리스팅 아이템 조회 실패: ${error.message}`)
    }
  }

  /**
   * 리스팅 아이템 생성/업데이트
   */
  async putListingsItem(
    sellerId: string, 
    sku: string, 
    marketplaceIds: string[], 
    productType: string,
    attributes: any
  ) {
    try {
      const result = await this.client.callAPI({
        operation: 'putListingsItem',
        endpoint: 'listingsItems',
        path: {
          sellerId: sellerId,
          sku: sku
        },
        query: {
          marketplaceIds: marketplaceIds
        },
        body: {
          productType: productType,
          requirements: 'LISTING',
          attributes: attributes
        }
      })
      return result
    } catch (error) {
      throw new Error(`리스팅 아이템 생성/업데이트 실패: ${error.message}`)
    }
  }

  /**
   * 리스팅 아이템 부분 업데이트 (PATCH)
   */
  async patchListingsItem(
    sellerId: string,
    sku: string,
    marketplaceIds: string[],
    productType: string,
    patches: any[]
  ) {
    try {
      const result = await this.client.callAPI({
        operation: 'patchListingsItem',
        endpoint: 'listingsItems',
        path: {
          sellerId: sellerId,
          sku: sku
        },
        query: {
          marketplaceIds: marketplaceIds
        },
        body: {
          productType: productType,
          patches: patches
        }
      })
      return result
    } catch (error) {
      throw new Error(`리스팅 아이템 부분 업데이트 실패: ${error.message}`)
    }
  }

  /**
   * 재고 업데이트
   */
  async updateInventory(sellerId: string, sku: string, marketplaceId: string, quantity: number) {
    try {
      // 재고 업데이트는 리스팅 패치를 통해 수행
      const patches = [
        {
          op: 'replace',
          path: '/attributes/fulfillment_availability',
          value: [
            {
              fulfillment_channel_code: 'DEFAULT',
              quantity: quantity,
              marketplace_id: marketplaceId
            }
          ]
        }
      ]

      return await this.patchListingsItem(
        sellerId,
        sku,
        [marketplaceId],
        'PRODUCT', // 기본 제품 타입
        patches
      )
    } catch (error) {
      throw new Error(`재고 업데이트 실패: ${error.message}`)
    }
  }

  /**
   * 가격 업데이트
   */
  async updatePrice(
    sellerId: string, 
    sku: string, 
    marketplaceId: string, 
    price: number, 
    currency: string = 'USD'
  ) {
    try {
      const patches = [
        {
          op: 'replace',
          path: '/attributes/purchasable_offer',
          value: [
            {
              marketplace_id: marketplaceId,
              currency: currency,
              our_price: [
                {
                  schedule: [
                    {
                      value_with_tax: price
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]

      return await this.patchListingsItem(
        sellerId,
        sku,
        [marketplaceId],
        'PRODUCT',
        patches
      )
    } catch (error) {
      throw new Error(`가격 업데이트 실패: ${error.message}`)
    }
  }

  /**
   * 피드 생성 (벌크 업데이트용)
   */
  async createFeed(feedType: string, marketplaceIds: string[], inputFeedDocument: any) {
    try {
      const result = await this.client.callAPI({
        operation: 'createFeed',
        endpoint: 'feeds',
        body: {
          feedType: feedType,
          marketplaceIds: marketplaceIds,
          inputFeedDocument: inputFeedDocument
        }
      })
      return result
    } catch (error) {
      throw new Error(`피드 생성 실패: ${error.message}`)
    }
  }

  /**
   * 피드 상태 조회
   */
  async getFeed(feedId: string) {
    try {
      const result = await this.client.callAPI({
        operation: 'getFeed',
        endpoint: 'feeds',
        path: {
          feedId: feedId
        }
      })
      return result
    } catch (error) {
      throw new Error(`피드 상태 조회 실패: ${error.message}`)
    }
  }

  /**
   * 주문 목록 조회
   */
  async getOrders(marketplaceIds: string[], createdAfter?: string, orderStatuses?: string[]) {
    try {
      const query: any = {
        MarketplaceIds: marketplaceIds
      }

      if (createdAfter) {
        query.CreatedAfter = createdAfter
      }

      if (orderStatuses && orderStatuses.length > 0) {
        query.OrderStatuses = orderStatuses
      }

      const result = await this.client.callAPI({
        operation: 'getOrders',
        endpoint: 'orders',
        query: query
      })
      return result
    } catch (error) {
      throw new Error(`주문 목록 조회 실패: ${error.message}`)
    }
  }

  /**
   * 개별 주문 조회
   */
  async getOrder(orderId: string) {
    try {
      const result = await this.client.callAPI({
        operation: 'getOrder',
        endpoint: 'orders',
        path: {
          orderId: orderId
        }
      })
      return result
    } catch (error) {
      throw new Error(`주문 조회 실패: ${error.message}`)
    }
  }

  /**
   * 알림 설정 (Notifications API)
   */
  async createSubscription(notificationType: string, destinationId: string) {
    try {
      const result = await this.client.callAPI({
        operation: 'createSubscription',
        endpoint: 'notifications',
        body: {
          notificationType: notificationType,
          destinationId: destinationId
        }
      })
      return result
    } catch (error) {
      throw new Error(`알림 설정 실패: ${error.message}`)
    }
  }

  /**
   * 연결 테스트
   */
  async testConnection() {
    try {
      const result = await this.getMarketplaceParticipations()
      return {
        success: true,
        message: '연결 테스트 성공',
        data: result
      }
    } catch (error) {
      return {
        success: false,
        message: `연결 테스트 실패: ${error.message}`,
        error: error
      }
    }
  }

  /**
   * Rate Limit 정보 조회
   */
  getRateLimitInfo() {
    // amazon-sp-api SDK는 자동으로 rate limiting을 처리하지만
    // 필요시 수동으로 확인할 수 있는 메서드
    return {
      autoHandled: true,
      message: 'Rate limiting은 SDK에서 자동으로 처리됩니다.'
    }
  }

  /**
   * 클라이언트 재초기화 (토큰 갱신 시 사용)
   */
  refreshClient(newConfig?: Partial<AmazonSPAPIConfig>) {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig }
    }
    this.initializeClient()
  }
}

export default AmazonSPAPIClient