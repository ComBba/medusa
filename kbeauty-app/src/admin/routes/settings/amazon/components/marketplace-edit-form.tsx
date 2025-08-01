import {
  Drawer,
  Heading,
  Label,
  Input,
  Button,
  Switch,
  Text,
  StatusBadge,
  toast
} from "@medusajs/ui"
import {
  FormProvider,
  Controller,
  useForm
} from "react-hook-form"
import { useState } from "react"
import { Pencil } from "@medusajs/icons"
import { amazonSyncClient } from "../../../../lib/config"

interface AmazonMarketplace {
  id: string
  marketplace_id: string
  name: string
  country_code: string
  currency_code: string
  is_active: boolean
  auto_sync: boolean
  seller_id?: string
  mws_auth_token?: string
}

interface MarketplaceFormData {
  seller_id: string
  mws_auth_token: string
  auto_sync: boolean
}

interface MarketplaceEditFormProps {
  marketplace: AmazonMarketplace
  onSave: () => void
}

export const MarketplaceEditForm = ({ marketplace, onSave }: MarketplaceEditFormProps) => {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<MarketplaceFormData>({
    defaultValues: {
      seller_id: marketplace.seller_id || "",
      mws_auth_token: marketplace.mws_auth_token || "",
      auto_sync: marketplace.auto_sync
    }
  })

  const handleSubmit = async (data: MarketplaceFormData) => {
    try {
      setSaving(true)
      
      await amazonSyncClient.updateMarketplace(marketplace.id, {
        seller_id: data.seller_id,
        mws_token: data.mws_auth_token,
        auto_sync: data.auto_sync,
        is_active: marketplace.is_active
      })

      toast.success(`${marketplace.name} 설정이 업데이트되었습니다.`)
      setOpen(false)
      onSave() // 부모 컴포넌트에서 목록 새로고침
    } catch (error) {
      console.error('Error updating marketplace:', error)
      toast.error("마켓플레이스 설정 업데이트에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    form.reset({
      seller_id: marketplace.seller_id || "",
      mws_auth_token: marketplace.mws_auth_token || "",
      auto_sync: marketplace.auto_sync
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button 
          variant="transparent" 
          size="small"
          onClick={resetForm}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </Drawer.Trigger>
      
      <Drawer.Content>
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <Drawer.Header>
              <div className="flex items-center gap-3">
                <Heading className="capitalize">
                  Configure {marketplace.name}
                </Heading>
                <StatusBadge color={marketplace.is_active ? "green" : "grey"}>
                  {marketplace.is_active ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
              <Text className="text-medusa-fg-subtle">
                Configure marketplace credentials and synchronization settings
              </Text>
            </Drawer.Header>
            
            <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-6 overflow-y-auto">
              {/* Marketplace Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-medusa-bg-subtle rounded-lg">
                <div>
                  <Label size="small" weight="plus">Marketplace ID</Label>
                  <Text className="text-sm text-medusa-fg-muted">
                    {marketplace.marketplace_id}
                  </Text>
                </div>
                <div>
                  <Label size="small" weight="plus">Country</Label>
                  <Text className="text-sm text-medusa-fg-muted">
                    {marketplace.country_code} ({marketplace.currency_code})
                  </Text>
                </div>
              </div>

              {/* Seller ID */}
              <Controller
                control={form.control}
                name="seller_id"
                rules={{
                  required: "Seller ID는 필수입니다",
                  minLength: {
                    value: 10,
                    message: "Seller ID는 최소 10자 이상이어야 합니다"
                  }
                }}
                render={({ field, fieldState }) => {
                  return (
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-x-1">
                        <Label size="small" weight="plus">
                          Seller ID
                        </Label>
                        <Text className="text-xs text-medusa-fg-subtle">*</Text>
                      </div>
                      <Input 
                        {...field} 
                        placeholder="예: A1XXXXXXXXXXXX"
                        aria-invalid={!!fieldState.error}
                      />
                      {fieldState.error && (
                        <Text className="text-xs text-red-600">
                          {fieldState.error.message}
                        </Text>
                      )}
                      <Text className="text-xs text-medusa-fg-subtle">
                        Amazon Seller Central에서 확인할 수 있는 셀러 ID입니다.
                      </Text>
                    </div>
                  )
                }}
              />

              {/* MWS Auth Token */}
              <Controller
                control={form.control}
                name="mws_auth_token"
                render={({ field, fieldState }) => {
                  return (
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-x-1">
                        <Label size="small" weight="plus">
                          MWS Auth Token
                        </Label>
                        <Text className="text-xs text-medusa-fg-subtle">(선택사항)</Text>
                      </div>
                      <Input 
                        {...field} 
                        placeholder="MWS 인증 토큰"
                        type="password"
                        aria-invalid={!!fieldState.error}
                      />
                      {fieldState.error && (
                        <Text className="text-xs text-red-600">
                          {fieldState.error.message}
                        </Text>
                      )}
                      <Text className="text-xs text-medusa-fg-subtle">
                        Marketplace Web Service 인증 토큰 (필요한 경우에만 입력)
                      </Text>
                    </div>
                  )
                }}
              />

              {/* Auto Sync Toggle */}
              <Controller
                control={form.control}
                name="auto_sync"
                render={({ field }) => {
                  return (
                    <div className="flex flex-col space-y-2">
                      <Label size="small" weight="plus">
                        Auto Synchronization
                      </Label>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <Text className="text-sm">
                          {field.value ? "자동 동기화 활성화됨" : "자동 동기화 비활성화됨"}
                        </Text>
                      </div>
                      <Text className="text-xs text-medusa-fg-subtle">
                        상품 생성/수정 시 자동으로 Amazon에 동기화합니다.
                      </Text>
                    </div>
                  )
                }}
              />

              {/* Setup Instructions */}
              <div className="p-4 bg-medusa-bg-base border border-medusa-border-base rounded-lg">
                <Heading level="h3" className="mb-3">💡 Setup Guide</Heading>
                <div className="space-y-2 text-sm">
                  <Text>1. Amazon Seller Central에서 Seller ID를 확인하세요</Text>
                  <Text>2. SP-API 앱을 등록하고 필요한 권한을 요청하세요</Text>
                  <Text>3. 설정 저장 후 "Test Connection" 기능으로 연결을 확인하세요</Text>
                  <Text>4. 마켓플레이스를 활성화하여 동기화를 시작하세요</Text>
                </div>
              </div>
            </Drawer.Body>
            
            <Drawer.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <Drawer.Close asChild>
                  <Button size="small" variant="secondary">
                    Cancel
                  </Button>
                </Drawer.Close>
                <Button 
                  size="small" 
                  type="submit"
                  disabled={saving}
                  isLoading={saving}
                >
                  Save Settings
                </Button>
              </div>
            </Drawer.Footer>
          </form>
        </FormProvider>
      </Drawer.Content>
    </Drawer>
  )
}