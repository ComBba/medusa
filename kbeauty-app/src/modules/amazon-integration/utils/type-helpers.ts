/**
 * Amazon 동기화 시스템용 타입 유틸리티 함수들
 * Medusa v2와의 호환성 및 안전한 타입 변환을 위한 헬퍼들
 */

import type { BigNumberValue } from '../types/index'

/**
 * BigNumberValue를 숫자로 안전하게 변환
 */
export function extractNumericValue(value: any): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value) || 0
  if (value && typeof value === 'object') {
    if ('numeric' in value) return value.numeric
    if ('amount' in value) return extractNumericValue(value.amount)
  }
  return 0
}

/**
 * 안전한 SKU 추출
 */
export function extractSku(variant: any): string {
  return variant.sku || `variant-${variant.id}` || 'unknown-sku'
}

/**
 * 안전한 가격 추출
 */
export function extractPrice(priceData: any): { amount: number, currency: string } {
  const amount = extractNumericValue(priceData?.amount || priceData)
  const currency = priceData?.currency_code || 'USD'
  
  return { amount, currency }
}

/**
 * 타입 안전 속성 접근
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  try {
    const keys = path.split('.')
    let current = obj
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return defaultValue
      }
    }
    
    return current !== undefined && current !== null ? current : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * 배열이 비어있지 않은지 안전하게 확인
 */
export function isNonEmptyArray(arr: any): arr is Array<any> {
  return Array.isArray(arr) && arr.length > 0
}

/**
 * 날짜 문자열을 안전하게 Date 객체로 변환
 */
export function safeParseDate(dateStr: any): Date | null {
  if (!dateStr) return null
  
  try {
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * null-safe 문자열 변환
 */
export function safeString(value: any): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * Amazon SP-API 호환 가격 데이터 생성
 */
export function createAmazonPriceFormat(price: number, currency: string = 'USD'): string {
  return price.toFixed(2)
}

/**
 * 에러 메시지 추출
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  if (error?.error?.message) return error.error.message
  return 'Unknown error occurred'
}

/**
 * Debug용 안전한 JSON 변환
 */
export function safeJsonStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return '[Circular or invalid object]'
  }
}