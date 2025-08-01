import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Badge, 
  Button,
  StatusBadge,
  Text,
  toast,
  DropdownMenu,
  IconButton,
  Select,
  Checkbox,
  Label,
  Switch
} from "@medusajs/ui"
import { 
  EllipsisHorizontal, 
  ArrowPath, 
  PlaySolid,
  ChartBar
} from "@medusajs/icons"
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { DetailWidgetProps } from "@medusajs/framework/types"
import type { AdminProduct } from "@medusajs/framework/types"
import { amazonSyncClient, amazonQueries, amazonMutations } from "../lib/config"



interface SyncOptions {
  force_update: boolean
  include_variants: boolean
  sync_images: boolean
  quantity_threshold: number
  currency: string
  include_promotions: boolean
  selected_marketplaces: string[]
}

// Amazon 동기화 컨트롤 위젯
const AmazonSyncControlWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const productId = data.id
  const queryClient = useQueryClient()
  
  // 상태 관리
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    force_update: false,
    include_variants: true,
    sync_images: true,
    quantity_threshold: 0,
    currency: "USD",
    include_promotions: false,
    selected_marketplaces: []
  })
  
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  // 마켓플레이스 목록 조회
  const { data: marketplacesData, isLoading: marketplacesLoading } = useQuery({
    ...amazonQueries.marketplaces(),
    enabled: !!productId
  })

  // 상품별 동기화 상태 조회
  const { data: syncStatusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["amazon", "sync-status", "product", productId],
    queryFn: () => amazonSyncClient.getSyncStatus(productId),
    refetchInterval: 10000, // 10초마다 자동 새로고침
  })

  // 동기화 mutations
  const syncProductMutation = useMutation(amazonMutations.syncProduct())
  const syncInventoryMutation = useMutation(amazonMutations.syncInventory())
  const syncPriceMutation = useMutation(amazonMutations.syncPrice())
  const syncAllMutation = useMutation(amazonMutations.syncAll())

  // 초기 마켓플레이스 선택
  useEffect(() => {
    if (marketplacesData && Array.isArray(marketplacesData)) {
      const activeMarketplaces = marketplacesData
        .filter((m: any) => m.is_active)
        .map((m: any) => m.marketplace_id)
      
      setSyncOptions(prev => ({
        ...prev,
        selected_marketplaces: activeMarketplaces
      }))
    }
  }, [marketplacesData])

  // 개별 동기화 실행
  const handleSync = async (syncType: "product" | "inventory" | "price" | "all") => {
    if (!productId || syncOptions.selected_marketplaces.length === 0) {
      toast.error("상품 ID나 마켓플레이스가 선택되지 않았습니다.")
      return
    }

    const syncData = {
      productId,
      marketplaceIds: syncOptions.selected_marketplaces
    }

    try {
      let message = ""

      switch (syncType) {
        case "product":
          await syncProductMutation.mutateAsync(syncData)
          message = "상품 동기화가 시작되었습니다."
          break
        case "inventory":
          await syncInventoryMutation.mutateAsync(syncData)
          message = "재고 동기화가 시작되었습니다."
          break
        case "price":
          await syncPriceMutation.mutateAsync(syncData)
          message = "가격 동기화가 시작되었습니다."
          break
        case "all":
          await syncAllMutation.mutateAsync(syncData)
          message = "전체 동기화가 시작되었습니다."
          break
      }

      toast.success(message)
      
      // 상태 새로고침
      await refetchStatus()
      queryClient.invalidateQueries({ queryKey: ["amazon", "sync-stats"] })
      
    } catch (error) {
      console.error(`${syncType} sync error:`, error)
      toast.error(`${syncType} 동기화 중 오류가 발생했습니다.`)
    }
  }

  // 마켓플레이스 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "green"
      case "processing": return "blue"
      case "pending": return "orange"
      case "failed": return "red"
      default: return "grey"
    }
  }

  // 로딩 상태
  if (marketplacesLoading || statusLoading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Amazon 동기화 컨트롤</Heading>
        </div>
        <div className="px-6 py-4">
          <Text>로딩 중...</Text>
        </div>
      </Container>
    )
  }

  const activeMarketplaces = Array.isArray(marketplacesData) 
    ? marketplacesData.filter((m: any) => m.is_active) 
    : []
  const marketplaceStatus = (syncStatusData as any)?.marketplace_status || {}

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Amazon 동기화 컨트롤</Heading>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => refetchStatus()}
            disabled={statusLoading}
          >
            <ArrowPath className="w-4 h-4" />
            새로고침
          </Button>
          
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="transparent">
                <EllipsisHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}>
                고급 설정 {showAdvancedOptions ? "숨기기" : "보기"}
              </DropdownMenu.Item>
              <DropdownMenu.Item>
                <ChartBar className="w-4 h-4 mr-2" />
                동기화 통계 보기
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="px-6 py-4 space-y-6">
        {/* 마켓플레이스 선택 */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            동기화할 마켓플레이스 선택
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {activeMarketplaces.map((marketplace: any) => {
              const status = marketplaceStatus[marketplace.marketplace_id]
              const isSelected = syncOptions.selected_marketplaces.includes(marketplace.marketplace_id)
              
              return (
                <div
                  key={marketplace.marketplace_id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    setSyncOptions(prev => ({
                      ...prev,
                      selected_marketplaces: isSelected
                        ? prev.selected_marketplaces.filter(id => id !== marketplace.marketplace_id)
                        : [...prev.selected_marketplaces, marketplace.marketplace_id]
                    }))
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} />
                    <div>
                      <Text size="small" weight="plus">
                        {marketplace.name}
                      </Text>
                      <Text size="xsmall" className="text-gray-500">
                        {marketplace.country_code}
                      </Text>
                    </div>
                  </div>
                  
                  {status && (
                    <StatusBadge 
                      color={getStatusColor(status.sync_status)}
                    >
                      {status.sync_status}
                    </StatusBadge>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 고급 옵션 */}
        {showAdvancedOptions && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <Text weight="plus" size="small">고급 동기화 옵션</Text>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label>강제 업데이트</Label>
                <Switch
                  checked={syncOptions.force_update}
                  onCheckedChange={(checked) => 
                    setSyncOptions(prev => ({ ...prev, force_update: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>변형 포함</Label>
                <Switch
                  checked={syncOptions.include_variants}
                  onCheckedChange={(checked) => 
                    setSyncOptions(prev => ({ ...prev, include_variants: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>이미지 동기화</Label>
                <Switch
                  checked={syncOptions.sync_images}
                  onCheckedChange={(checked) => 
                    setSyncOptions(prev => ({ ...prev, sync_images: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>프로모션 포함</Label>
                <Switch
                  checked={syncOptions.include_promotions}
                  onCheckedChange={(checked) => 
                    setSyncOptions(prev => ({ ...prev, include_promotions: checked }))
                  }
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>통화</Label>
                <Select
                  value={syncOptions.currency}
                  onValueChange={(value) => 
                    setSyncOptions(prev => ({ ...prev, currency: value }))
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="USD">USD</Select.Item>
                    <Select.Item value="EUR">EUR</Select.Item>
                    <Select.Item value="GBP">GBP</Select.Item>
                    <Select.Item value="JPY">JPY</Select.Item>
                    <Select.Item value="CAD">CAD</Select.Item>
                    <Select.Item value="AUD">AUD</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              
              <div>
                <Label>재고 임계값</Label>
                <input
                  type="number"
                  min="0"
                  value={syncOptions.quantity_threshold}
                  onChange={(e) => 
                    setSyncOptions(prev => ({ 
                      ...prev, 
                      quantity_threshold: parseInt(e.target.value) || 0 
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        )}

        {/* 동기화 버튼들 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleSync("product")}
            disabled={
              syncProductMutation.isPending || 
              syncOptions.selected_marketplaces.length === 0
            }
            className="flex items-center gap-2"
          >
            <PlaySolid className="w-4 h-4" />
            상품 동기화
          </Button>
          
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleSync("inventory")}
            disabled={
              syncInventoryMutation.isPending || 
              syncOptions.selected_marketplaces.length === 0
            }
            className="flex items-center gap-2"
          >
            <PlaySolid className="w-4 h-4" />
            재고 동기화
          </Button>
          
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleSync("price")}
            disabled={
              syncPriceMutation.isPending || 
              syncOptions.selected_marketplaces.length === 0
            }
            className="flex items-center gap-2"
          >
            <PlaySolid className="w-4 h-4" />
            가격 동기화
          </Button>
          
          <Button
            variant="primary"
            size="small"
            onClick={() => handleSync("all")}
            disabled={
              syncAllMutation.isPending || 
              syncOptions.selected_marketplaces.length === 0
            }
            className="flex items-center gap-2"
          >
            <PlaySolid className="w-4 h-4" />
            전체 동기화
          </Button>
        </div>

        {/* 동기화 상태 요약 */}
        {(syncStatusData as any)?.summary && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <Text weight="plus" size="small" className="mb-2">동기화 상태 요약</Text>
            <div className="flex flex-wrap gap-2">
              <Badge>
                총 {((syncStatusData as any).summary as any).total_syncs || 0}개
              </Badge>
              {((syncStatusData as any).summary as any).successful > 0 && (
                <StatusBadge color="green">
                  성공: {((syncStatusData as any).summary as any).successful}
                </StatusBadge>
              )}
              {((syncStatusData as any).summary as any).failed > 0 && (
                <StatusBadge color="red">
                  실패: {((syncStatusData as any).summary as any).failed}
                </StatusBadge>
              )}
              {((syncStatusData as any).summary as any).pending > 0 && (
                <StatusBadge color="orange">
                  대기: {((syncStatusData as any).summary as any).pending}
                </StatusBadge>
              )}
            </div>
          </div>
        )}

        {/* 선택된 마켓플레이스가 없을 때 안내 */}
        {syncOptions.selected_marketplaces.length === 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Text size="small" className="text-yellow-800">
              동기화할 마켓플레이스를 하나 이상 선택해주세요.
            </Text>
          </div>
        )}
      </div>
    </Container>
  )
}

// 위젯 설정
export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default AmazonSyncControlWidget