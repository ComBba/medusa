import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Tabs } from "@medusajs/ui"
import { CloudArrowUp } from "@medusajs/icons"
import { AmazonMarketplacesTable } from "./components/marketplaces-table"
import { ConnectionTest } from "./components/connection-test"
import { SyncDashboard } from "./components/sync-dashboard"
import { ProductSyncTable } from "./components/product-sync-table"
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