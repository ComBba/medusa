import { 
  Table,
  Heading,
  Badge,
  StatusBadge,
  Switch,
  Button,
  Container,
  Text,
  Tooltip
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { toast } from "@medusajs/ui"
import { amazonSyncClient } from "../../../../lib/config"
import { MarketplaceEditForm } from "./marketplace-edit-form"

interface AmazonMarketplace {
  id: string
  marketplace_id: string
  name: string
  country_code: string
  currency_code: string
  is_active: boolean
  auto_sync: boolean
  seller_id?: string
}

interface AmazonMarketplacesTableProps {
  onMarketplaceSelect?: (marketplace: AmazonMarketplace | null) => void
}

export const AmazonMarketplacesTable = ({ onMarketplaceSelect }: AmazonMarketplacesTableProps) => {
  const [marketplaces, setMarketplaces] = useState<AmazonMarketplace[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  // 마켓플레이스 목록 가져오기
  const fetchMarketplaces = async () => {
    try {
      setLoading(true)
      const data = await amazonSyncClient.getMarketplaces() as any
      const marketplacesList = data.marketplaces || []
      
      // 환경변수 기본값으로 seller_id 보완
      const envSellerID = import.meta.env.VITE_AMAZON_SELLER_ID
      const enhancedMarketplaces = marketplacesList.map((mp: AmazonMarketplace) => ({
        ...mp,
        // DB에 저장된 값이 없고 환경변수 기본값이 있으면 사용
        seller_id: mp.seller_id || envSellerID || null,
        // 환경변수로 seller_id가 보완되었는지 표시
        _has_env_seller_id: !mp.seller_id && !!envSellerID
      }))
      
      console.log('📥 [FETCH] Fetched marketplaces:', {
        timestamp: new Date().toISOString(),
        count: marketplacesList.length,
        envSellerID,
        raw: marketplacesList,
        enhanced: enhancedMarketplaces,
        usMarketplace: enhancedMarketplaces.find(mp => mp.marketplace_id === 'ATVPDKIKX0DER')
      })
      
      setMarketplaces(enhancedMarketplaces)
    } catch (error) {
      console.error('Error fetching marketplaces:', error)
      toast.error("마켓플레이스 목록을 불러올 수 없습니다.")
    } finally {
      setLoading(false)
    }
  }

  // 마켓플레이스 활성화/비활성화 토글
  const toggleMarketplace = async (marketplace: AmazonMarketplace) => {
    try {
      setUpdating(marketplace.id)
      
      // 환경변수 기본값 고려한 seller_id 결정
      const envSellerID = import.meta.env.VITE_AMAZON_SELLER_ID
      const effectiveSellerID = marketplace.seller_id || envSellerID
      
      const updateData: any = {
        is_active: !marketplace.is_active,
        auto_sync: marketplace.auto_sync,
      }
      
      // Seller ID가 있으면 포함 (환경변수 기본값 포함)
      if (effectiveSellerID) {
        updateData.seller_id = effectiveSellerID
      }
      
      console.log('🔄 [TOGGLE] Before API call:', {
        marketplaceId: marketplace.id,
        marketplaceName: marketplace.name,
        currentState: marketplace.is_active,
        newState: !marketplace.is_active,
        effectiveSellerID,
        updateData,
        timestamp: new Date().toISOString()
      })
      
      const result = await amazonSyncClient.updateMarketplace(marketplace.id, updateData)
      console.log('✅ [TOGGLE] API result:', result)
      
      // API 응답의 구조 상세 로깅
      if (result) {
        console.log('📊 [TOGGLE] API response structure:', {
          hasMarketplace: !!result.marketplace,
          marketplaceData: result.marketplace,
          fullResponse: result,
          responseKeys: Object.keys(result || {})
        })
        
        // 마켓플레이스 데이터 상세 로깅
        if (result.marketplace) {
          console.log('🔍 [TOGGLE] Marketplace details:', {
            id: result.marketplace.id,
            name: result.marketplace.name,
            is_active: result.marketplace.is_active,
            seller_id: result.marketplace.seller_id,
            auto_sync: result.marketplace.auto_sync,
            marketplace_id: result.marketplace.marketplace_id
          })
        }
      }

      // API 응답에서 업데이트된 마켓플레이스 데이터가 있으면 직접 사용
      if (result && result.marketplace) {
        const updatedMarketplace = result.marketplace
        
        // 현재 마켓플레이스 목록에서 해당 마켓플레이스 업데이트
        setMarketplaces(prevMarketplaces => 
          prevMarketplaces.map(mp => 
            mp.id === marketplace.id 
              ? { 
                  ...mp, 
                  ...updatedMarketplace,
                  // 환경변수 기본값 유지
                  seller_id: updatedMarketplace.seller_id || mp.seller_id,
                  _has_env_seller_id: !updatedMarketplace.seller_id && !!import.meta.env.VITE_AMAZON_SELLER_ID
                }
              : mp
          )
        )
      } else {
        // fallback: 목록 새로고침
        await fetchMarketplaces()
      }

      toast.success(
        marketplace.is_active 
          ? `${marketplace.name} 마켓플레이스가 비활성화되었습니다.`
          : `${marketplace.name} 마켓플레이스가 활성화되었습니다.`
      )
    } catch (error) {
      console.error('Error updating marketplace:', error)
      toast.error("마켓플레이스 업데이트에 실패했습니다.")
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    fetchMarketplaces()
  }, [])

  if (loading) {
    return (
      <Container className="flex items-center justify-center py-12">
        <Text>Loading marketplaces...</Text>
      </Container>
    )
  }

  if (marketplaces.length === 0) {
    return (
      <Container className="flex flex-col items-center justify-center py-12 text-center">
        <Heading level="h3" className="mb-2">No marketplaces found</Heading>
        <Text className="text-medusa-fg-subtle mb-4">
          Run the setup script to initialize Amazon marketplaces.
        </Text>
        <Text className="text-sm text-medusa-fg-muted font-mono">
          npx medusa exec src/scripts/setup-amazon-integration.ts
        </Text>
      </Container>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Heading level="h2">Amazon Marketplaces</Heading>
        <Button 
          variant="secondary" 
          size="small"
          onClick={fetchMarketplaces}
          disabled={loading}
        >
          새로고침
        </Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Marketplace</Table.HeaderCell>
            <Table.HeaderCell>Country</Table.HeaderCell>
            <Table.HeaderCell>Currency</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Auto Sync</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {marketplaces.map((marketplace) => (
            <Table.Row 
              key={marketplace.id}
              className="cursor-pointer hover:bg-medusa-bg-subtle"
              onClick={() => onMarketplaceSelect?.(marketplace)}
            >
              <Table.Cell>
                <div>
                  <Text weight="plus">{marketplace.name}</Text>
                  <Text size="small" className="text-medusa-fg-subtle">
                    {marketplace.marketplace_id}
                  </Text>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge>
                  {marketplace.country_code}
                </Badge>
              </Table.Cell>
              <Table.Cell>{marketplace.currency_code}</Table.Cell>
              <Table.Cell>
                <StatusBadge 
                  color={marketplace.is_active ? "green" : "grey"}
                >
                  {marketplace.is_active ? "Active" : "Inactive"}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge 
                  color={marketplace.auto_sync ? "blue" : "grey"}
                >
                  {marketplace.auto_sync ? "Enabled" : "Disabled"}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <Tooltip content={marketplace.is_active ? "Deactivate" : "Activate"}>
                    <Switch
                      checked={marketplace.is_active}
                      onCheckedChange={(checked) => {
                        console.log('🎯 [SWITCH] Toggle clicked:', {
                          marketplaceId: marketplace.id,
                          marketplaceName: marketplace.name,
                          currentActive: marketplace.is_active,
                          newChecked: checked,
                          updating: updating === marketplace.id
                        })
                        toggleMarketplace(marketplace)
                      }}
                      disabled={updating === marketplace.id}
                    />
                  </Tooltip>
                  <MarketplaceEditForm 
                    marketplace={marketplace}
                    onSave={fetchMarketplaces}
                  />
                  {!marketplace.seller_id && (
                    <Tooltip content="Seller ID가 설정되지 않았습니다">
                      <StatusBadge color="orange">
                        Setup Required
                      </StatusBadge>
                    </Tooltip>
                  )}
                  {(marketplace as any)._has_env_seller_id && (
                    <Tooltip content="환경변수 기본값 사용 중 (DB에 저장하려면 편집하세요)">
                      <StatusBadge color="blue">
                        Env Default
                      </StatusBadge>
                    </Tooltip>
                  )}
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <div className="mt-6 p-4 bg-medusa-bg-subtle rounded-lg">
        <Heading level="h3" className="mb-2">💡 Quick Setup Guide</Heading>
        <div className="space-y-2 text-sm">
          <Text>1. Toggle marketplaces to activate them</Text>
          <Text>2. Configure Seller ID and credentials for each marketplace</Text>
          <Text>3. Test the connection with Amazon SP-API</Text>
          <Text>4. Start automatic product synchronization</Text>
        </div>
      </div>
    </div>
  )
}