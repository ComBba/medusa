import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { amazonSyncProductWorkflow } from "../../../../../workflows/amazon-sync-product"
import { amazonSyncInventoryWorkflow } from "../../../../../workflows/amazon-sync-inventory" 
import { amazonSyncPriceWorkflow } from "../../../../../workflows/amazon-sync-price"
import { amazonSyncEnhancedWorkflow } from "../../../../../workflows/amazon-sync-enhanced"
import { amazonSyncAllEnhancedWorkflow } from "../../../../../workflows/amazon-sync-all-enhanced"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/workflows/[id]/execute
 * 워크플로우 실행
 */
export const POST = async (
  req: MedusaRequest<{
    input: any
    options?: {
      async?: boolean
    }
  }>,
  res: MedusaResponse
) => {
  try {
    const workflowId = req.params.id
    const { input, options = {} } = req.body

    if (!workflowId) {
      return res.status(400).json({
        message: "워크플로우 ID가 필요합니다"
      })
    }

    if (!input) {
      return res.status(400).json({
        message: "워크플로우 입력 데이터가 필요합니다"
      })
    }

    let workflow
    let workflowInput = input

    // 워크플로우 ID에 따라 해당 워크플로우 선택
    switch (workflowId) {
      case "amazon-sync-product":
        workflow = amazonSyncProductWorkflow
        break
      case "amazon-sync-inventory":
        workflow = amazonSyncInventoryWorkflow
        break
      case "amazon-sync-price":
        workflow = amazonSyncPriceWorkflow
        break
      case "amazon-sync-enhanced":
        workflow = amazonSyncEnhancedWorkflow
        break
      case "amazon-sync-all-enhanced":
        workflow = amazonSyncAllEnhancedWorkflow
        break
      default:
        return res.status(404).json({
          message: `워크플로우를 찾을 수 없습니다: ${workflowId}`
        })
    }

    // 워크플로우 실행
    const startTime = Date.now()
    
    if (options.async) {
      // 비동기 실행
      workflow(req.scope).run({ input: workflowInput })
        .catch(error => {
          console.error(`워크플로우 ${workflowId} 실행 실패:`, error)
        })
      
      res.json({
        message: "워크플로우가 백그라운드에서 실행되었습니다",
        workflow_id: workflowId,
        execution_id: `exec_${Date.now()}`,
        status: "running"
      })
    } else {
      // 동기 실행
      const { result, error } = await workflow(req.scope).run({ 
        input: workflowInput 
      })
      
      const endTime = Date.now()
      const executionTime = endTime - startTime

      if (error) {
        res.status(500).json({
          message: "워크플로우 실행 중 오류 발생",
          workflow_id: workflowId,
          error: error.message,
          execution_time: executionTime
        })
      } else {
        res.json({
          message: "워크플로우가 성공적으로 실행되었습니다",
          workflow_id: workflowId,
          result,
          execution_time: executionTime,
          status: "completed"
        })
      }
    }

  } catch (error) {
    res.status(500).json({
      message: "워크플로우 실행 중 오류 발생",
      error: error.message
    })
  }
}