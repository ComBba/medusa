import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import SystemInfo from "@modules/home/components/system-info"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: "🌸 KBeauty.Market - 한국 화장품 글로벌 마켓플레이스",
  description:
    "K-Beauty를 세계로! Amazon, Qoo10, Mercado Libre를 통해 50개 한국 화장품 브랜드와 연결하는 글로벌 마켓플레이스입니다.",
  keywords: "K-Beauty, 한국화장품, 글로벌마켓플레이스, Amazon, Qoo10, 화장품쇼핑몰",
  openGraph: {
    title: "🌸 KBeauty.Market - 한국 화장품 글로벌 마켓플레이스",
    description: "K-Beauty를 세계로! 50개 한국 화장품 브랜드와 연결하는 글로벌 마켓플레이스",
    type: "website",
  },
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
      {/* 시스템 정보 플로팅 버튼 */}
      <SystemInfo />
    </>
  )
}
