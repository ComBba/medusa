import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { Text, clx } from "@medusajs/ui"
import { formatToKST, formatDateSimple, formatRelativeTime } from "@lib/util/format-time"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MedusaCTA from "@modules/layout/components/medusa-cta"

export default async function Footer() {
  const { collections } = await listCollections({
    fields: "*products",
  })
  const productCategories = await listCategories()

  // 환경변수에서 빌드 정보 가져오기
  const gitInfo = {
    commitHash: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || 'unknown',
    commitMessage: process.env.NEXT_PUBLIC_GIT_COMMIT_MESSAGE || 'unknown',
    commitDate: process.env.NEXT_PUBLIC_GIT_COMMIT_DATE || 'unknown',
    branch: process.env.NEXT_PUBLIC_GIT_BRANCH || 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
    githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/ComBba/medusa'
  }

  return (
    <footer className="border-t border-ui-border-base w-full bg-gradient-to-r from-pink-50 to-purple-50">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-6 xsmall:flex-row items-start justify-between py-40">
          <div>
            <LocalizedClientLink
              href="/"
              className="txt-compact-xlarge-plus text-pink-600 hover:text-pink-700 uppercase font-bold"
            >
              🌸 KBeauty.Market
            </LocalizedClientLink>
            <p className="text-sm text-gray-600 mt-3 max-w-xs">
              한국 화장품을 세계로 연결하는<br />
              글로벌 마켓플레이스
            </p>
          </div>
          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base font-semibold">
                  카테고리
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category) {
                      return
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li
                        className="flex flex-col gap-2 text-ui-fg-subtle txt-small"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "hover:text-ui-fg-base",
                            children && "txt-small-plus"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-2">
                            {children &&
                              children.map((child) => (
                                <li key={child.id}>
                                  <LocalizedClientLink
                                    className="hover:text-ui-fg-base"
                                    href={`/categories/${child.handle}`}
                                    data-testid="category-link"
                                  >
                                    {child.name}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base font-semibold">
                  컬렉션
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-ui-fg-base"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base font-semibold">글로벌 마켓플레이스</span>
              <ul className="grid grid-cols-1 gap-y-2 text-ui-fg-subtle txt-small">
                <li>
                  <a
                    href="https://amazon.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ui-fg-base"
                  >
                    Amazon 연동
                  </a>
                </li>
                <li>
                  <a
                    href="https://qoo10.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ui-fg-base"
                  >
                    Qoo10 연동
                  </a>
                </li>
                <li>
                  <a
                    href="https://mercadolibre.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ui-fg-base"
                  >
                    Mercado Libre 연동
                  </a>
                </li>
                <li>
                  <LocalizedClientLink
                    className="hover:text-ui-fg-base"
                    href="/brands"
                  >
                    브랜드 입점 문의
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* 시스템 정보 및 Copyright 섹션 */}
        <div className="border-t border-ui-border-base pt-6 pb-16">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Copyright */}
            <div className="flex flex-col gap-1">
              <Text className="txt-compact-small font-medium">
                © {new Date().getFullYear()} KBeauty.Market. 한국 화장품 글로벌 마켓플레이스.
              </Text>
              <Text className="text-xs text-gray-500">
                Powered by Medusa.js | 🎯 Q4 2025 목표: 50개 K-Beauty 브랜드 연동
              </Text>
            </div>
            
            {/* 시스템 정보 */}
            <div className="flex flex-col gap-2 text-xs text-gray-500 lg:text-right">
              <div className="flex flex-col lg:items-end gap-1">
                <div className="flex items-center gap-2">
                  <span>🔗</span>
                  <a
                    href={`${gitInfo.githubUrl}/commit/${gitInfo.commitHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-pink-600 transition-colors font-mono"
                    title={gitInfo.commitMessage}
                  >
                    {gitInfo.commitHash}
                  </a>
                  <span>({gitInfo.branch})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span title="커밋 시간 (KST)">
                    커밋: {gitInfo.commitDate !== 'unknown' ? formatToKST(gitInfo.commitDate) : 'unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🚀</span>
                  <span title="배포 시간 (KST)">
                    배포: {gitInfo.buildTime !== 'unknown' ? formatToKST(gitInfo.buildTime) : 'unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🏠</span>
                  <a
                    href={gitInfo.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-pink-600 transition-colors"
                  >
                    GitHub Repository
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
