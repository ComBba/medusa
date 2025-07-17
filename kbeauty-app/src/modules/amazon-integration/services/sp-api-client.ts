import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { 
  AmazonCredentials, 
  AmazonProductData, 
  AmazonSyncResult, 
  AmazonAPIResponse,
  AmazonRegion 
} from '../types'

interface SPAPIConfig {
  region: AmazonRegion
  credentials: AmazonCredentials
  sandbox?: boolean
}

/**
 * Amazon SP-API 클라이언트
 * 
 * Amazon Selling Partner API와의 통신을 담당하는 클래스
 */
export class AmazonSPAPIClient {
  private client: AxiosInstance
  private credentials: AmazonCredentials
  private region: AmazonRegion
  private sandbox: boolean

  // 지역별 엔드포인트 매핑
  private static readonly ENDPOINTS = {
    NA: 'https://sellingpartnerapi-na.amazon.com',
    EU: 'https://sellingpartnerapi-eu.amazon.com', 
    FE: 'https://sellingpartnerapi-fe.amazon.com'
  }

  // 샌드박스 엔드포인트
  private static readonly SANDBOX_ENDPOINTS = {
    NA: 'https://sandbox.sellingpartnerapi-na.amazon.com',
    EU: 'https://sandbox.sellingpartnerapi-eu.amazon.com',
    FE: 'https://sandbox.sellingpartnerapi-fe.amazon.com'
  }

  constructor(config: SPAPIConfig) {
    this.credentials = config.credentials
    this.region = config.region
    this.sandbox = config.sandbox || false

    const baseURL = this.sandbox 
      ? AmazonSPAPIClient.SANDBOX_ENDPOINTS[this.region]
      : AmazonSPAPIClient.ENDPOINTS[this.region]

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'kbeauty-market/1.0.0 (Language=JavaScript)',
      }
    })

    // 요청 인터셉터 - 인증 헤더 추가
    this.client.interceptors.request.use(this.addAuthHeaders.bind(this))
    
    // 응답 인터셉터 - 에러 처리
    this.client.interceptors.response.use(
      response => response,
      this.handleResponseError.bind(this)
    )
  }

  /**
   * 인증 헤더를 요청에 추가
   */
  private async addAuthHeaders(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    // LWA (Login with Amazon) 토큰 구현
    // 실제 구현에서는 AWS SigV4 서명과 LWA 토큰이 필요합니다
    const accessToken = await this.getAccessToken()
    
    config.headers = {
      ...config.headers,
      'x-amz-access-token': accessToken,
      'x-amz-date': new Date().toISOString(),
    }

    return config
  }

  /**
   * Access Token 획득 (LWA)
   * TODO: 실제 구현 시 Amazon LWA 토큰 획득 로직 구현 필요
   */
  private async getAccessToken(): Promise<string> {
    // 임시 구현 - 실제로는 LWA API를 통해 토큰을 획득해야 함
    return 'temp_access_token'
  }

  /**
   * API 응답 에러 처리
   */
  private handleResponseError(error: any) {
    if (error.response) {
      const { status, data } = error.response
      throw new Error(`Amazon API Error ${status}: ${data.message || error.message}`)
    }
    throw error
  }

  /**
   * 상품을 Amazon에 등록 (Feed API 사용)
   */
  async submitProductFeed(products: AmazonProductData[]): Promise<AmazonSyncResult> {
    try {
      // XML 피드 생성
      const feedContent = this.generateProductFeedXML(products)
      
      // Feed 제출
      const response = await this.client.post('/feeds/2021-06-30/feeds', {
        feedType: 'POST_PRODUCT_DATA',
        marketplaceIds: [this.credentials.marketplace_id],
        inputFeedDocumentId: await this.uploadFeedDocument(feedContent)
      })

      return {
        success: true,
        feed_submission_id: response.data.feedId,
        sku: products[0]?.sku
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FEED_SUBMISSION_ERROR',
          message: error.message
        }
      }
    }
  }

  /**
   * Feed 상태 확인
   */
  async getFeedStatus(feedId: string): Promise<AmazonAPIResponse> {
    try {
      const response = await this.client.get(`/feeds/2021-06-30/feeds/${feedId}`)
      
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FEED_STATUS_ERROR',
          message: error.message
        }
      }
    }
  }

  /**
   * 상품 정보 조회 (Catalog API)
   */
  async getProduct(asin: string): Promise<AmazonAPIResponse> {
    try {
      const response = await this.client.get(
        `/catalog/2022-04-01/items/${asin}`,
        {
          params: {
            marketplaceIds: this.credentials.marketplace_id,
            includedData: 'summaries,attributes,images,productTypes,salesRanks'
          }
        }
      )

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_FETCH_ERROR',
          message: error.message
        }
      }
    }
  }

  /**
   * 상품 피드 XML 생성
   */
  private generateProductFeedXML(products: AmazonProductData[]): string {
    // 실제 구현에서는 Amazon MWS/SP-API XML 스키마에 맞게 생성
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<AmazonEnvelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="amzn-envelope.xsd">
  <Header>
    <DocumentVersion>1.01</DocumentVersion>
    <MerchantIdentifier>${this.credentials.seller_id}</MerchantIdentifier>
  </Header>
  <MessageType>Product</MessageType>
  ${products.map((product, index) => `
  <Message>
    <MessageID>${index + 1}</MessageID>
    <OperationType>Update</OperationType>
    <Product>
      <SKU>${product.sku}</SKU>
      <StandardProductID>
        <Type>UPC</Type>
        <Value>${product.sku}</Value>
      </StandardProductID>
      <ProductTaxCode>A_GEN_NOTAX</ProductTaxCode>
      <DescriptionData>
        <Title>${product.title}</Title>
        <Brand>${product.brand || 'kbeauty.market'}</Brand>
        <Description>${product.description || ''}</Description>
        <ItemType>${product.product_type}</ItemType>
      </DescriptionData>
    </Product>
  </Message>
  `).join('')}
</AmazonEnvelope>`

    return xmlContent
  }

  /**
   * Feed 문서 업로드
   */
  private async uploadFeedDocument(content: string): Promise<string> {
    // 1단계: Feed 문서 생성
    const createDocResponse = await this.client.post('/feeds/2021-06-30/documents', {
      contentType: 'text/xml; charset=utf-8'
    })

    const { url, feedDocumentId } = createDocResponse.data

    // 2단계: 문서 업로드
    await axios.put(url, content, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8'
      }
    })

    return feedDocumentId
  }
}

export default AmazonSPAPIClient 