import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { CloudArrowUp } from "@medusajs/icons"
import { AmazonMarketplacesTable } from "./components/marketplaces-table"
import { ConnectionTest } from "./components/connection-test"
import { SyncDashboard } from "./components/sync-dashboard"
import { useState } from "react"

const AmazonIntegrationPage = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<any>(null)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Amazon Integration</Heading>
          <Text className="text-medusa-fg-subtle">
            Manage your Amazon marketplace integrations and sync settings
          </Text>
        </div>
      </div>
      
      <div className="px-6 py-4 space-y-6">
        <SyncDashboard />
        
        <AmazonMarketplacesTable 
          onMarketplaceSelect={setSelectedMarketplace}
        />
        
        {selectedMarketplace && (
          <ConnectionTest 
            marketplace={selectedMarketplace}
          />
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Amazon Integration",
  icon: CloudArrowUp,
})

export default AmazonIntegrationPage