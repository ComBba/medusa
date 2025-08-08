import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Badge, 
  Button,
  StatusBadge,
  Text,
  toast,
  Table,
  CodeBlock,
  Alert,
  Tabs
} from "@medusajs/ui"
import { 
  CloudArrowUp,
  CheckCircleSolid,
  ExclamationCircleSolid,
  InformationCircleSolid,
  ArrowPath,
  ChartBar,
  ArrowPath as CogIcon,
  DocumentText
} from "@medusajs/icons"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/config"

interface ConnectionStatus {
  success: boolean
  message: string
  region?: string
  sandbox?: boolean
  marketplaces?: any[]
}

interface SyncMetrics {
  total_products: number
  synced_products: number
  failed_syncs: number
  last_sync: string
  sync_rate: number
}



interface MarketplaceParticipation {
  marketplace: {
    id: string
    name: string
    countryCode: string
    defaultCurrencyCode: string
  }
  participation: {
    isParticipating: boolean
    hasSuspendedListings: boolean
  }
}

interface SyncMetrics {
  total_products: number
  synced_products: number
  failed_syncs: number
  last_sync: string
  sync_rate: number
  marketplaces: {
    marketplace_id: string
    name: string
    status: 'active' | 'error' | 'disabled'
    last_sync: string
    product_count: number
  }[]
}

