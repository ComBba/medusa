import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Table, Badge, Button, StatusBadge, toast } from "@medusajs/ui"
import { PlaySolid, DocumentText } from "@medusajs/icons"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/config"

type Workflow = {
  id: string
  name: string
  description: string
  category: string
  status: string
  last_executed: string | null
  execution_count: number
  input_schema: any
}

const WorkflowsPage = () => {
  const queryClient = useQueryClient()

  // 워크플로우 목록 조회
  const { data: workflowsData, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/workflows", {
        method: "GET",
        credentials: "include"
      })
      return response as { workflows: Workflow[], count: number }
    }
  })

  // 워크플로우 실행
  const executeWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, input, async }: { 
      workflowId: string
      input: any
      async?: boolean 
    }) => {
      const response = await sdk.client.fetch(`/admin/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          input,
          options: { async }
        })
      })
      return response
    },
    onSuccess: (_, variables) => {
      toast.success("워크플로우 실행 성공", {
        description: `${variables.workflowId} 워크플로우가 성공적으로 실행되었습니다.`
      })
      queryClient.invalidateQueries({ queryKey: ["workflows"] })
    },
    onError: (error: any) => {
      toast.error("워크플로우 실행 실패", {
        description: error.message || "워크플로우 실행 중 오류가 발생했습니다."
      })
    }
  })

  const handleExecuteWorkflow = (workflow: Workflow) => {
    // 간단한 테스트용 입력 데이터
    let testInput: any

    switch (workflow.id) {
      case "amazon-sync-enhanced":
        testInput = {
          product: { id: "prod_test" },
          marketplace_ids: ["ATVPDKIKX0DER"],
          options: {
            sync_images: true,
            include_variants: true,
            force_update: false
          }
        }
        break
      case "amazon-sync-all-enhanced":
        testInput = {
          product_id: "prod_test",
          marketplace_ids: ["ATVPDKIKX0DER"],
          options: {
            sync_product: true,
            sync_inventory: true,
            sync_price: true,
            force_update: false
          }
        }
        break
      default:
        testInput = {
          product: { id: "prod_test" },
          marketplace_ids: ["ATVPDKIKX0DER"]
        }
    }

    executeWorkflowMutation.mutate({
      workflowId: workflow.id,
      input: testInput,
      async: true
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <StatusBadge color="green">Active</StatusBadge>
      case "inactive":
        return <StatusBadge color="grey">Inactive</StatusBadge>
      case "error":
        return <StatusBadge color="red">Error</StatusBadge>
      default:
        return <StatusBadge color="grey">Unknown</StatusBadge>
    }
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Amazon Integration":
        return <Badge color="orange">Amazon</Badge>
      case "Core":
        return <Badge color="blue">Core</Badge>
      default:
        return <Badge color="grey">{category}</Badge>
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">워크플로우 관리</Heading>
          <Text className="text-medusa-fg-subtle">
            Amazon 통합 워크플로우를 관리하고 실행할 수 있습니다
          </Text>
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Text>워크플로우 목록을 불러오는 중...</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>워크플로우</Table.HeaderCell>
                <Table.HeaderCell>카테고리</Table.HeaderCell>
                <Table.HeaderCell>상태</Table.HeaderCell>
                <Table.HeaderCell>마지막 실행</Table.HeaderCell>
                <Table.HeaderCell>실행 횟수</Table.HeaderCell>
                <Table.HeaderCell className="text-right">액션</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {workflowsData?.workflows.map((workflow) => (
                <Table.Row key={workflow.id}>
                  <Table.Cell>
                    <div>
                      <Text weight="plus" size="small">
                        {workflow.name}
                      </Text>
                      <Text className="text-medusa-fg-subtle" size="xsmall">
                        {workflow.description}
                      </Text>
                      <Text className="text-medusa-fg-muted" size="xsmall">
                        ID: {workflow.id}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getCategoryBadge(workflow.category)}
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(workflow.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small">
                      {workflow.last_executed ? 
                        new Date(workflow.last_executed).toLocaleString() : 
                        "실행된 적 없음"
                      }
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small">{workflow.execution_count}회</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleExecuteWorkflow(workflow)}
                        isLoading={executeWorkflowMutation.isPending}
                        disabled={workflow.status !== "active"}
                      >
                        <PlaySolid className="w-4 h-4" />
                        실행 (테스트)
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "워크플로우",
  icon: DocumentText,
})

export default WorkflowsPage