"use client"

import { useState } from "react"
import { formatToKST } from "@lib/util/format-time"
import { Github, Clock } from "@medusajs/icons"

const SystemInfo = () => {
  const [isExpanded, setIsExpanded] = useState(false)

  // 환경변수에서 빌드 정보 가져오기
  const gitInfo = {
    commitHash: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || 'unknown',
    commitMessage: process.env.NEXT_PUBLIC_GIT_COMMIT_MESSAGE || 'unknown',
    commitDate: process.env.NEXT_PUBLIC_GIT_COMMIT_DATE || 'unknown',
    branch: process.env.NEXT_PUBLIC_GIT_BRANCH || 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
    githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/ComBba/medusa'
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-pink-500 hover:bg-pink-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          title="시스템 정보 보기"
        >
          <span className="text-lg">⚙️</span>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span>⚙️</span>
            시스템 정보
          </h3>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Github className="w-3 h-3" />
            <a
              href={`${gitInfo.githubUrl}/commit/${gitInfo.commitHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-pink-600 transition-colors"
              title={gitInfo.commitMessage}
            >
              {gitInfo.commitHash}
            </a>
            <span className="text-gray-400">({gitInfo.branch})</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>커밋: {gitInfo.commitDate !== 'unknown' ? formatToKST(gitInfo.commitDate) : 'unknown'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span>🚀</span>
            <span>배포: {gitInfo.buildTime !== 'unknown' ? formatToKST(gitInfo.buildTime) : 'unknown'}</span>
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Github className="w-3 h-3" />
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
  )
}

export default SystemInfo 