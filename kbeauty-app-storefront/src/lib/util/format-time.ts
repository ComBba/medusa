/**
 * 한국시간(KST)으로 시간을 포맷팅하는 유틸리티 함수들
 */

// 한국시간으로 날짜를 포맷팅
export function formatToKST(dateString: string): string {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date)
  } catch (error) {
    return 'Invalid Date'
  }
}

// 한국시간으로 현재 시간을 가져오기
export function getCurrentKST(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date())
}

// 간단한 날짜 포맷 (YYYY-MM-DD HH:mm)
export function formatDateSimple(dateString: string): string {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date).replace(/\./g, '-').replace(' ', ' ')
  } catch (error) {
    return 'Invalid Date'
  }
}

// 상대적 시간 표시 (예: "3분 전", "1시간 전")
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}초 전`
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}분 전`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours}시간 전`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days}일 전`
    }
  } catch (error) {
    return 'Invalid Date'
  }
} 