/**
 * Type declarations for @medusajs/admin-sdk
 */
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