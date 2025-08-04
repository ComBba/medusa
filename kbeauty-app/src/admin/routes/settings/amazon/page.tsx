import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Tabs } from "@medusajs/ui"
import { CloudArrowUp } from "@medusajs/icons"
import { AmazonMarketplacesTable } from "./components/marketplaces-table"
import { ConnectionTest } from "./components/connection-test"
import { SyncDashboard } from "./components/sync-dashboard"
import { ProductSyncTable } from "./components/product-sync-table"
import { SandboxViewer } from "./components/sandbox-viewer"
import { useState } from "react"

const AmazonIntegrationPage = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Amazon Integration</Heading>
          <Text className="text-medusa-fg-subtle">
            Manage your Amazon marketplace integrations and sync settings
          </Text>
        </div>
      </div>
      
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="overview">개요</Tabs.Trigger>
            <Tabs.Trigger value="marketplaces">마켓플레이스</Tabs.Trigger>
            <Tabs.Trigger value="products">상품 동기화</Tabs.Trigger>
            <Tabs.Trigger value="sandbox">샌드박스 뷰어</Tabs.Trigger>
            <Tabs.Trigger value="connection">연결 테스트</Tabs.Trigger>
          </Tabs.List>

          <div className="mt-6">
            <Tabs.Content value="overview" className="space-y-6">
              <SyncDashboard />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Container className="p-6 border border-medusa-border-base rounded-lg">
                  <Heading level="h3" className="mb-3">빠른 시작</Heading>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <Text>마켓플레이스 탭에서 Amazon 마켓플레이스를 활성화하세요</Text>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <Text>상품을 Amazon에 동기화하여 판매를 시작하세요</Text>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <Text>상품 동기화 탭에서 진행 상황을 모니터링하세요</Text>
                    </div>
                  </div>
                </Container>

                <Container className="p-6 border border-medusa-border-base rounded-lg">
                  <Heading level="h3" className="mb-3">주요 기능</Heading>
                  <div className="space-y-3 text-sm">
                    <Text>✅ 다중 마켓플레이스 지원</Text>
                    <Text>✅ 실시간 재고 동기화</Text>
                    <Text>✅ 가격 자동 업데이트</Text>
                    <Text>✅ 주문 관리 통합</Text>
                    <Text>✅ 샌드박스 환경 지원</Text>
                  </div>
                </Container>
              </div>

              {/* 환경변수 설정 가이드 */}
              <Container className="p-6 border border-medusa-border-base rounded-lg">
                <Heading level="h3" className="mb-4">🔧 환경변수 설정 가이드</Heading>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Text className="font-medium text-blue-800 mb-3">📋 필수 환경변수:</Text>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-600">AMAZON_CLIENT_ID</span>
                        <span className="text-gray-600">SP-API 앱의 클라이언트 ID</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">AMAZON_CLIENT_SECRET</span>
                        <span className="text-gray-600">SP-API 앱의 클라이언트 시크릿</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">AMAZON_REFRESH_TOKEN</span>
                        <span className="text-gray-600">LWA 리프레시 토큰</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">AMAZON_SELLER_ID</span>
                        <span className="text-gray-600">Amazon 셀러 ID</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Text className="font-medium text-yellow-800 mb-3">⚙️ 선택적 환경변수:</Text>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="flex justify-between">
                        <span className="text-yellow-600">AMAZON_REGION</span>
                        <span className="text-gray-600">NA, EU, FE (기본값: NA)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-600">AMAZON_SANDBOX_MODE</span>
                        <span className="text-gray-600">true/false (테스트용)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <Text className="font-medium text-green-800 mb-3">🚀 Amazon SP-API 공식 온보딩 프로세스 (10단계):</Text>
                    <div className="space-y-3 text-sm text-green-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Text className="font-semibold text-green-800">🔧 준비 및 등록 단계 (1-4):</Text>
                          <div className="space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="font-bold">1.</span>
                              <span>등록 준비 (개발자 정보, 보안 요구사항 확인)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">2.</span>
                              <span>Solution Provider Portal 계정 생성</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">3.</span>
                              <span>개발자 프로필 생성</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">4.</span>
                              <span>샌드박스 애플리케이션 등록</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Text className="font-semibold text-green-800">🧪 테스트 및 인증 단계 (5-6):</Text>
                          <div className="space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="font-bold">5.</span>
                              <span>샌드박스에서 첫 SP-API 호출</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">6.</span>
                              <span>OAuth 2.0 인증 워크플로우 설정</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Text className="font-semibold text-green-800">🚀 프로덕션 배포 단계 (7-10):</Text>
                          <div className="space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="font-bold">7.</span>
                              <span>프로덕션 애플리케이션 등록</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">8.</span>
                              <span>프로덕션 환경에서 SP-API 호출</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">9.</span>
                              <span>애플리케이션 테스트</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-bold">10.</span>
                              <span>Selling Partner Appstore에 앱 등록</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Text className="font-medium text-yellow-800 mb-3">📍 최신 변경사항:</Text>
                    <div className="space-y-1 text-sm text-yellow-700">
                      <Text as="div">• SP-API 샌드박스: https://sandbox.sellingpartnerapi.amazon.com (통일됨)</Text>
                      <Text as="div">• 구 sandbox.sellercentral.amazon.com URL은 더 이상 사용 안됨</Text>
                      <Text as="div">• 모든 테스트는 정규 Seller Central의 Developer Console 사용</Text>
                    </div>
                  </div>
                </div>
              </Container>
            </Tabs.Content>

            <Tabs.Content value="marketplaces" className="space-y-6">
              <AmazonMarketplacesTable 
                onMarketplaceSelect={setSelectedMarketplace}
              />
              
              {selectedMarketplace && (
                <ConnectionTest 
                  marketplace={selectedMarketplace}
                />
              )}
            </Tabs.Content>

            <Tabs.Content value="products" className="space-y-6">
              <ProductSyncTable 
                marketplaceId={selectedMarketplace?.marketplace_id}
              />
            </Tabs.Content>

            <Tabs.Content value="sandbox">
              <SandboxViewer />
            </Tabs.Content>

            <Tabs.Content value="connection" className="space-y-6">
              {selectedMarketplace ? (
                <ConnectionTest 
                  marketplace={selectedMarketplace}
                />
              ) : (
                <Container className="p-12 text-center border border-medusa-border-base rounded-lg">
                  <Text className="text-medusa-fg-muted">
                    마켓플레이스 탭에서 마켓플레이스를 선택한 후 연결을 테스트하세요
                  </Text>
                </Container>
              )}
            </Tabs.Content>
          </div>
        </Tabs>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Amazon Integration",
  icon: CloudArrowUp,
})

export default AmazonIntegrationPage