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
  Switch
} from "@medusajs/ui"
import { 
  ArrowPath, 
  PlaySolid,
  ArrowsPointingOut
} from "@medusajs/icons"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { DetailWidgetProps } from "@medusajs/framework/types"
import type { AdminProduct } from "@medusajs/framework/types"
import { sdk } from "../lib/config"

interface SyncOptions {
  force_update: boolean
  include_variants: boolean
  sync_images: boolean
  selected_marketplaces: string[]
}

// Enhanced Amazon 동기화 위젯
const AmazonEnhancedSyncWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const productId = data.id
  const queryClient = useQueryClient()
  
  // 상태 관리
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    force_update: false,
    include_variants: true,
    sync_images: true,
    selected_marketplaces: ["ATVPDKIKX0DER"] // 기본: 미국 마켓플레이스
  })

  // 마켓플레이스 목록 조회
  const { data: marketplaces } = useQuery({
    queryKey: ["amazon-marketplaces"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/amazon/marketplaces", {
        method: "GET",
        credentials: "include"
      }) as { marketplaces?: any[] }
      return response?.marketplaces || []
    }
  })

  // Enhanced 워크플로우 실행
  const executeEnhancedWorkflow = useMutation({
    mutationFn: async (workflowType: "enhanced" | "all-enhanced") => {
      const workflowId = workflowType === "enhanced" 
        ? "amazon-sync-enhanced" 
        : "amazon-sync-all-enhanced"

      let input: any

      if (workflowType === "enhanced") {
        input = {
          product: { 
            id: productId,
            // 실제로는 전체 상품 객체가 필요하지만 테스트용으로 ID만 사용
          },
          marketplace_ids: syncOptions.selected_marketplaces,
          options: {
            sync_images: syncOptions.sync_images,
            include_variants: syncOptions.include_variants,
            force_update: syncOptions.force_update
          }
        }
      } else {
        input = {
          product_id: productId,
          marketplace_ids: syncOptions.selected_marketplaces,
          options: {
            sync_product: true,
            sync_inventory: true,
            sync_price: true,
            force_update: syncOptions.force_update
          }
        }
      }

      const response = await sdk.client.fetch(`/admin/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          input,
          options: { async: true }
        })
      })
      
      return response
    },
    onSuccess: (_, variables) => {
      const workflowName = variables === "enhanced" 
        ? "Enhanced Amazon 동기화" 
        : "통합 Amazon 동기화"
      
      toast.success("워크플로우 실행 성공", {
        description: `${workflowName}가 백그라운드에서 시작되었습니다.`
      })
      
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-status"] })
    },
    onError: (error: any) => {
      toast.error("워크플로우 실행 실패", {
        description: error.message || "워크플로우 실행 중 오류가 발생했습니다."
      })
    }
  })

  const handleMarketplaceChange = (marketplaceId: string, checked: boolean) => {
    setSyncOptions(prev => ({
      ...prev,
      selected_marketplaces: checked 
        ? [...prev.selected_marketplaces, marketplaceId]
        : prev.selected_marketplaces.filter(id => id !== marketplaceId)
    }))
  }

  return (
    <Container className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowsPointingOut className="w-5 h-5 text-medusa-fg-subtle" />
          <Heading level="h3" className="text-medusa-fg-base">
            Enhanced Amazon 동기화
          </Heading>
          <Badge color="blue" size="small">v2.0</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {/* 마켓플레이스 선택 */}
        <div>
          <Label className="mb-2 block">마켓플레이스 선택</Label>
          <div className="grid grid-cols-2 gap-2">
            {marketplaces?.slice(0, 4)?.map((marketplace: any) => (
              <div key={marketplace.marketplace_id} className="flex items-center space-x-2">
                <Checkbox
                  id={marketplace.marketplace_id}
                  checked={syncOptions.selected_marketplaces.includes(marketplace.marketplace_id)}
                  onCheckedChange={(checked) => 
                    handleMarketplaceChange(marketplace.marketplace_id, checked as boolean)
                  }
                />
                <Label htmlFor={marketplace.marketplace_id} className="text-sm">
                  {marketplace.country_code}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* 동기화 옵션 */}
        <div className="space-y-3">
          <Label className="block">동기화 옵션</Label>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="include_variants" className="text-sm">
              상품 변형 포함
            </Label>
            <Switch
              id="include_variants"
              checked={syncOptions.include_variants}
              onCheckedChange={(checked) => 
                setSyncOptions(prev => ({ ...prev, include_variants: checked }))
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="sync_images" className="text-sm">
              이미지 동기화
            </Label>
            <Switch
              id="sync_images"
              checked={syncOptions.sync_images}
              onCheckedChange={(checked) => 
                setSyncOptions(prev => ({ ...prev, sync_images: checked }))
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="force_update" className="text-sm">
              강제 업데이트
            </Label>
            <Switch
              id="force_update"
              checked={syncOptions.force_update}
              onCheckedChange={(checked) => 
                setSyncOptions(prev => ({ ...prev, force_update: checked }))
              }
            />
          </div>
        </div>

        {/* 실행 버튼들 */}
        <div className="flex gap-2 pt-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => executeEnhancedWorkflow.mutate("enhanced")}
            isLoading={executeEnhancedWorkflow.isPending}
            disabled={syncOptions.selected_marketplaces.length === 0}
            className="flex-1"
          >
            <PlaySolid className="w-4 h-4 mr-1" />
            Enhanced 동기화
          </Button>
          
          <Button
            size="small"
            onClick={() => executeEnhancedWorkflow.mutate("all-enhanced")}
            isLoading={executeEnhancedWorkflow.isPending}
            disabled={syncOptions.selected_marketplaces.length === 0}
            className="flex-1"
          >
            <ArrowPath className="w-4 h-4 mr-1" />
            통합 동기화
          </Button>
        </div>

        {/* 상태 정보 */}
        <div className="pt-2 border-t border-medusa-border-base">
          <div className="flex items-center justify-between text-sm">
            <Text className="text-medusa-fg-subtle">
              선택된 마켓플레이스: {syncOptions.selected_marketplaces.length}개
            </Text>
            <StatusBadge color="green">
              Enhanced v2
            </StatusBadge>
          </div>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default AmazonEnhancedSyncWidget