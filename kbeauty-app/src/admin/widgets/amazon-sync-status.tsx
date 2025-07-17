import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Badge, 
  Button,
  StatusBadge,
  Table,
  Text,
  toast
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"

interface SyncRecord {
  id: string
  amazon_marketplace_id: string
  marketplace_name?: string
  country_code?: string
  sync_status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  amazon_sku?: string
  amazon_asin?: string
  last_sync_at?: string
  error_message?: string
  processing_status?: string
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

/**
 * Amazon 동기화 상태 위젯
 * 
 * 상품 상세 페이지에서 해당 상품의 Amazon 동기화 상태를 표시
 */
const AmazonSyncStatusWidget = () => {
  const { id: productId } = useParams()
  const [syncData, setSyncData] = useState<SyncStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // 동기화 상태 조회
  const fetchSyncStatus = async () => {
    if (!productId) return

    try {
      const response = await fetch(`/admin/amazon/sync?product_id=${productId}`)
      const data = await response.json()
      
      if (response.ok) {
        setSyncData(data)
      } else {
        console.error("Amazon 동기화 상태 조회 실패:", data.message)
      }
    } catch (error) {
      console.error("Amazon 동기화 상태 조회 중 오류:", error)
    } finally {
      setLoading(false)
    }
  }

  // 수동 동기화 실행
  const handleManualSync = async () => {
    if (!productId || syncing) return

    setSyncing(true)
    
    try {
      const response = await fetch("/admin/amazon/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: productId
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success("Amazon 동기화가 시작되었습니다")
        // 5초 후 상태 새로고침
        setTimeout(fetchSyncStatus, 5000)
      } else {
        toast.error(`동기화 실행 실패: ${data.message}`)
      }
      
    } catch (error) {
      toast.error("동기화 실행 중 오류가 발생했습니다")
      console.error("Manual sync error:", error)
    } finally {
      setSyncing(false)
    }
  }

  // 실패한 동기화 재시도
  const handleRetrySync = async (syncRecordIds: string[]) => {
    try {
      const response = await fetch("/admin/amazon/sync/retry", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sync_record_ids: syncRecordIds
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(data.message)
        fetchSyncStatus()
      } else {
        toast.error(`재시도 실패: ${data.message}`)
      }
      
    } catch (error) {
      toast.error("재시도 중 오류가 발생했습니다")
      console.error("Retry sync error:", error)
    }
  }

  // 상태 배지 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "green"
      case "processing": return "blue"
      case "pending": return "orange"
      case "failed": return "red"
      case "cancelled": return "grey"
      default: return "grey"
    }
  }

  // 상태 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "완료"
      case "processing": return "처리중"
      case "pending": return "대기"
      case "failed": return "실패"
      case "cancelled": return "취소"
      default: return "알 수 없음"
    }
  }

  useEffect(() => {
    fetchSyncStatus()
  }, [productId])

  if (loading) {
    return (
      <Container>
        <Text>Amazon 동기화 상태를 불러오는 중...</Text>
      </Container>
    )
  }

  if (!syncData) {
    return (
      <Container>
        <div className="flex items-center justify-between">
          <Heading level="h3">🌎 Amazon 연동</Heading>
          <Button 
            variant="secondary" 
            size="small"
            onClick={handleManualSync}
            isLoading={syncing}
          >
            Amazon에 등록
          </Button>
        </div>
        <Text className="text-ui-fg-subtle mt-2">
          이 상품은 아직 Amazon에 등록되지 않았습니다.
        </Text>
      </Container>
    )
  }

  const { sync_records, statistics } = syncData
  const failedRecords = sync_records.filter(record => record.sync_status === "failed")

  return (
    <Container>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <Heading level="h3">🌎 Amazon 연동 상태</Heading>
          <div className="flex gap-2">
            {failedRecords.length > 0 && (
              <Button 
                variant="secondary" 
                size="small"
                onClick={() => handleRetrySync(failedRecords.map(r => r.id))}
              >
                실패한 동기화 재시도
              </Button>
            )}
            <Button 
              variant="secondary" 
              size="small"
              onClick={handleManualSync}
              isLoading={syncing}
            >
              수동 동기화
            </Button>
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-5 gap-2">
          <div className="text-center">
            <Text className="text-ui-fg-subtle text-xs">총 마켓플레이스</Text>
            <Text className="font-medium">{statistics.total}</Text>
          </div>
          <div className="text-center">
            <Text className="text-ui-fg-subtle text-xs">완료</Text>
            <Text className="font-medium text-ui-fg-on-color-success">{statistics.completed}</Text>
          </div>
          <div className="text-center">
            <Text className="text-ui-fg-subtle text-xs">처리중</Text>
            <Text className="font-medium text-ui-fg-on-color-info">{statistics.processing}</Text>
          </div>
          <div className="text-center">
            <Text className="text-ui-fg-subtle text-xs">대기</Text>
            <Text className="font-medium text-ui-fg-on-color-warning">{statistics.pending}</Text>
          </div>
          <div className="text-center">
            <Text className="text-ui-fg-subtle text-xs">실패</Text>
            <Text className="font-medium text-ui-fg-on-color-error">{statistics.failed}</Text>
          </div>
        </div>

        {/* 동기화 레코드 테이블 */}
        {sync_records.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>마켓플레이스</Table.HeaderCell>
                  <Table.HeaderCell>상태</Table.HeaderCell>
                  <Table.HeaderCell>Amazon SKU</Table.HeaderCell>
                  <Table.HeaderCell>ASIN</Table.HeaderCell>
                  <Table.HeaderCell>마지막 동기화</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sync_records.map((record) => (
                  <Table.Row key={record.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Badge size="small">{record.country_code}</Badge>
                        <Text size="small">{record.marketplace_name}</Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge color={getStatusColor(record.sync_status)}>
                        {getStatusText(record.sync_status)}
                      </StatusBadge>
                      {record.error_message && (
                        <Text size="xsmall" className="text-ui-fg-error mt-1">
                          {record.error_message}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{record.amazon_sku || "-"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{record.amazon_asin || "-"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">
                        {record.last_sync_at 
                          ? new Date(record.last_sync_at).toLocaleString("ko-KR")
                          : "-"
                        }
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
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