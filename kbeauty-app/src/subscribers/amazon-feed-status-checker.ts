import {
  type SubscriberConfig,
  type SubscriberArgs,
} from "@medusajs/framework"
import { AMAZON_INTEGRATION_MODULE } from "../modules/amazon-integration"
import AmazonIntegrationModuleService from "../modules/amazon-integration/service"
import { AmazonSPAPIClient } from "../modules/amazon-integration/services/sp-api-client"

/**
 * Amazon Feed 처리 상태 확인 구독자
 * 
 * 'processing' 상태의 동기화 레코드들을 주기적으로 확인하여
 * Amazon에서의 처리 상태를 업데이트합니다.
 */
export default async function amazonFeedStatusChecker({
  event,
  container,
}: SubscriberArgs<{ feed_submission_id: string; sync_record_id: string }>) {
  
  const amazonService: AmazonIntegrationModuleService = container.resolve(AMAZON_INTEGRATION_MODULE)
  
  const { feed_submission_id, sync_record_id } = event.data
  
  try {
    // 동기화 레코드 조회
    const syncRecord = await amazonService.retrieveAmazonProductSync(sync_record_id)
    
    if (!syncRecord || syncRecord.sync_status !== "processing") {
      return // 이미 처리 완료되었거나 처리 중이 아닌 경우 스킯
    }
    
    // 마켓플레이스 정보 조회
    const marketplace = await amazonService.retrieveAmazonMarketplace(
      syncRecord.amazon_marketplace_id
    )
    
    // Amazon SP-API 클라이언트 생성
    const apiClient = new AmazonSPAPIClient({
      region: marketplace.region,
      credentials: {
        seller_id: marketplace.seller_id,
        marketplace_id: marketplace.marketplace_id,
        // TODO: 실제 인증 정보 구성 필요
      },
      sandbox: process.env.NODE_ENV !== 'production'
    })
    
    // Feed 상태 확인
    const feedStatusResponse = await apiClient.getFeedStatus(feed_submission_id)
    
    if (!feedStatusResponse.success) {
      console.error(`Feed 상태 확인 실패: ${feedStatusResponse.error?.message}`)
      return
    }
    
    const feedData = feedStatusResponse.data
    const processingStatus = feedData.processingStatus
    
    // Feed 처리 상태에 따른 동기화 레코드 업데이트
    switch (processingStatus) {
      case 'DONE':
        // 처리 완료 - 결과 확인 필요
        if (feedData.processingReport?.summary?.messagesProcessed > 0 && 
            feedData.processingReport?.summary?.messagesWithError === 0) {
          // 성공
          await amazonService.updateAmazonProductSyncs([sync_record_id], {
            sync_status: "completed",
            processing_status: processingStatus,
            last_sync_at: new Date(),
          })
          
          console.log(`✅ Amazon Feed 처리 완료: ${feed_submission_id}`)
        } else {
          // 에러 발생
          await amazonService.updateAmazonProductSyncs([sync_record_id], {
            sync_status: "failed",
            processing_status: processingStatus,
            error_message: "Feed processing completed with errors",
            error_code: "FEED_PROCESSING_ERROR"
          })
          
          console.error(`❌ Amazon Feed 처리 중 에러: ${feed_submission_id}`)
        }
        break
        
      case 'CANCELLED':
        await amazonService.updateAmazonProductSyncs([sync_record_id], {
          sync_status: "cancelled",
          processing_status: processingStatus,
        })
        
        console.warn(`⚠️ Amazon Feed 처리 취소됨: ${feed_submission_id}`)
        break
        
      case 'FATAL':
        await amazonService.updateAmazonProductSyncs([sync_record_id], {
          sync_status: "failed", 
          processing_status: processingStatus,
          error_message: "Feed processing failed with fatal error",
          error_code: "FEED_FATAL_ERROR"
        })
        
        console.error(`💀 Amazon Feed 치명적 오류: ${feed_submission_id}`)
        break
        
      case 'IN_PROGRESS':
      case 'IN_QUEUE':
      default:
        // 아직 처리 중 - 상태만 업데이트
        await amazonService.updateAmazonProductSyncs([sync_record_id], {
          processing_status: processingStatus,
        })
        
        console.log(`⏳ Amazon Feed 처리 중: ${feed_submission_id} (${processingStatus})`)
        break
    }
    
  } catch (error) {
    console.error(`Amazon Feed 상태 확인 중 오류:`, error)
    
    // 에러 카운트 증가
    const syncRecord = await amazonService.retrieveAmazonProductSync(sync_record_id)
    const newAttempts = (syncRecord?.sync_attempts || 0) + 1
    
    if (newAttempts >= (syncRecord?.max_attempts || 3)) {
      // 최대 재시도 횟수 초과 시 실패 처리
      await amazonService.updateAmazonProductSyncs([sync_record_id], {
        sync_status: "failed",
        sync_attempts: newAttempts,
        error_message: error.message,
        error_code: "MAX_ATTEMPTS_EXCEEDED"
      })
    } else {
      // 재시도 가능 시 시도 횟수만 증가
      await amazonService.updateAmazonProductSyncs([sync_record_id], {
        sync_attempts: newAttempts,
      })
    }
  }
}

// 구독자 설정
export const config: SubscriberConfig = {
  event: "amazon.feed.status.check",
} 