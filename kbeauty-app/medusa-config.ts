import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS || "https://admin.kbeauty.market,http://admin.kbeauty.market,https://api.kbeauty.market,http://localhost:10000,http://localhost:9000",
      adminCors: process.env.ADMIN_CORS || "https://admin.kbeauty.market,http://admin.kbeauty.market,https://api.kbeauty.market,http://localhost:10000,http://localhost:9000",
      authCors: process.env.AUTH_CORS || "https://admin.kbeauty.market,http://admin.kbeauty.market,https://api.kbeauty.market,http://localhost:10000,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
    admin: {
    path: "/app",
    disable: false,
    vite: () => {
      return {
        server: {
          host: true,
          allowedHosts: ["localhost", "127.0.0.1", "admin.kbeauty.market"]
        },
        optimizeDeps: {
          include: [
            "@medusajs/admin-sdk",
            "@medusajs/ui", 
            "@medusajs/framework/types",
            "@medusajs/dashboard"
          ],
          exclude: ["@medusajs/js-sdk"]
        },
        build: {
          rollupOptions: {
            external: ["@medusajs/js-sdk"]
          }
        }
      }
    }
  },
  modules: {
    "amazon_integration": {
      resolve: "./src/modules/amazon-integration",
      options: {
        // Amazon SP-API 설정
        lwaClientId: process.env.AMAZON_LWA_CLIENT_ID,
        lwaClientSecret: process.env.AMAZON_LWA_CLIENT_SECRET,
        refreshToken: process.env.AMAZON_LWA_REFRESH_TOKEN,
        awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
        awsRegion: process.env.AMAZON_AWS_REGION || 'us-east-1',
        spApiRegion: process.env.AMAZON_SP_API_REGION || 'na',
        sellerId: process.env.AMAZON_SELLER_ID,
        sandbox: process.env.AMAZON_SP_API_SANDBOX === 'true',
        
        // 마켓플레이스 설정
        marketplaceIds: process.env.AMAZON_MARKETPLACE_IDS?.split(',') || ['ATVPDKIKX0DER'],
        marketplaceConfig: process.env.AMAZON_MARKETPLACE_CONFIG ? JSON.parse(process.env.AMAZON_MARKETPLACE_CONFIG) : {},
        
        // 모듈 설정
        enabled: process.env.AMAZON_INTEGRATION_ENABLED === 'true',
        autoSyncEnabled: process.env.AMAZON_AUTO_SYNC_ENABLED === 'true',
        syncIntervalMinutes: parseInt(process.env.AMAZON_SYNC_INTERVAL_MINUTES || '30'),
        maxRetryAttempts: parseInt(process.env.AMAZON_MAX_RETRY_ATTEMPTS || '3'),
        rateLimitPerSecond: parseInt(process.env.AMAZON_RATE_LIMIT_PER_SECOND || '10'),
      }
    }
  }
})
