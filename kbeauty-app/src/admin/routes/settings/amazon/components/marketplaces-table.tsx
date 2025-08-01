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
      setMarketplaces(data.marketplaces || [])
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
      
      await amazonSyncClient.updateMarketplace(marketplace.id, {
        is_active: !marketplace.is_active,
        auto_sync: marketplace.auto_sync,
        seller_id: marketplace.seller_id
      })

      toast.success(
        marketplace.is_active 
          ? `${marketplace.name} 마켓플레이스가 비활성화되었습니다.`
          : `${marketplace.name} 마켓플레이스가 활성화되었습니다.`
      )
      await fetchMarketplaces() // 목록 새로고침
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
                      onCheckedChange={() => toggleMarketplace(marketplace)}
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