import {
  Container,
  Heading,
  Text,
  Table,
  StatusBadge,
  Button,
  Badge,
  Avatar,
  DropdownMenu,
  IconButton,
  Input,
  Select
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { 
  EllipsisHorizontal, 
  ArrowPath, 
  MagnifyingGlass,
  ExclamationCircle,
  Eye,
  PlaySolid
} from "@medusajs/icons"
import { amazonSyncClient } from "../../../../lib/config"

interface ProductSyncRecord {
  id: string
  medusa_product_id: string
  amazon_marketplace_id: string
  amazon_asin?: string
  amazon_sku?: string
  amazon_listing_id?: string
  sync_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  last_sync_at?: string
  sync_attempts: number
  max_attempts: number
  error_message?: string
  error_code?: string
  feed_submission_id?: string
  processing_status?: string
  created_at: string
  updated_at: string
  
  // 추가 정보 (조인된 데이터)
  product?: {
    id: string
    title: string
    thumbnail?: string
    handle: string
  }
  marketplace?: {
    id: string
    name: string
    country_code: string
    marketplace_id: string
  }
}

interface ProductSyncTableProps {
  marketplaceId?: string
}

export const ProductSyncTable = ({ marketplaceId }: ProductSyncTableProps) => {
  const [syncRecords, setSyncRecords] = useState<ProductSyncRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  
  const pageSize = 20

  const fetchSyncRecords = async (page = 1) => {
    try {
      setLoading(page === 1)
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString()
      })
      
      if (marketplaceId) params.append('marketplace_id', marketplaceId)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      
      // 실제 Amazon 동기화 API 호출
      console.log('🔄 [SYNC API] 동기화 레코드 조회 중...', {
        params: params.toString(),
        pageSize,
        page,
        marketplaceId,
        statusFilter
      })

      const response = await amazonSyncClient.getSyncRecords(params.toString()) as {
        sync_records?: ProductSyncRecord[]
        pagination?: { total: number }
      }
      
      if (response && response.sync_records) {
        setSyncRecords(response.sync_records)
        setTotalRecords(response.pagination?.total || 0)
        
        console.log('✅ [SYNC API] 동기화 레코드 조회 성공:', {
          count: response.sync_records.length,
          total: response.pagination?.total
        })
      } else {
        // API 응답이 없는 경우 빈 배열 설정
        setSyncRecords([])
        setTotalRecords(0)
        
        console.log('⚠️ [SYNC API] 동기화 레코드가 없습니다')
      }
      
    } catch (error) {
      console.error('Failed to fetch sync records:', error)
      setSyncRecords([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSyncRecords(currentPage)
  }

  const handleRetrySync = async (recordId: string) => {
    setRetryingIds(prev => new Set(prev).add(recordId))
    
    try {
      await amazonSyncClient.retrySync({
        sync_record_ids: [recordId]
      })
      
      // 성공 후 목록 새로고침
      await fetchSyncRecords(currentPage)
      
    } catch (error) {
      console.error('Failed to retry sync:', error)
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(recordId)
        return newSet
      })
    }
  }

  const getStatusBadge = (status: string, attempts: number, maxAttempts: number) => {
    switch (status) {
      case 'completed':
        return <StatusBadge color="green">성공</StatusBadge>
      case 'failed':
        return <StatusBadge color="red">실패 ({attempts}/{maxAttempts})</StatusBadge>
      case 'processing':
        return <StatusBadge color="blue">진행중</StatusBadge>
      case 'pending':
        return <StatusBadge color="orange">대기중</StatusBadge>
      case 'cancelled':
        return <StatusBadge color="grey">취소됨</StatusBadge>
      default:
        return <StatusBadge color="grey">{status}</StatusBadge>
    }
  }

  const filteredRecords = syncRecords.filter(record => {
    const matchesSearch = !searchQuery || 
      record.product?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.amazon_sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.amazon_asin?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || record.sync_status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    fetchSyncRecords(1)
  }, [marketplaceId, statusFilter])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchSyncRecords(page)
  }

  return (
    <Container className="p-6 border border-medusa-border-base rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h2">Amazon 상품 동기화 목록</Heading>
          <Text className="text-medusa-fg-subtle">
            Amazon 마켓플레이스에 등록된 상품들의 동기화 상태를 확인하고 관리하세요
          </Text>
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={handleRefresh}
          disabled={refreshing}
          isLoading={refreshing}
        >
          <ArrowPath className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="상품명, SKU, ASIN으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <Select.Trigger className="w-40">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">모든 상태</Select.Item>
            <Select.Item value="completed">성공</Select.Item>
            <Select.Item value="failed">실패</Select.Item>
            <Select.Item value="processing">진행중</Select.Item>
            <Select.Item value="pending">대기중</Select.Item>
            <Select.Item value="cancelled">취소됨</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {/* 테이블 */}
      <div className="border border-medusa-border-base rounded-lg overflow-hidden">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>상품</Table.HeaderCell>
              <Table.HeaderCell>마켓플레이스</Table.HeaderCell>
              <Table.HeaderCell>Amazon 정보</Table.HeaderCell>
              <Table.HeaderCell>동기화 상태</Table.HeaderCell>
              <Table.HeaderCell>마지막 동기화</Table.HeaderCell>
              <Table.HeaderCell>액션</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Table.Row key={i}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-medusa-bg-subtle rounded animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 bg-medusa-bg-subtle rounded w-32 animate-pulse" />
                        <div className="h-3 bg-medusa-bg-subtle rounded w-20 animate-pulse" />
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="h-4 bg-medusa-bg-subtle rounded w-20 animate-pulse" />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="space-y-2">
                      <div className="h-3 bg-medusa-bg-subtle rounded w-24 animate-pulse" />
                      <div className="h-3 bg-medusa-bg-subtle rounded w-20 animate-pulse" />
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="h-6 bg-medusa-bg-subtle rounded w-16 animate-pulse" />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="h-4 bg-medusa-bg-subtle rounded w-20 animate-pulse" />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="h-8 bg-medusa-bg-subtle rounded w-8 animate-pulse" />
                  </Table.Cell>
                </Table.Row>
              ))
            ) : filteredRecords.length === 0 ? (
              <Table.Row>
                <Table.Cell className="text-center py-12" style={{ gridColumn: '1 / -1' }}>
                  <div className="flex flex-col items-center gap-3">
                    <MagnifyingGlass className="w-8 h-8 text-medusa-fg-muted" />
                    <Text className="text-medusa-fg-muted">
                      {searchQuery || statusFilter !== 'all' 
                        ? '검색 조건에 맞는 동기화 기록이 없습니다'
                        : '아직 동기화된 상품이 없습니다'
                      }
                    </Text>
                  </div>
                </Table.Cell>
              </Table.Row>
            ) : (
              filteredRecords.map((record) => (
                <Table.Row key={record.id}>
                  {/* 상품 정보 */}
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={record.product?.thumbnail}
                        fallback={record.product?.title?.charAt(0) || 'P'}
                        className="w-10 h-10"
                      />
                      <div>
                        <Text weight="plus" className="line-clamp-1">
                          {record.product?.title || 'Unknown Product'}
                        </Text>
                        <Text size="small" className="text-medusa-fg-subtle">
                          ID: {record.medusa_product_id}
                        </Text>
                      </div>
                    </div>
                  </Table.Cell>

                  {/* 마켓플레이스 */}
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Badge size="small" color="blue">
                        {record.marketplace?.country_code || 'US'}
                      </Badge>
                      <Text size="small">
                        {record.marketplace?.name || 'Amazon.com'}
                      </Text>
                    </div>
                  </Table.Cell>

                  {/* Amazon 정보 */}
                  <Table.Cell>
                    <div className="space-y-1">
                      {record.amazon_sku && (
                        <div className="flex items-center gap-2">
                          <Text size="small" className="text-medusa-fg-subtle">SKU:</Text>
                          <Text size="small" className="font-mono">
                            {record.amazon_sku}
                          </Text>
                        </div>
                      )}
                      {record.amazon_asin && (
                        <div className="flex items-center gap-2">
                          <Text size="small" className="text-medusa-fg-subtle">ASIN:</Text>
                          <Text size="small" className="font-mono">
                            {record.amazon_asin}
                          </Text>
                        </div>
                      )}
                      {!record.amazon_sku && !record.amazon_asin && (
                        <Text size="small" className="text-medusa-fg-muted">
                          아직 등록되지 않음
                        </Text>
                      )}
                    </div>
                  </Table.Cell>

                  {/* 동기화 상태 */}
                  <Table.Cell>
                    <div className="space-y-2">
                      {getStatusBadge(record.sync_status, record.sync_attempts, record.max_attempts)}
                      {record.error_message && (
                        <div className="flex items-center gap-1">
                          <ExclamationCircle className="w-3 h-3 text-red-500" />
                          <Text size="small" className="text-red-600 line-clamp-1">
                            {record.error_message}
                          </Text>
                        </div>
                      )}
                    </div>
                  </Table.Cell>

                  {/* 마지막 동기화 */}
                  <Table.Cell>
                    <Text size="small" className="text-medusa-fg-subtle">
                      {record.last_sync_at 
                        ? new Date(record.last_sync_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '없음'
                      }
                    </Text>
                  </Table.Cell>

                  {/* 액션 */}
                  <Table.Cell>
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item
                          onClick={() => window.open(
                            `/admin/products/${record.medusa_product_id}`, 
                            '_blank'
                          )}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          상품 보기
                        </DropdownMenu.Item>
                        
                        {record.amazon_asin && (
                          <DropdownMenu.Item
                            onClick={() => window.open(
                              `https://www.amazon.com/dp/${record.amazon_asin}`, 
                              '_blank'
                            )}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Amazon에서 보기
                          </DropdownMenu.Item>
                        )}
                        
                        <DropdownMenu.Separator />
                        
                        <DropdownMenu.Item
                          onClick={() => handleRetrySync(record.id)}
                          disabled={retryingIds.has(record.id)}
                        >
                          <PlaySolid className="w-4 h-4 mr-2" />
                          {retryingIds.has(record.id) ? '재동기화 중...' : '재동기화'}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </div>

      {/* 페이지네이션 */}
      {totalRecords > pageSize && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="secondary"
            size="small"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            이전
          </Button>
          <div className="flex items-center gap-2 px-4">
            <Text size="small">
              {currentPage} / {Math.ceil(totalRecords / pageSize)}
            </Text>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
          >
            다음
          </Button>
        </div>
      )}

      {/* 하단 요약 정보 */}
      <div className="mt-6 flex justify-between items-center text-sm text-medusa-fg-subtle">
        <Text>
          총 {filteredRecords.length}개의 동기화 기록 중 {Math.min(pageSize, filteredRecords.length)}개 표시
        </Text>
        <Text>
          마지막 업데이트: {new Date().toLocaleTimeString('ko-KR')}
        </Text>
      </div>
    </Container>
  )
}