// Amazon SP-API SDK V2 대시보드
const AmazonSDKV2Dashboard = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("overview")

  // Amazon 연결 상태 조회
  const { data: connectionStatus, refetch: refetchConnection } = useQuery<any>({
    queryKey: ["amazon-connection-status-dashboard"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/connection/test", {
        method: "GET",
      })
      return response as ConnectionStatus
    },
    refetchInterval: 60000, // 1분마다 상태 확인
  })

  // 마켓플레이스 참여 정보 조회
  const { data: marketplaceData, isLoading: isMarketplaceLoading, refetch: refetchMarketplaces } = useQuery<any>({
    queryKey: ["amazon-marketplace-participations-dashboard"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/marketplaces/participations", {
        method: "GET",
      })
      return response as MarketplaceParticipation[]
    },
    enabled: connectionStatus?.success === true
  })

  // 동기화 메트릭스 조회
  const { data: syncMetrics } = useQuery<any>({
    queryKey: ["amazon-sync-metrics"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/sync/metrics", {
        method: "GET",
      })
      return response as SyncMetrics
    },
    enabled: connectionStatus?.success === true,
    refetchInterval: 30000, // 30초마다 메트릭스 갱신
  })

  // 최근 동기화 기록 조회
  const { data: recentSyncs } = useQuery<any>({
    queryKey: ["amazon-recent-syncs"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/sync/recent", {
        method: "GET",
      })
      return response
    },
    enabled: connectionStatus?.success === true
  })

  // 연결 테스트 뮤테이션
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/connection/test", {
        method: "POST",
      })
      return response
    },
    onSuccess: () => {
      toast.success("Amazon 연결 테스트 완료")
      queryClient.invalidateQueries({ queryKey: ["amazon-connection-status-dashboard"] })
    },
    onError: (error) => {
      toast.error("연결 테스트 실패", {
        description: error.message
      })
    }
  })

  // 전체 마켓플레이스 동기화 뮤테이션
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/sync/all-marketplaces", {
        method: "POST",
        body: {
          sync_type: "all",
          options: {
            batch_mode: true,
            validation_only: false
          }
        }
      })
      return response
    },
    onSuccess: () => {
      toast.success("전체 마켓플레이스 동기화 시작됨")
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-metrics"] })
    },
    onError: (error) => {
      toast.error("동기화 시작 실패", {
        description: error.message
      })
    }
  })

  return (
    <div className="flex flex-col gap-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <CloudArrowUp className="text-ui-fg-base" />
          <Heading level="h1">Amazon SP-API SDK V2 대시보드</Heading>
          <Badge size="small" color="blue">Enhanced</Badge>
        </div>
        
        <div className="flex items-center gap-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => testConnectionMutation.mutate()}
            isLoading={testConnectionMutation.isPending}
          >
            <ArrowPath />
            연결 테스트
          </Button>
          
          <Button
            size="small"
            onClick={() => syncAllMutation.mutate()}
            isLoading={syncAllMutation.isPending}
            disabled={!connectionStatus?.success}
          >
            <CloudArrowUp />
            전체 동기화
          </Button>
        </div>
      </div>

      {/* 연결 상태 알림 */}
      {connectionStatus && (
        <Alert variant={connectionStatus.success ? "success" : "error"}>
          {connectionStatus.success ? "Amazon SP-API 연결됨" : "Amazon SP-API 연결 실패"}: {connectionStatus.message}
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="overview">
            <ChartBar />
            개요
          </Tabs.Trigger>
          <Tabs.Trigger value="marketplaces">
            <InformationCircleSolid />
            마켓플레이스
          </Tabs.Trigger>
          <Tabs.Trigger value="sync-history">
            <DocumentText />
            동기화 기록
          </Tabs.Trigger>
          <Tabs.Trigger value="settings">
                          <CogIcon />
            설정
          </Tabs.Trigger>
        </Tabs.List>

        {/* 개요 탭 */}
        <Tabs.Content value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* 메트릭스 카드들 */}
            <div className="p-4 border rounded bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="small" className="text-ui-fg-subtle">총 상품</Text>
                  <Text size="xlarge" weight="plus">
                    {syncMetrics?.total_products || 0}
                  </Text>
                </div>
                <CloudArrowUp className="text-blue-500" />
              </div>
            </div>

            <div className="p-4 border rounded bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="small" className="text-ui-fg-subtle">동기화된 상품</Text>
                  <Text size="xlarge" weight="plus">
                    {syncMetrics?.synced_products || 0}
                  </Text>
                </div>
                <CheckCircleSolid className="text-green-500" />
              </div>
            </div>

            <div className="p-4 border rounded bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="small" className="text-ui-fg-subtle">실패한 동기화</Text>
                  <Text size="xlarge" weight="plus">
                    {syncMetrics?.failed_syncs || 0}
                  </Text>
                </div>
                <ExclamationCircleSolid className="text-red-500" />
              </div>
            </div>

            <div className="p-4 border rounded bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <Text size="small" className="text-ui-fg-subtle">동기화 성공률</Text>
                  <Text size="xlarge" weight="plus">
                    {syncMetrics?.sync_rate ? `${(syncMetrics.sync_rate * 100).toFixed(1)}%` : '0%'}
                  </Text>
                </div>
                <ChartBar className="text-purple-500" />
              </div>
            </div>
          </div>

          {/* 동기화 진행률 */}
          {syncMetrics && (
            <div className="p-6 mb-6 border rounded bg-white">
              <Text size="base" weight="plus" className="mb-4">동기화 진행률</Text>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(syncMetrics.synced_products / syncMetrics.total_products) * 100}%` }}
                ></div>
              </div>
              <Text size="small" className="text-ui-fg-subtle">
                {syncMetrics.synced_products}/{syncMetrics.total_products} 상품 동기화 완료
              </Text>
            </div>
          )}
        </Tabs.Content>

        {/* 마켓플레이스 탭 */}
        <Tabs.Content value="marketplaces">
          <Container>
            <Heading level="h2" className="mb-4">마켓플레이스 참여 현황</Heading>
            
            {isMarketplaceLoading ? (
              <div className="flex items-center justify-center py-8">
                <Text>마켓플레이스 정보를 불러오는 중...</Text>
              </div>
            ) : marketplaceData && marketplaceData.length > 0 ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>마켓플레이스</Table.HeaderCell>
                    <Table.HeaderCell>국가</Table.HeaderCell>
                    <Table.HeaderCell>통화</Table.HeaderCell>
                    <Table.HeaderCell>참여 상태</Table.HeaderCell>
                    <Table.HeaderCell>리스팅 상태</Table.HeaderCell>
                    <Table.HeaderCell>상품 수</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {marketplaceData.map((mp: MarketplaceParticipation) => (
                    <Table.Row key={mp.marketplace.id}>
                      <Table.Cell>
                        <div>
                          <Text weight="plus">{mp.marketplace.name}</Text>
                          <Text size="small" className="text-ui-fg-subtle">
                            {mp.marketplace.id}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell>{mp.marketplace.countryCode}</Table.Cell>
                      <Table.Cell>{mp.marketplace.defaultCurrencyCode}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={mp.participation.isParticipating ? "green" : "red"}>
                          {mp.participation.isParticipating ? "참여 중" : "참여 안함"}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={mp.participation.hasSuspendedListings ? "orange" : "green"}>
                          {mp.participation.hasSuspendedListings ? "일시 중단" : "정상"}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell>{(mp.participation as any).listing_count || 0}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <div className="text-center py-8">
                <div className="mb-4">
                  <InformationCircleSolid className="mx-auto h-12 w-12 text-yellow-500" />
                </div>
                <Heading level="h3" className="mb-2">마켓플레이스가 설정되지 않았습니다</Heading>
                <Text className="mb-4 text-ui-fg-subtle">
                  Amazon 마켓플레이스에 참여하고 있지 않거나 초기 설정이 필요합니다.
                </Text>
                <div className="space-y-2">
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="secondary" 
                      onClick={async () => {
                        // 연결 테스트를 다시 시도
                        await refetchConnection()
                        await refetchMarketplaces()
                      }}
                    >
                      연결 다시 확인
                    </Button>
                    <Button 
                      variant="primary"
                      onClick={() => {
                        // 새 탭에서 Amazon Seller Central 열기
                        window.open('https://sellercentral.amazon.com/', '_blank')
                      }}
                    >
                      Amazon Seller Central
                    </Button>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <Text size="small" className="mb-2 font-medium">설정 스크립트 실행:</Text>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      npx medusa exec src/scripts/setup-amazon-integration.ts
                    </code>
                  </div>
                </div>
              </div>
            )}
          </Container>
        </Tabs.Content>

        {/* 동기화 기록 탭 */}
        <Tabs.Content value="sync-history">
          <Container>
            <Heading level="h2" className="mb-4">최근 동기화 기록</Heading>
            
            {recentSyncs && recentSyncs.length > 0 ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>상품</Table.HeaderCell>
                    <Table.HeaderCell>마켓플레이스</Table.HeaderCell>
                    <Table.HeaderCell>동기화 타입</Table.HeaderCell>
                    <Table.HeaderCell>상태</Table.HeaderCell>
                    <Table.HeaderCell>시간</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {recentSyncs.map((sync: any, index: number) => (
                    <Table.Row key={index}>
                      <Table.Cell>
                        <Text weight="plus">{sync.product_title || sync.product_id}</Text>
                      </Table.Cell>
                      <Table.Cell>{sync.marketplace_name || sync.marketplace_id}</Table.Cell>
                      <Table.Cell>
                        <Badge size="2xsmall">{sync.sync_type}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={
                          sync.status === 'success' ? 'green' : 
                          sync.status === 'failed' ? 'red' : 'orange'
                        }>
                          {sync.status === 'success' ? '성공' : 
                           sync.status === 'failed' ? '실패' : '진행중'}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small">
                          {new Date(sync.timestamp).toLocaleString()}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <Text>동기화 기록이 없습니다.</Text>
            )}
          </Container>
        </Tabs.Content>

        {/* 설정 탭 */}
        <Tabs.Content value="settings">
          <Container>
            <Heading level="h2" className="mb-4">Amazon SP-API 설정</Heading>
            
            <div className="space-y-6">
              <div className="p-6 border rounded-lg bg-gray-50">
                <Text size="base" weight="plus" className="mb-2">SDK 버전 정보</Text>
                <CodeBlock snippets={[
                  {
                    language: "json",
                    label: "SDK 버전 정보",
                    code: JSON.stringify({
                      "amazon-sp-api": "^2.0.0",
                      "enhanced_features": true,
                      "auto_retry": true,
                      "rate_limiting": "automatic",
                      "sandbox_support": true
                    }, null, 2)
                  }
                ]} />
              </div>
              
              <div className="p-6 border rounded-lg bg-gray-50">
                <Text size="base" weight="plus" className="mb-2">현재 설정</Text>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text size="small" className="text-ui-fg-subtle">지역</Text>
                    <Text>{connectionStatus?.region || 'NA'}</Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-subtle">환경</Text>
                    <Text>{connectionStatus?.sandbox ? 'Sandbox' : 'Production'}</Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-subtle">자동 재시도</Text>
                    <Text>활성화</Text>
                  </div>
                  <div>
                    <Text size="small" className="text-ui-fg-subtle">Rate Limiting</Text>
                    <Text>자동 처리</Text>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Amazon SDK V2 대시보드",
  icon: CloudArrowUp,
})

export default AmazonSDKV2Dashboard