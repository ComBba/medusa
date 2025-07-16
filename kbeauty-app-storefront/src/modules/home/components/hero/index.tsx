import { Github, Heart, Sparkles } from "@medusajs/icons"
import { Button, Heading } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-8">
        <div className="flex items-center gap-3 text-pink-500 mb-4">
          <Sparkles className="w-8 h-8" />
          <span className="text-sm font-medium tracking-wide uppercase">K-Beauty Global</span>
          <Sparkles className="w-8 h-8" />
        </div>
        
        <span>
          <Heading
            level="h1"
            className="text-5xl leading-tight text-gray-800 font-bold mb-4"
          >
            🌸 KBeauty.Market
          </Heading>
          <Heading
            level="h2"
            className="text-2xl leading-relaxed text-gray-600 font-normal max-w-4xl mx-auto"
          >
            한국 화장품을 세계로 연결하는 글로벌 마켓플레이스
          </Heading>
          <p className="text-lg text-gray-500 mt-4 max-w-3xl mx-auto">
            Amazon, Qoo10, Mercado Libre를 통해 50개 K-Beauty 브랜드와 함께합니다
          </p>
        </span>
        
        <div className="flex gap-4 mt-6">
          <LocalizedClientLink href="/store">
            <Button variant="primary" size="large" className="bg-pink-500 hover:bg-pink-600">
              <Heart className="w-5 h-5 mr-2" />
              K-Beauty 쇼핑하기
            </Button>
          </LocalizedClientLink>
          <Button variant="secondary" size="large">
            브랜드 입점 문의
          </Button>
        </div>
        
        <div className="flex items-center gap-8 mt-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            50+ K-Beauty 브랜드
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            글로벌 마켓플레이스 연동
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
            실시간 주문 관리
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
