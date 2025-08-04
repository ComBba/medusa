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

  // 환경변수에서 기본값 가져오기
  const getDefaultSellerID = () => {
    // 1. DB에 저장된 값이 있으면 우선 사용
    if (marketplace.seller_id && marketplace.seller_id !== 'your-seller-id') {
      return marketplace.seller_id
    }
    // 2. 환경변수 기본값 사용 (Vite 환경변수)
    const envSellerID = import.meta.env.VITE_AMAZON_SELLER_ID
    return envSellerID || ""
  }

  // 환경변수 Seller ID 가져오기 (UI 표시용)
  const getEnvSellerID = () => {
    return import.meta.env.VITE_AMAZON_SELLER_ID || ""
  }

  const form = useForm<MarketplaceFormData>({
    defaultValues: {
      seller_id: getDefaultSellerID(),
      mws_auth_token: marketplace.mws_auth_token || "",
      auto_sync: marketplace.auto_sync
    }
  })

  const handleSubmit = async (data: MarketplaceFormData) => {
    try {
      setSaving(true)
      
      // 변경된 값만 전송 
      const updateData: any = {}
      
      // Seller ID: 값이 있으면 DB에 저장 (환경변수와 같아도 명시적 저장)
      if (data.seller_id && data.seller_id.trim() !== "") {
        updateData.seller_id = data.seller_id.trim()
      }
      
      // MWS Auth Token: 변경된 경우에만 저장
      if (data.mws_auth_token !== (marketplace.mws_auth_token || "")) {
        updateData.mws_token = data.mws_auth_token
      }
      
      // Auto Sync: 변경된 경우에만 저장
      if (data.auto_sync !== marketplace.auto_sync) {
        updateData.auto_sync = data.auto_sync
      }
      
      // 변경사항이 있는 경우에만 API 호출
      if (Object.keys(updateData).length > 0) {
        updateData.is_active = marketplace.is_active // 현재 활성 상태 유지
        
        console.log('Submitting marketplace update:', updateData)
        
        const result = await amazonSyncClient.updateMarketplace(marketplace.id, updateData)
        
        console.log('Update result:', result)
        
        toast.success(`${marketplace.name} 설정이 업데이트되었습니다.`)
      } else {
        toast.info("변경사항이 없습니다.")
      }
      
      setOpen(false)
      onSave() // 부모 컴포넌트에서 목록 새로고침
    } catch (error) {
      console.error('Error updating marketplace:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`마켓플레이스 설정 업데이트에 실패했습니다: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    form.reset({
      seller_id: getDefaultSellerID(),
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
      
      <Drawer.Content aria-describedby="marketplace-config-description">
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <Drawer.Header>
              <Drawer.Title asChild>
                <div className="flex items-center gap-3">
                  <Heading className="capitalize">
                    Configure {marketplace.name}
                  </Heading>
                  <StatusBadge color={marketplace.is_active ? "green" : "grey"}>
                    {marketplace.is_active ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
              </Drawer.Title>
              <Drawer.Description asChild>
                <Text as="div" id="marketplace-config-description" className="text-medusa-fg-subtle">
                  Configure marketplace credentials and synchronization settings
                </Text>
              </Drawer.Description>
            </Drawer.Header>
            
            <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-6 overflow-y-auto">
              {/* Marketplace Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-medusa-bg-subtle rounded-lg">
                <div>
                  <Label size="small" weight="plus">Marketplace ID</Label>
                  <Text as="span" className="text-sm text-medusa-fg-muted">
                    {marketplace.marketplace_id}
                  </Text>
                </div>
                <div>
                  <Label size="small" weight="plus">Country</Label>
                  <Text as="span" className="text-sm text-medusa-fg-muted">
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
                  const envSellerID = getEnvSellerID()
                  
                  return (
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-x-1">
                        <Label size="small" weight="plus">
                          Seller ID
                        </Label>
                        <Text as="span" className="text-xs text-medusa-fg-subtle">*</Text>
                        {envSellerID && (
                          <Text as="span" className="text-xs text-blue-600">
                            (환경변수: {envSellerID.substring(0, 6)}...)
                          </Text>
                        )}
                      </div>
                      <Input 
                        {...field} 
                        placeholder={envSellerID ? `기본값: ${envSellerID}` : "예: A1XXXXXXXXXXXX"}
                        aria-invalid={!!fieldState.error}
                      />
                      {fieldState.error && (
                        <Text as="span" className="text-xs text-red-600">
                          {fieldState.error.message}
                        </Text>
                      )}
                      <Text as="div" className="text-xs text-medusa-fg-subtle">
                        {envSellerID 
                          ? "환경변수 기본값이 설정되어 있습니다. 다른 값을 입력하면 데이터베이스에 저장됩니다."
                          : "Amazon Seller Central에서 확인할 수 있는 셀러 ID를 입력하세요."
                        }
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
                  const [showToken, setShowToken] = useState(false)
                  const hasValue = field.value && field.value.length > 0
                  
                  return (
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-x-1">
                        <Label size="small" weight="plus">
                          MWS Auth Token
                        </Label>
                        <Text as="span" className="text-xs text-medusa-fg-subtle">(선택사항)</Text>
                      </div>
                      <div className="relative">
                        <Input 
                          {...field} 
                          placeholder="MWS 인증 토큰 (선택사항)"
                          type={showToken ? "text" : "password"}
                          aria-invalid={!!fieldState.error}
                          autoComplete="off"
                        />
                        {hasValue && (
                          <Button
                            type="button"
                            variant="transparent"
                            size="small"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                            onClick={() => setShowToken(!showToken)}
                          >
                            {showToken ? "🙈" : "👁️"}
                          </Button>
                        )}
                      </div>
                      {fieldState.error && (
                        <Text as="span" className="text-xs text-red-600">
                          {fieldState.error.message}
                        </Text>
                      )}
                      <Text as="div" className="text-xs text-medusa-fg-subtle">
                        Marketplace Web Service 인증 토큰입니다. 대부분의 경우 SP-API만으로 충분하므로 비워두셔도 됩니다.
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
                        <Text as="span" className="text-sm">
                          {field.value ? "자동 동기화 활성화됨" : "자동 동기화 비활성화됨"}
                        </Text>
                      </div>
                      <Text as="div" className="text-xs text-medusa-fg-subtle">
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
                  <Text as="div">1. Amazon Seller Central에서 Seller ID를 확인하세요</Text>
                  <Text as="div">2. SP-API 앱을 등록하고 필요한 권한을 요청하세요</Text>
                  <Text as="div">3. Seller ID를 입력하고 저장하여 데이터베이스에 영구 저장하세요</Text>
                  <Text as="div">4. 설정 저장 후 "Test Connection" 기능으로 연결을 확인하세요</Text>
                  <Text as="div">5. 마켓플레이스를 활성화하여 동기화를 시작하세요</Text>
                </div>
                {getEnvSellerID() && !marketplace.seller_id && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Text as="div" className="text-sm text-blue-700">
                      <strong>💡 팁:</strong> 현재 환경변수 기본값({getEnvSellerID().substring(0, 6)}...)을 사용하고 있습니다. 
                      위 필드에 동일한 값을 입력하고 저장하면 데이터베이스에 영구 저장됩니다.
                    </Text>
                  </div>
                )}
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