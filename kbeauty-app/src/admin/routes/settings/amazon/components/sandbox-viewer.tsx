import {
  Container,
  Heading,
  Text,
  Button,
  Badge,
  IconButton,
  Input,
  Tabs,
  StatusBadge
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { 
  ArrowPath, 
  MagnifyingGlass,
  ArrowLongRight,
  Eye,
  DocumentText
} from "@medusajs/icons"
// import { amazonSyncClient } from "../../../../lib/config"

interface SandboxProduct {
  sku: string
  asin?: string
  title: string
  status: 'active' | 'inactive' | 'pending' | 'error'
  marketplace: string
  lastUpdated: string
  listingUrl?: string
  details?: {
    price?: number
    quantity?: number
    brand?: string
    category?: string
  }
}

export const SandboxViewer = () => {
  const [products, setProducts] = useState<SandboxProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  // const [selectedMarketplace, setSelectedMarketplace] = useState("ATVPDKIKX0DER")
  const [activeTab, setActiveTab] = useState("products")

  // Amazon 샌드박스 상품 목록 조회
  const fetchSandboxProducts = async () => {
    setLoading(true)
    try {
      console.log('🔍 [SANDBOX] Amazon 샌드박스 상품 조회 중...')
      
      // 실제 환경에서는 Amazon SP-API Listings API를 사용
      // 여기서는 시뮬레이션된 샌드박스 데이터 제공
      const mockSandboxProducts: SandboxProduct[] = [
        {
          sku: "KBEAUTY-001",
          asin: "B0SANDBOX01",
          title: "K-Beauty Premium Vitamin C Serum (Sandbox)",
          status: "active",
          marketplace: "Amazon.com US",
          lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          listingUrl: "https://www.amazon.com/dp/B0SANDBOX01",
          details: {
            price: 29.99,
            quantity: 50,
            brand: "K-Beauty",
            category: "Beauty > Skin Care > Serums"
          }
        },
        {
          sku: "KBEAUTY-002",
          asin: "B0SANDBOX02",
          title: "Hydrating Sheet Mask Set (Sandbox Test)",
          status: "pending",
          marketplace: "Amazon.com US",
          lastUpdated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          details: {
            price: 19.99,
            quantity: 100,
            brand: "K-Beauty",
            category: "Beauty > Skin Care > Masks"
          }
        },
        {
          sku: "KBEAUTY-003",
          title: "Anti-Aging Night Cream (Validation Preview)",
          status: "error",
          marketplace: "Amazon.com US",
          lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          details: {
            price: 39.99,
            quantity: 25,
            brand: "K-Beauty",
            category: "Beauty > Skin Care > Moisturizers"
          }
        }
      ]
      
      setProducts(mockSandboxProducts)
      console.log(`✅ [SANDBOX] ${mockSandboxProducts.length}개의 샌드박스 상품을 가져왔습니다`)
      
    } catch (error) {
      console.error('Failed to fetch sandbox products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  // 검색 필터링
  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.asin && product.asin.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  useEffect(() => {
    fetchSandboxProducts()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green'
      case 'pending': return 'orange'
      case 'error': return 'red'
      default: return 'grey'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '활성'
      case 'pending': return '처리중'
      case 'error': return '오류'
      case 'inactive': return '비활성'
      default: return '알 수 없음'
    }
  }

  return (
    <Container className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h2" className="mb-2">🧪 Amazon 샌드박스 상품 뷰어</Heading>
          <Text className="text-medusa-fg-subtle">
            Amazon 샌드박스 환경에 등록된 상품들을 확인하고 관리할 수 있습니다
          </Text>
        </div>
        <Button
          variant="secondary"
          onClick={fetchSandboxProducts}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <ArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 샌드박스 환경 정보 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-blue-100 text-blue-800">
            🧪 SANDBOX MODE
          </Badge>
          <Text size="small" className="text-blue-700">
            테스트 환경에서 실행 중
          </Text>
        </div>
        <Text size="small" className="text-blue-600">
          • 이 데이터는 Amazon SP-API 샌드박스 환경의 테스트 데이터입니다<br/>
          • 실제 Amazon 판매에는 영향을 주지 않습니다<br/>
          • VALIDATION_PREVIEW 모드로 상품 검증을 테스트할 수 있습니다
        </Text>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="mb-4">
          <Tabs.Trigger value="products">샌드박스 상품</Tabs.Trigger>
          <Tabs.Trigger value="submissions">제출 기록</Tabs.Trigger>
          <Tabs.Trigger value="validation">검증 결과</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="products">
          {/* 검색 및 필터 */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-medusa-fg-muted" />
              <Input
                placeholder="상품명, SKU, ASIN으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Text size="small" className="text-medusa-fg-subtle">
              {filteredProducts.length}개 상품
            </Text>
          </div>

          {/* 상품 목록 */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPath className="w-6 h-6 animate-spin" />
                <Text className="ml-2">샌드박스 상품을 불러오는 중...</Text>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Text className="text-medusa-fg-muted">
                  {searchTerm ? '검색 결과가 없습니다' : '샌드박스에 등록된 상품이 없습니다'}
                </Text>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div key={product.sku} className="border border-medusa-border-base rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Heading level="h3" className="text-lg">
                          {product.title}
                        </Heading>
                        <StatusBadge color={getStatusColor(product.status)}>
                          {getStatusText(product.status)}
                        </StatusBadge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Text className="font-medium">SKU:</Text>
                          <Text className="text-medusa-fg-muted">{product.sku}</Text>
                        </div>
                        {product.asin && (
                          <div>
                            <Text className="font-medium">ASIN:</Text>
                            <Text className="text-medusa-fg-muted">{product.asin}</Text>
                          </div>
                        )}
                        <div>
                          <Text className="font-medium">마켓플레이스:</Text>
                          <Text className="text-medusa-fg-muted">{product.marketplace}</Text>
                        </div>
                        <div>
                          <Text className="font-medium">마지막 업데이트:</Text>
                          <Text className="text-medusa-fg-muted">
                            {new Date(product.lastUpdated).toLocaleString('ko-KR')}
                          </Text>
                        </div>
                      </div>

                      {product.details && (
                        <div className="mt-3 p-3 bg-medusa-bg-subtle rounded">
                          <Text className="font-medium mb-2">상품 정보:</Text>
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <Text className="text-medusa-fg-muted">가격: ${product.details.price}</Text>
                            </div>
                            <div>
                              <Text className="text-medusa-fg-muted">수량: {product.details.quantity}</Text>
                            </div>
                            <div>
                              <Text className="text-medusa-fg-muted">브랜드: {product.details.brand}</Text>
                            </div>
                            <div>
                              <Text className="text-medusa-fg-muted">카테고리: {product.details.category}</Text>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {product.listingUrl && (
                        <IconButton
                          variant="transparent"
                          onClick={() => window.open(product.listingUrl, '_blank')}
                          title="Amazon에서 보기"
                        >
                          <ArrowLongRight className="w-4 h-4" />
                        </IconButton>
                      )}
                      <IconButton
                        variant="transparent"
                        title="상세 정보"
                      >
                        <Eye className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="submissions">
          <div className="text-center py-12">
            <DocumentText className="w-12 h-12 mx-auto mb-4 text-medusa-fg-muted" />
            <Text className="text-medusa-fg-muted">
              제출 기록 기능은 개발 중입니다
            </Text>
          </div>
        </Tabs.Content>

        <Tabs.Content value="validation">
          <div className="text-center py-12">
            <DocumentText className="w-12 h-12 mx-auto mb-4 text-medusa-fg-muted" />
            <Text className="text-medusa-fg-muted">
              검증 결과 기능은 개발 중입니다
            </Text>
          </div>
        </Tabs.Content>
      </Tabs>

      {/* 최신 Amazon SP-API 테스트 가이드 (2024-2025) */}
      <div className="mt-8 p-4 bg-medusa-bg-subtle border border-medusa-border-base rounded-lg">
        <Heading level="h3" className="mb-3">🔧 Amazon SP-API 테스트 가이드 (최신)</Heading>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <Text className="font-medium text-blue-800 mb-2">📍 올바른 테스트 환경 접근:</Text>
            <div className="space-y-1 text-sm">
              <div><strong>1. Seller Central:</strong> https://sellercentral.amazon.com</div>
              <div><strong>2. Developer Console:</strong> Apps and Services → Develop Apps</div>
              <div><strong>3. SP-API 샌드박스:</strong> https://sandbox.sellingpartnerapi.amazon.com</div>
            </div>
          </div>
          
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <Text className="font-medium text-green-800 mb-2">✅ 테스트 절차:</Text>
            <div className="space-y-1 text-sm">
              <div><strong>1.</strong> 환경변수 설정: AMAZON_SANDBOX_MODE=true</div>
              <div><strong>2.</strong> Developer Console에서 앱 등록 및 인증</div>
              <div><strong>3.</strong> 연결 테스트 탭에서 SP-API 연결 확인</div>
              <div><strong>4.</strong> VALIDATION_PREVIEW 모드로 상품 검증</div>
              <div><strong>5.</strong> 테스트 완료 후 프로덕션 전환</div>
            </div>
          </div>
          
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <Text className="font-medium text-yellow-800 mb-2">⚠️ 중요한 변경사항:</Text>
            <div className="space-y-1 text-sm text-yellow-700">
              <div>• 구 URL (sandbox.sellercentral.amazon.com)은 더 이상 사용되지 않음</div>
              <div>• 모든 테스트는 일반 Seller Central의 Developer Console을 통해 진행</div>
              <div>• SP-API 샌드박스는 통일된 엔드포인트 사용 (지역 구분 없음)</div>
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <Text className="font-medium text-blue-800 mb-2">📖 공식 문서 참고:</Text>
            <div className="space-y-1 text-sm text-blue-700">
              <div>• <strong>SP-API 문서:</strong> https://developer-docs.amazon.com/sp-api/docs/welcome</div>
              <div>• <strong>온보딩 가이드:</strong> https://developer-docs.amazon.com/sp-api/docs/onboarding-overview</div>
              <div>• <strong>샌드박스 가이드:</strong> https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox</div>
              <div>• <strong>API 레퍼런스:</strong> https://developer-docs.amazon.com/sp-api/reference</div>
              <div>• <strong>마켓플레이스 ID:</strong> https://developer-docs.amazon.com/sp-api/docs/marketplace-ids</div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}