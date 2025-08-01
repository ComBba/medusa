/**
 * Global type declarations for kbeauty-app
 */

// @medusajs/admin-sdk 타입 정의
declare module '@medusajs/admin-sdk' {
  export interface RouteConfig {
    label: string
    icon?: any
  }

  export function defineRouteConfig(config: RouteConfig): RouteConfig

  export interface WidgetConfig {
    [key: string]: any
  }

  export function defineWidgetConfig(config: WidgetConfig): WidgetConfig
}

// 추가 타입 정의가 필요하면 여기에 추가