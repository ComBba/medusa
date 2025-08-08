import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Badge, 
  Button,
  StatusBadge,
  Text,
  toast,
  Checkbox,
  Label,
  Switch,
  Select,

  Alert
} from "@medusajs/ui"
import { 
  ArrowPath, 
  PlaySolid,
  ArrowsPointingOut,
  CheckCircleSolid,
  ExclamationCircleSolid,

  CloudArrowUp,
  CurrencyDollar,
  ArchiveBox
} from "@medusajs/icons"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { DetailWidgetProps } from "@medusajs/framework/types"

interface ConnectionStatus {
  success: boolean
  message: string
  timestamp?: string
  region?: string
  sandbox?: boolean
}
import type { AdminProduct } from "@medusajs/framework/types"
import { sdk } from "../lib/config"

interface SyncOptionsV2 {
  sync_type: 'product' | 'price' | 'inventory' | 'all'
  force_update: boolean
  validation_only: boolean
  batch_mode: boolean
  retry_count: number
  selected_marketplaces: string[]
}





// Amazon SP-API SDK V2 향상된 동기화 위젯
const AmazonSDKV2Widget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const productId = data.id
  const queryClient = useQueryClient()
  
  // 상태 관리
  const [syncOptions, setSyncOptions] = useState<SyncOptionsV2>({
    sync_type: 'all',
    force_update: false,
    validation_only: true, // 기본적으로 검증 모드
    batch_mode: true,
    retry_count: 3,
    selected_marketplaces: ["ATVPDKIKX0DER"] // 기본: 미국 마켓플레이스
  })
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    success: false, 
    message: '',
    timestamp: new Date().toISOString(),
    region: 'us-east-1',
    sandbox: true
  })
  const [syncProgress, setSyncProgress] = useState(0)
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Amazon 연결 상태 조회
  const { data: amazonStatus } = useQuery<any>({
    queryKey: ["amazon-connection-status"],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch("/admin/amazon/connection/test", {
          method: "GET",
        })
        return response
      } catch (error) {
        console.error("Amazon 연결 상태 조회 실패:", error)
        return { success: false, message: "연결 상태 확인 실패" }
      }
    },
    refetchInterval: 30000, // 30초마다 상태 확인
  })

  // 마켓플레이스 참여 정보 조회
  const { data: marketplaceParticipations } = useQuery<any>({
    queryKey: ["amazon-marketplace-participations"],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch("/admin/amazon/marketplaces/participations", {
          method: "GET",
        })
        return response
      } catch (error) {
        console.error("마켓플레이스 참여 정보 조회 실패:", error)
        return []
      }
    },
    enabled: amazonStatus?.success === true
  })

  // 상품 동기화 상태 조회
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery<any>({
    queryKey: ["amazon-sync-status", productId],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(`/admin/amazon/products/${productId}/sync-status`, {
          method: "GET",
        })
        return response
      } catch (error) {
        console.error("동기화 상태 조회 실패:", error)
        return []
      }
    }
  })

  // Amazon 리스팅 정보 조회
  const { } = useQuery({
    queryKey: ["amazon-listing-info", productId, syncOptions.selected_marketplaces],
    queryFn: async () => {
      if (!syncOptions.selected_marketplaces.length) return null
      
      try {
        const response = await sdk.client.fetch(`/admin/amazon/products/${productId}/listing`, {
          method: "POST",
          body: {
            marketplace_ids: syncOptions.selected_marketplaces
          }
        })
        return response
      } catch (error) {
        console.error("리스팅 정보 조회 실패:", error)
        return null
      }
    },
    enabled: syncOptions.selected_marketplaces.length > 0 && amazonStatus?.success === true
  })

  // 연결 테스트 뮤테이션
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/connection/test", {
        method: "POST",
      })
      return response
    },
    onSuccess: (data: any) => {
      setConnectionStatus(data as ConnectionStatus)
      toast.success("Amazon 연결 테스트 완료", {
        description: (data as ConnectionStatus).message
      })
      queryClient.invalidateQueries({ queryKey: ["amazon-connection-status"] })
    },
    onError: (error) => {
      toast.error("연결 테스트 실패", {
        description: error.message
      })
    }
  })

  // SDK V2 동기화 뮤테이션
  const syncV2Mutation = useMutation({
    mutationFn: async (options: SyncOptionsV2) => {
      setSyncProgress(0)
      
      const response = await sdk.client.fetch("/admin/amazon/sync/enhanced-v2", {
        method: "POST",
        body: {
          product_id: productId,
          marketplace_ids: options.selected_marketplaces,
          sync_type: options.sync_type,
          options: {
            force_update: options.force_update,
            validation_only: options.validation_only,
            batch_mode: options.batch_mode,
            retry_count: options.retry_count
          }
        }
      })
      
      // 진행률 시뮬레이션 (실제로는 웹소켓이나 폴링으로 구현)
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 100
          }
          return prev + 10
        })
      }, 500)
      
      return response
    },
    onSuccess: (data: any) => {
      setSyncProgress(100)
      toast.success("Amazon 동기화 완료", {
        description: `${(data as any).summary?.success || 0}개 마켓플레이스 동기화 성공`
      })
      refetchSyncStatus()
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-status"] })
    },
    onError: (error) => {
      setSyncProgress(0)
      toast.error("동기화 실패", {
        description: error.message
      })
    }
  })

  // 연결 테스트 핸들러
  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    try {
      await testConnectionMutation.mutateAsync()
    } finally {
      setIsTestingConnection(false)
    }
  }

  // 동기화 핸들러
  const handleSync = () => {
    if (!amazonStatus?.success) {
      toast.error("Amazon 연결을 먼저 확인해주세요")
      return
    }
    
    syncV2Mutation.mutate(syncOptions)
  }

  // 마켓플레이스 선택 핸들러
  const handleMarketplaceToggle = (marketplaceId: string, checked: boolean) => {
    setSyncOptions(prev => ({
      ...prev,
      selected_marketplaces: checked
        ? [...prev.selected_marketplaces, marketplaceId]
        : prev.selected_marketplaces.filter(id => id !== marketplaceId)
    }))
  }

  return (
    <Container className="divide-y p-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <CloudArrowUp className="text-ui-fg-base" />
          <Heading level="h2">Amazon SP-API SDK V2</Heading>
          <Badge size="2xsmall" color="blue">Enhanced</Badge>
        </div>
        
        {/* 연결 상태 표시 */}
        <div className="flex items-center gap-x-2">
          {amazonStatus?.success ? (
            <StatusBadge color="green">
              <CheckCircleSolid />
              연결됨
            </StatusBadge>
          ) : (
            <StatusBadge color="red">
              <ExclamationCircleSolid />
              연결 안됨
            </StatusBadge>
          )}
        </div>
      </div>

      {/* 연결 테스트 섹션 */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <Text size="base" weight="plus">연결 상태 확인</Text>
          <Button
            size="small"
            variant="secondary"
            onClick={handleTestConnection}
            isLoading={isTestingConnection}
          >
            <ArrowPath />
            연결 테스트
          </Button>
        </div>
        
        {connectionStatus && (
          <Alert variant={connectionStatus.success ? "success" : "error"} className="mb-4">
            연결 테스트 결과: {connectionStatus.message}
            {connectionStatus.timestamp && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                테스트 시간: {new Date(connectionStatus.timestamp).toLocaleString()}
              </Text>
            )}
          </Alert>
        )}
      </div>

      {/* 동기화 옵션 섹션 */}
      <div className="px-6 py-4">
        <Text size="base" weight="plus" className="mb-4">동기화 설정</Text>
        
        {/* 동기화 타입 선택 */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <div>
            <Label>동기화 타입</Label>
            <Select
              value={syncOptions.sync_type}
              onValueChange={(value: 'product' | 'price' | 'inventory' | 'all') => 
                setSyncOptions(prev => ({ ...prev, sync_type: value }))
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">
                  <div className="flex items-center gap-2">
                    <ArrowsPointingOut className="w-4 h-4" />
                    전체 동기화
                  </div>
                </Select.Item>
                <Select.Item value="product">
                  <div className="flex items-center gap-2">
                    <CloudArrowUp className="w-4 h-4" />
                    상품 정보만
                  </div>
                </Select.Item>
                <Select.Item value="price">
                  <div className="flex items-center gap-2">
                    <CurrencyDollar className="w-4 h-4" />
                    가격만
                  </div>
                </Select.Item>
                <Select.Item value="inventory">
                  <div className="flex items-center gap-2">
                    <ArchiveBox className="w-4 h-4" />
                    재고만
                  </div>
                </Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>

        {/* 동기화 옵션 체크박스 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={syncOptions.force_update}
              onCheckedChange={(checked) => 
                setSyncOptions(prev => ({ ...prev, force_update: checked }))
              }
            />
            <Label>강제 업데이트</Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={syncOptions.validation_only}
              onCheckedChange={(checked) => 
                setSyncOptions(prev => ({ ...prev, validation_only: checked }))
              }
            />
            <Label>검증 전용</Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={syncOptions.batch_mode}
              onCheckedChange={(checked) => 
                setSyncOptions(prev => ({ ...prev, batch_mode: checked }))
              }
            />
            <Label>배치 모드</Label>
          </div>
        </div>

        {/* 마켓플레이스 선택 */}
        {marketplaceParticipations && marketplaceParticipations.length > 0 && (
          <div className="mb-4">
            <Label className="mb-2">대상 마켓플레이스</Label>
            <div className="grid grid-cols-2 gap-2">
              {marketplaceParticipations.map((marketplace: any) => (
                <div key={marketplace.marketplace_id} className="flex items-center gap-2">
                  <Checkbox
                    checked={syncOptions.selected_marketplaces.includes(marketplace.marketplace_id)}
                    onCheckedChange={(checked) => 
                      handleMarketplaceToggle(marketplace.marketplace_id, checked as boolean)
                    }
                  />
                  <Label size="small">
                    {marketplace.name || marketplace.marketplace_id}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 동기화 진행률 */}
      {syncV2Mutation.isPending && (
        <div className="px-6 py-4">
          <Text size="small" className="mb-2">동기화 진행 중...</Text>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${syncProgress}%`}}></div>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {syncProgress}% 완료
          </Text>
        </div>
      )}

      {/* 현재 동기화 상태 */}
      {syncStatus && syncStatus.length > 0 && (
        <div className="px-6 py-4">
          <Text size="base" weight="plus" className="mb-3">현재 동기화 상태</Text>
          <div className="space-y-2">
            {syncStatus.map((status: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-ui-bg-subtle rounded-md">
                <div>
                  <Text size="small" weight="plus">{status.marketplace_name || status.marketplace_id}</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    마지막 동기화: {status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : '없음'}
                  </Text>
                </div>
                <StatusBadge color={status.sync_status === 'success' ? 'green' : status.sync_status === 'failed' ? 'red' : 'orange'}>
                  {status.sync_status === 'success' ? '성공' : status.sync_status === 'failed' ? '실패' : '대기중'}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-x-2 px-6 py-4">
        <Button
          size="small"
          variant="secondary"
          onClick={() => refetchSyncStatus()}
        >
          <ArrowPath />
          상태 새로고침
        </Button>
        <Button
          size="small"
          onClick={handleSync}
          isLoading={syncV2Mutation.isPending}
          disabled={!amazonStatus?.success || syncOptions.selected_marketplaces.length === 0}
        >
          <PlaySolid />
          {syncOptions.sync_type === 'all' ? '전체 동기화' : 
           syncOptions.sync_type === 'product' ? '상품 동기화' :
           syncOptions.sync_type === 'price' ? '가격 동기화' : '재고 동기화'}
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after"
})

export default AmazonSDKV2Widget