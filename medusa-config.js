const dotenv = require("dotenv");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {
  console.log("No .env file found, using system environment variables");
}

// CORS configuration for kbeauty.market
const ADMIN_CORS = 
  process.env.ADMIN_CORS || 
  "http://localhost:10001,http://localhost:3000";

const STORE_CORS = 
  process.env.STORE_CORS || 
  "http://localhost:10004,http://localhost:3000";

const DATABASE_URL = 
  process.env.DATABASE_URL || 
  "postgres://medusa:medusa@localhost:10002/kbeauty_market";

const REDIS_URL = 
  process.env.REDIS_URL || 
  "redis://localhost:10003";

const plugins = [
  `@medusajs/admin`,
  `@medusajs/cache-redis`,
  `@medusajs/event-bus-redis`,
  `@medusajs/file-local`,
  // Add more plugins as needed
];

/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig: {
    database_url: DATABASE_URL,
    database_type: "postgres",
    store_cors: STORE_CORS,
    admin_cors: ADMIN_CORS,
    redis_url: REDIS_URL,
    jwt_secret: process.env.JWT_SECRET || "your-super-secret-jwt-key",
    cookie_secret: process.env.COOKIE_SECRET || "your-super-secret-cookie-key",
    http: {
      storeCors: STORE_CORS,
      adminCors: ADMIN_CORS,
      authCors: ADMIN_CORS,
      jwtSecret: process.env.JWT_SECRET || "your-super-secret-jwt-key",
      cookieSecret: process.env.COOKIE_SECRET || "your-super-secret-cookie-key",
    },
  },
  admin: {
    path: process.env.ADMIN_PATH || "/admin",
    disable: process.env.NODE_ENV === "development" ? false : false,
  },
  plugins,
  modules: {
    cacheService: {
      resolve: "@medusajs/cache-redis",
      options: {
        redisUrl: REDIS_URL,
      },
    },
    eventBusService: {
      resolve: "@medusajs/event-bus-redis",
      options: {
        redisUrl: REDIS_URL,
      },
    },
    fileService: {
      resolve: "@medusajs/file-local",
      options: {
        upload_dir: "uploads",
      },
    },
  },
  featureFlags: {
    product_categories: true,
    sales_channels: true,
    publishable_api_keys: true,
    multi_warehouse: true,
  },
}; 