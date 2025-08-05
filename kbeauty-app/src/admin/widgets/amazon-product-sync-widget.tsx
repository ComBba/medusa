import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { 
  Button, 
  Container, 
  StatusBadge, 
  toast,
  Text,
  Heading,
  Badge,
  CodeBlock
} from "@medusajs/ui"
import { useState } from "react"
import { 
  useAmazonSync, 
  useAmazonSyncStatus, 
  useAmazonMarketplaces 
} from "../../workflows/hooks/useAmazonSync"

/**
 * 상품 상세 페이지의 Amazon 동기화 상태 및 관리 위젯
 */
const AmazonProductSyncWidget = ({ data }: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [showDetails, setShowDetails] = useState(false)
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([])
  
  const { syncProduct, isSyncing, syncProgress, error } = useAmazonSync()
  const { data: syncStatus, isLoading: statusLoading } = useAmazonSyncStatus(data.id)
  const { data: marketplaces, isLoading: marketplacesLoading } = useAmazonMarketplaces()

  const handleSync = async () => {
    try {
      await syncProduct({
        product_id: data.id,
        marketplace_ids: selectedMarketplaces.length > 0 ? selectedMarketplaces : undefined,
        options: {
          sync_images: true,
          include_variants: true,
          force_update: false
        }
      })
      toast.success("Amazon 동기화가 완료되었습니다!")
    } catch (err: any) {
      toast.error(`동기화 실패: ${err.message}`)
    }
  }

  const handleForceSync = async () => {
    try {
      await syncProduct({
        product_id: data.id,
        marketplace_ids: selectedMarketplaces.length > 0 ? selectedMarketplaces : undefined,
        options: {
          sync_images: true,
          include_variants: true,
          force_update: true
        }
      })
      toast.success("강제 동기화가 완료되었습니다!")
    } catch (err: any) {
      toast.error(`강제 동기화 실패: ${err.message}`)
    }
  }

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <StatusBadge color="green">동기화 완료</StatusBadge>
      case "pending":
        return <StatusBadge color="orange">대기 중</StatusBadge>
      case "failed":
        return <StatusBadge color="red">실패</StatusBadge>
      case "in_progress":
        return <StatusBadge color="blue">진행 중</StatusBadge>
      default:
        return <StatusBadge color="grey">미동기화</StatusBadge>
    }
  }

  const getOverallSyncStatus = () => {
    if (!syncStatus?.sync_records?.length) {
      return { status: "not_synced", count: 0 }
    }

    const records = syncStatus.sync_records
    const completedCount = records.filter((r: any) => r.sync_status === "completed").length
    const pendingCount = records.filter((r: any) => r.sync_status === "pending").length
    const failedCount = records.filter((r: any) => r.sync_status === "failed").length

    if (completedCount === records.length) {
      return { status: "completed", count: completedCount }
    } else if (failedCount > 0) {
      return { status: "partial_failed", count: failedCount }
    } else if (pendingCount > 0) {
      return { status: "pending", count: pendingCount }
    }

    return { status: "mixed", count: records.length }
  }

  const overallStatus = getOverallSyncStatus()

  if (statusLoading || marketplacesLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center p-4">
          <Text>Amazon 동기화 정보를 불러오는 중...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heading level="h3">Amazon 동기화</Heading>
            {getSyncStatusBadge(overallStatus.status)}
            {overallStatus.count > 0 && (
              <Badge color="blue">
                {overallStatus.count}개 마켓플레이스
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSync} 
              isLoading={isSyncing}
              variant="primary"
              size="small"
            >
              동기화
            </Button>
            <Button 
              onClick={handleForceSync} 
              isLoading={isSyncing}
              variant="secondary"
              size="small"
            >
              강제 동기화
            </Button>
          </div>
        </div>

        {/* 진행 상태 표시 */}
        {isSyncing && syncProgress.isRunning && (
          <div className="space-y-2">
            <Text size="small" className="text-grey-500">
              {syncProgress.currentStep || "동기화 진행 중..."}
            </Text>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress.progress || 10}%` }}
              />
            </div>
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <Text size="small" className="text-red-700">
              에러: {error.message}
            </Text>
          </div>
        )}

        {/* 마켓플레이스 선택 */}
        {marketplaces?.active_marketplaces?.length > 0 && (
          <div className="space-y-2">
            <Text size="small" weight="plus">대상 마켓플레이스:</Text>
            <div className="flex flex-wrap gap-2">
              {marketplaces.active_marketplaces.map((marketplace: any) => (
                <Button
                  key={marketplace.id}
                  variant={selectedMarketplaces.includes(marketplace.marketplace_id) ? "primary" : "secondary"}
                  size="small"
                  onClick={() => {
                    if (selectedMarketplaces.includes(marketplace.marketplace_id)) {
                      setSelectedMarketplaces(prev => 
                        prev.filter(id => id !== marketplace.marketplace_id)
                      )
                    } else {
                      setSelectedMarketplaces(prev => [...prev, marketplace.marketplace_id])
                    }
                  }}
                >
                  {marketplace.name || marketplace.marketplace_id}
                </Button>
              ))}
            </div>
            {selectedMarketplaces.length === 0 && (
              <Text size="small" className="text-grey-500">
                선택하지 않으면 모든 활성 마켓플레이스에 동기화됩니다.
              </Text>
            )}
          </div>
        )}

        {/* 동기화 상세 정보 */}
        {syncStatus?.sync_records?.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Text size="small" weight="plus">동기화 상태 상세</Text>
              <Button
                variant="transparent"
                size="small"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "숨기기" : "자세히 보기"}
              </Button>
            </div>

            {showDetails && (
              <div className="space-y-2">
                {syncStatus.sync_records.map((record: any) => (
                  <div 
                    key={record.id} 
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <Text size="small">{record.marketplace_name}</Text>
                      {getSyncStatusBadge(record.sync_status)}
                    </div>
                    <div className="flex items-center gap-2">
                      {record.amazon_product_id && (
                        <Badge color="green">
                          {record.amazon_product_id}
                        </Badge>
                      )}
                      <Text size="small" className="text-grey-500">
                        시도: {record.sync_attempts}회
                      </Text>
                    </div>
                  </div>
                ))}

                {/* 에러 정보 표시 */}
                {syncStatus.sync_records.some((r: any) => r.error_message) && (
                  <div className="mt-4">
                    <Text size="small" weight="plus" className="mb-2">에러 상세:</Text>
                    <CodeBlock snippets={[{
                      label: "Error Details",
                      language: "json",
                      code: JSON.stringify(
                        syncStatus.sync_records
                          .filter((r: any) => r.error_message)
                          .map((r: any) => ({
                            marketplace: r.marketplace_name,
                            error: r.error_message,
                            timestamp: r.last_sync_attempt
                          })),
                        null,
                        2
                      )
                    }]}>
                    </CodeBlock>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 동기화 이력이 없는 경우 */}
        {(!syncStatus?.sync_records || syncStatus.sync_records.length === 0) && (
          <div className="text-center p-4 bg-gray-50 rounded-md">
            <Text size="small" className="text-grey-500">
              이 상품은 아직 Amazon에 동기화되지 않았습니다.
            </Text>
            <Text size="small" className="text-grey-500">
              위의 "동기화" 버튼을 클릭하여 Amazon 마켓플레이스에 업로드하세요.
            </Text>
          </div>
        )}

        {/* 마지막 동기화 시간 */}
        {syncStatus?.last_successful_sync && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Text size="small" className="text-grey-500">
              마지막 성공한 동기화:
            </Text>
            <Text size="small">
              {new Date(syncStatus.last_successful_sync).toLocaleString('ko-KR')}
            </Text>
          </div>
        )}
      </div>
    </Container>
  )
}

// Widget 설정
export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default AmazonProductSyncWidget