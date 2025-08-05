import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Text, 
  Button,
  StatusBadge,
  Badge,
  toast,
  Switch,
  Table
} from "@medusajs/ui"
import { useState } from "react"
import { 
  useAmazonSync, 
  useAmazonSyncStatus, 
  useAmazonMarketplaces,
  useAmazonMarketplaceToggle,
  useAmazonSyncHistory
} from "../../../workflows/hooks/useAmazonSync"

/**
 * Amazon 통합 대시보드 메인 페이지
 */
const AmazonDashboard = () => {
  const [batchSyncOptions, setBatchSyncOptions] = useState({
    batch_size: 10,
    concurrent_batches: 3,
    sync_images: true,
    include_variants: true,
    dry_run: false
  })

  const { syncBatch, isSyncing, syncProgress } = useAmazonSync()
  const { data: overallStatus } = useAmazonSyncStatus()
  const { data: marketplaces, isLoading: marketplacesLoading } = useAmazonMarketplaces()
  const { mutateAsync: toggleMarketplace } = useAmazonMarketplaceToggle()
  const { data: syncHistory } = useAmazonSyncHistory({ limit: 10 })

  const handleBatchSync = async () => {
    try {
      await syncBatch({
        ...batchSyncOptions,
        filters: {
          status: ["published"]
        }
      })
      toast.success("배치 동기화가 완료되었습니다!")
    } catch (error: any) {
      toast.error(`배치 동기화 실패: ${error.message}`)
    }
  }

  const handleMarketplaceToggle = async (marketplaceId: string, isActive: boolean) => {
    try {
      await toggleMarketplace({ marketplace_id: marketplaceId, is_active: isActive })
      toast.success(`마켓플레이스가 ${isActive ? '활성화' : '비활성화'}되었습니다.`)
    } catch (error: any) {
      toast.error(`마켓플레이스 상태 변경 실패: ${error.message}`)
    }
  }

  const getSyncStatistics = () => {
    if (!overallStatus?.statistics) {
      return {
        total_products: 0,
        synced_products: 0,
        pending_syncs: 0,
        failed_syncs: 0,
        sync_rate: 0
      }
    }

    const stats = overallStatus.statistics
    const syncRate = stats.total_products > 0 
      ? (stats.synced_products / stats.total_products) * 100 
      : 0

    return {
      ...stats,
      sync_rate: Math.round(syncRate)
    }
  }

  const stats = getSyncStatistics()

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Amazon 통합 대시보드</Heading>
          <Text className="text-grey-500">
            Amazon 마켓플레이스 상품 동기화 상태를 관리하고 모니터링합니다.
          </Text>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleBatchSync}
            isLoading={isSyncing}
            variant="primary"
          >
            전체 배치 동기화
          </Button>
        </div>
      </div>

      {/* 진행 상태 표시 */}
      {isSyncing && syncProgress.isRunning && (
        <Container>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Text weight="plus">배치 동기화 진행 중</Text>
              <StatusBadge color="blue">진행 중</StatusBadge>
            </div>
            <Text size="small" className="text-grey-500">
              {syncProgress.currentStep || "처리 중..."}
            </Text>
            {syncProgress.progress && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress.progress}%` }}
                />
              </div>
            )}
          </div>
        </Container>
      )}

      {/* 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Container>
          <div className="space-y-2">
            <Text size="small" className="text-grey-500">전체 상품</Text>
            <Text size="large" weight="plus">{stats.total_products.toLocaleString()}</Text>
          </div>
        </Container>
        
        <Container>
          <div className="space-y-2">
            <Text size="small" className="text-grey-500">동기화 완료</Text>
            <div className="flex items-center gap-2">
              <Text size="large" weight="plus" className="text-green-600">
                {stats.synced_products.toLocaleString()}
              </Text>
              <Badge color="green">
                {stats.sync_rate}%
              </Badge>
            </div>
          </div>
        </Container>
        
        <Container>
          <div className="space-y-2">
            <Text size="small" className="text-grey-500">대기 중</Text>
            <Text size="large" weight="plus" className="text-yellow-600">
              {stats.pending_syncs.toLocaleString()}
            </Text>
          </div>
        </Container>
        
        <Container>
          <div className="space-y-2">
            <Text size="small" className="text-grey-500">동기화 실패</Text>
            <Text size="large" weight="plus" className="text-red-600">
              {stats.failed_syncs.toLocaleString()}
            </Text>
          </div>
        </Container>
      </div>

      {/* 마켓플레이스 관리 */}
      <Container>
        <div className="space-y-4">
          <Heading level="h3">마켓플레이스 관리</Heading>
          
          {marketplacesLoading ? (
            <Text>마켓플레이스 정보를 불러오는 중...</Text>
          ) : (
            <div className="space-y-3">
              {marketplaces?.all_marketplaces?.map((marketplace: any) => (
                <div key={marketplace.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <div>
                      <Text weight="plus">{marketplace.name}</Text>
                      <Text size="small" className="text-grey-500">
                        {marketplace.marketplace_id} • {marketplace.country}
                      </Text>
                    </div>
                    {marketplace.is_active ? (
                      <StatusBadge color="green">활성</StatusBadge>
                    ) : (
                      <StatusBadge color="grey">비활성</StatusBadge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {marketplace.sync_statistics && (
                      <div className="text-right">
                        <Text size="small">
                          {marketplace.sync_statistics.synced_count} / {marketplace.sync_statistics.total_count}
                        </Text>
                        <Text size="small" className="text-grey-500">동기화됨</Text>
                      </div>
                    )}
                    
                    <Switch
                      checked={marketplace.is_active}
                      onCheckedChange={(checked) => 
                        handleMarketplaceToggle(marketplace.id, checked)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>

      {/* 배치 동기화 설정 */}
      <Container>
        <div className="space-y-4">
          <Heading level="h3">배치 동기화 설정</Heading>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Text size="small" weight="plus">배치 크기</Text>
              <input
                type="number"
                value={batchSyncOptions.batch_size}
                onChange={(e) => setBatchSyncOptions(prev => ({
                  ...prev,
                  batch_size: parseInt(e.target.value) || 10
                }))}
                className="w-full p-2 border rounded"
                min="1"
                max="50"
              />
            </div>
            
            <div className="space-y-2">
              <Text size="small" weight="plus">동시 배치 수</Text>
              <input
                type="number"
                value={batchSyncOptions.concurrent_batches}
                onChange={(e) => setBatchSyncOptions(prev => ({
                  ...prev,
                  concurrent_batches: parseInt(e.target.value) || 3
                }))}
                className="w-full p-2 border rounded"
                min="1"
                max="10"
              />
            </div>
            
            <div className="space-y-2">
              <Text size="small" weight="plus">옵션</Text>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={batchSyncOptions.sync_images}
                    onCheckedChange={(checked) => 
                      setBatchSyncOptions(prev => ({ ...prev, sync_images: checked }))
                    }
                  />
                  <Text size="small">이미지 동기화</Text>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={batchSyncOptions.include_variants}
                    onCheckedChange={(checked) => 
                      setBatchSyncOptions(prev => ({ ...prev, include_variants: checked }))
                    }
                  />
                  <Text size="small">변형 상품 포함</Text>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={batchSyncOptions.dry_run}
                    onCheckedChange={(checked) => 
                      setBatchSyncOptions(prev => ({ ...prev, dry_run: checked }))
                    }
                  />
                  <Text size="small">테스트 실행 (Dry Run)</Text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* 최근 동기화 이력 */}
      <Container>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Heading level="h3">최근 동기화 이력</Heading>
            <Button variant="secondary" size="small">
              전체 이력 보기
            </Button>
          </div>
          
          {syncHistory?.records?.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>상품</Table.HeaderCell>
                  <Table.HeaderCell>마켓플레이스</Table.HeaderCell>
                  <Table.HeaderCell>상태</Table.HeaderCell>
                  <Table.HeaderCell>시도 횟수</Table.HeaderCell>
                  <Table.HeaderCell>마지막 시도</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {syncHistory.records.slice(0, 5).map((record: any) => (
                  <Table.Row key={record.id}>
                    <Table.Cell>
                      <div>
                        <Text size="small" weight="plus">
                          {record.product_title || record.medusa_product_id}
                        </Text>
                        <Text size="small" className="text-grey-500">
                          ID: {record.medusa_product_id}
                        </Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{record.marketplace_name}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge 
                        color={
                          record.sync_status === "completed" ? "green" :
                          record.sync_status === "failed" ? "red" :
                          record.sync_status === "pending" ? "orange" : "blue"
                        }
                      >
                        {
                          record.sync_status === "completed" ? "완료" :
                          record.sync_status === "failed" ? "실패" :
                          record.sync_status === "pending" ? "대기" : "진행중"
                        }
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{record.sync_attempts}회</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">
                        {new Date(record.last_sync_attempt).toLocaleString('ko-KR')}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <div className="text-center p-4 text-grey-500">
              <Text>동기화 이력이 없습니다.</Text>
            </div>
          )}
        </div>
      </Container>
    </div>
  )
}

// 라우트 설정
export const config = defineRouteConfig({
  label: "Amazon 대시보드",
})

export default AmazonDashboard