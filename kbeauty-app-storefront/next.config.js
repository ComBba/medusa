const checkEnvVariables = require("./check-env-variables")
const { execSync } = require('child_process')

checkEnvVariables()

// 빌드 시점의 Git 정보 수집
function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse HEAD').toString().trim().substring(0, 7)
    const commitMessage = execSync('git log -1 --pretty=%s').toString().trim()
    const commitDate = execSync('git log -1 --pretty=%ci').toString().trim()
    const branch = execSync('git branch --show-current').toString().trim()
    const buildTime = new Date().toISOString()
    
    return {
      NEXT_PUBLIC_GIT_COMMIT_HASH: commitHash,
      NEXT_PUBLIC_GIT_COMMIT_MESSAGE: commitMessage,
      NEXT_PUBLIC_GIT_COMMIT_DATE: commitDate,
      NEXT_PUBLIC_GIT_BRANCH: branch,
      NEXT_PUBLIC_BUILD_TIME: buildTime,
      NEXT_PUBLIC_GITHUB_URL: 'https://github.com/ComBba/medusa'
    }
  } catch (error) {
    console.warn('Git 정보를 가져올 수 없습니다:', error.message)
    return {
      NEXT_PUBLIC_GIT_COMMIT_HASH: 'unknown',
      NEXT_PUBLIC_GIT_COMMIT_MESSAGE: 'unknown',
      NEXT_PUBLIC_GIT_COMMIT_DATE: 'unknown',
      NEXT_PUBLIC_GIT_BRANCH: 'unknown',
      NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
      NEXT_PUBLIC_GITHUB_URL: 'https://github.com/ComBba/medusa'
    }
  }
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
    ],
  },
  env: {
    ...getGitInfo(),
  },
}

module.exports = nextConfig
