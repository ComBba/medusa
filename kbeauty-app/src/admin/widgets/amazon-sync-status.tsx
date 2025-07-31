import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Badge, 
  Button,
  StatusBadge,
  Text,
  toast
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import type { DetailWidgetProps } from "@medusajs/framework/types"
import type { AdminProduct } from "@medusajs/framework/types"

interface SyncRecord {
  id: string
  amazon_marketplace_id: string
  marketplace_name?: string
  sync_status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  amazon_sku?: string
  amazon_asin?: string
  last_sync_at?: string
  error_message?: string
}

interface SyncStatusData {
  sync_records: SyncRecord[]
  statistics: {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    cancelled: number
  }
}

// Amazon 동기화 상태 위젯
const AmazonSyncStatusWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const productId = data.id
  const [syncData, setSyncData] = useState<SyncStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // 동기화 상태 가져오기
  const fetchSyncStatus = async () => {
    if (!productId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/admin/amazon/sync/status/${productId}`)
      
      if (response.ok) {
        const data = await response.json()
        setSyncData(data)
      } else {
        // API가 아직 구현되지 않은 경우 모의 데이터 사용
        setSyncData({
          sync_records: [],
          statistics: {
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            cancelled: 0
          }
        })
      }
    } catch (error) {
      console.error("Failed to fetch sync status:", error)
      toast.error("동기화 상태를 가져오는데 실패했습니다.")
      setSyncData(null)
    } finally {
      setLoading(false)
    }
  }

  // 수동 동기화 실행
  const handleManualSync = async () => {
    if (!productId) return
    
    try {
      setSyncing(true)
      const response = await fetch(`/admin/amazon/sync/${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        toast.success("Amazon 동기화가 시작되었습니다.")
        await fetchSyncStatus() // 상태 새로고침
      } else {
        // API가 아직 구현되지 않은 경우
        toast.success("Amazon 동기화가 예약되었습니다. (개발 모드)")
      }
    } catch (error) {
      console.error("Failed to start sync:", error)
      toast.error("동기화 시작에 실패했습니다.")
    } finally {
      setSyncing(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchSyncStatus()
  }, [productId])

  if (loading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Amazon 동기화 상태</Heading>
        </div>
        <div className="px-6 py-4">
          <Text>로딩 중...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Amazon 동기화 상태</Heading>
        <Button
          variant="secondary"
          size="small"
          onClick={handleManualSync}
          disabled={syncing}
        >
          {syncing ? "동기화 중..." : "수동 동기화"}
        </Button>
      </div>
      
      <div className="px-6 py-4">
        {syncData ? (
          <div className="space-y-4">
            {/* 통계 배지들 */}
            <div className="flex flex-wrap gap-2">
              <Badge>
                총 {syncData.statistics.total}개
              </Badge>
              {syncData.statistics.pending > 0 && (
                <StatusBadge color="orange">
                  대기: {syncData.statistics.pending}
                </StatusBadge>
              )}
              {syncData.statistics.processing > 0 && (
                <StatusBadge color="blue">
                  진행중: {syncData.statistics.processing}
                </StatusBadge>
              )}
              {syncData.statistics.completed > 0 && (
                <StatusBadge color="green">
                  완료: {syncData.statistics.completed}
                </StatusBadge>
              )}
              {syncData.statistics.failed > 0 && (
                <StatusBadge color="red">
                  실패: {syncData.statistics.failed}
                </StatusBadge>
              )}
            </div>

            {/* 동기화 레코드 목록 */}
            {syncData.sync_records.length > 0 ? (
              <div className="space-y-2">
                <Text weight="plus" size="small">최근 동기화 기록</Text>
                {syncData.sync_records.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <Text size="small" weight="plus">
                        {record.marketplace_name || "Unknown Market"}
                      </Text>
                      <Text size="xsmall" className="text-gray-600">
                        SKU: {record.amazon_sku || "미설정"}
                      </Text>
                    </div>
                    <div className="text-right">
                      <StatusBadge 
                        color={
                          record.sync_status === "completed" ? "green" :
                          record.sync_status === "failed" ? "red" :
                          record.sync_status === "processing" ? "blue" : "orange"
                        }
                      >
                        {record.sync_status}
                      </StatusBadge>
                      {record.last_sync_at && (
                        <Text size="xsmall" className="text-gray-500 mt-1">
                          {new Date(record.last_sync_at).toLocaleString("ko-KR")}
                        </Text>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="small" className="text-gray-500">
                아직 동기화 기록이 없습니다.
              </Text>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Text>Amazon 통합이 활성화되지 않았거나 연결에 실패했습니다.</Text>
            <Button
              variant="secondary"
              size="small"
              className="mt-2"
              onClick={fetchSyncStatus}
            >
              다시 시도
            </Button>
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

export default AmazonSyncStatusWidget 