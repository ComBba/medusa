# 🔄 Amazon Integration Workflows

K-Beauty 프로젝트의 Amazon SP-API 통합을 위한 워크플로우 모음입니다.

Medusa 2.0의 워크플로우 시스템을 활용하여 복잡한 Amazon 동기화 작업을 단계별로 처리합니다.

## 📋 워크플로우 목록

### 🛍 상품 동기화
| 워크플로우 | 파일 | 설명 |
|-----------|------|------|
| **상품 동기화** | `amazon-sync-product.ts` | Medusa 상품을 Amazon 마켓플레이스에 동기화 |
| **향상된 상품 동기화** | `amazon-sync-enhanced.ts` | 이미지, 카테고리 등 확장 정보 포함 동기화 |
| **전체 상품 동기화** | `amazon-sync-all-enhanced.ts` | 모든 상품 일괄 동기화 |

### 💰 가격 동기화
| 워크플로우 | 파일 | 설명 |
|-----------|------|------|
| **가격 동기화** | `amazon-sync-price.ts` | Amazon 마켓플레이스 가격 동기화 |

### 📦 재고 동기화
| 워크플로우 | 파일 | 설명 |
|-----------|------|------|
| **재고 동기화** | `amazon-sync-inventory.ts` | Amazon 마켓플레이스 재고 동기화 |

## 🔄 주요 워크플로우 상세

### 1. Amazon 상품 동기화 워크플로우

```ts
import { amazonSyncProductWorkflow } from "./amazon-sync-product"

// 단일 상품 동기화
const { result } = await amazonSyncProductWorkflow(container).run({
  input: {
    product: productData,
    marketplace_ids: ["ATVPDKIKX0DER"], // 선택적
    options: {
      sync_images: true,
      include_variants: true,
      force_update: false
    }
  }
})
```

**주요 단계:**
1. **Sync Record 생성**: Amazon 동기화 레코드 생성
2. **상품 매핑**: Medusa 상품을 Amazon 형식으로 변환
3. **이미지 처리**: 상품 이미지 업로드 및 연결
4. **SP-API 업로드**: Amazon SP-API를 통한 상품 업로드
5. **상태 업데이트**: 동기화 결과 및 상태 업데이트

### 2. Amazon 가격 동기화 워크플로우

```ts
import { amazonSyncPriceWorkflow } from "./amazon-sync-price"

// 가격 동기화
const { result } = await amazonSyncPriceWorkflow(container).run({
  input: {
    product_id: "prod_123",
    marketplace_ids: ["ATVPDKIKX0DER"],
    pricing_strategy: "competitive" // "standard", "competitive", "premium"
  }
})
```

**주요 단계:**
1. **가격 정책 적용**: 마켓플레이스별 가격 정책 적용
2. **경쟁사 분석**: 경쟁 상품 가격 분석 (선택적)
3. **가격 계산**: 최종 판매 가격 계산
4. **SP-API 업데이트**: Amazon 가격 정보 업데이트
5. **이력 저장**: 가격 변경 이력 저장

### 3. Amazon 재고 동기화 워크플로우

```ts
import { amazonSyncInventoryWorkflow } from "./amazon-sync-inventory"

// 재고 동기화
const { result } = await amazonSyncInventoryWorkflow(container).run({
  input: {
    inventory_items: inventoryData,
    marketplace_ids: ["ATVPDKIKX0DER"],
    options: {
      reserve_quantity: 5, // 안전 재고
      sync_fulfillment: true
    }
  }
})
```

**주요 단계:**
1. **재고 조회**: Medusa 재고 정보 조회
2. **안전 재고 계산**: 마켓플레이스별 안전 재고 적용
3. **Fulfillment 설정**: 배송 옵션 및 창고 정보 설정
4. **SP-API 업데이트**: Amazon 재고 정보 업데이트
5. **동기화 로그**: 재고 변경 로그 저장

## 🔧 워크플로우 실행 방법

### 1. API 라우트에서 실행

```ts
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { amazonSyncProductWorkflow } from "../../../workflows/amazon-sync-product"

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const { product_id, marketplace_ids } = req.body

  const productService = req.scope.resolve("product")
  const product = await productService.retrieveProduct(product_id)

  const { result } = await amazonSyncProductWorkflow(req.scope).run({
    input: {
      product,
      marketplace_ids,
      options: {
        sync_images: true,
        include_variants: true
      }
    }
  })

  res.json({ success: true, result })
}
```

### 2. 구독자(Subscriber)에서 실행

```ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { amazonSyncProductWorkflow } from "../workflows/amazon-sync-product"

export default async function productSyncSubscriber({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productService = container.resolve("product")
  const product = await productService.retrieveProduct(data.id)

  await amazonSyncProductWorkflow(container).run({
    input: {
      product,
      options: {
        sync_images: true,
        include_variants: true
      }
    }
  })
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
```

### 3. 스케줄링된 작업에서 실행

```ts
import { MedusaContainer } from "@medusajs/framework/types"
import { amazonSyncAllEnhancedWorkflow } from "../workflows/amazon-sync-all-enhanced"

export default async function scheduledSync(container: MedusaContainer) {
  await amazonSyncAllEnhancedWorkflow(container).run({
    input: {
      batch_size: 50,
      marketplace_ids: ["ATVPDKIKX0DER"],
      options: {
        sync_images: true,
        include_variants: true
      }
    }
  })
}

export const config = {
  name: "amazon-sync-daily",
  schedule: "0 2 * * *", // 매일 새벽 2시
}
```

## 🔍 워크플로우 실행 후크

### Hooks 폴더 구조
- `hooks/useProductSync.ts`: 상품 동기화 훅
- `hooks/usePriceSync.ts`: 가격 동기화 훅
- `hooks/useInventorySync.ts`: 재고 동기화 훅

### Admin UI에서 사용 예시

```tsx
import { useProductSync } from "../hooks/useProductSync"

export const ProductSyncButton = ({ productId }) => {
  const { syncProduct, loading, error } = useProductSync()

  const handleSync = async () => {
    await syncProduct({
      product_id: productId,
      marketplace_ids: ["ATVPDKIKX0DER"],
      options: { sync_images: true }
    })
  }

  return (
    <Button onClick={handleSync} loading={loading}>
      Amazon 동기화
    </Button>
  )
}
```

## ⚠️ 주의사항

1. **Rate Limiting**: Amazon SP-API 호출 제한 준수
2. **에러 처리**: 각 단계별 에러 처리 및 보상 작업 구현
3. **트랜잭션**: 데이터 일관성을 위한 트랜잭션 관리
4. **로깅**: 상세한 실행 로그 및 모니터링
5. **테스트**: 샌드박스 환경에서 충분한 테스트 수행

## 🔗 관련 문서

- [Medusa 워크플로우 가이드](https://docs.medusajs.com/learn/fundamentals/workflows)
- [Amazon 통합 가이드](../../README.Amazon-Integration-Guide.md)
- [워크플로우 훅 사용법](./hooks/README.md)
