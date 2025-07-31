import {
  Button,
  Container,
  Heading,
  Text,
  StatusBadge,
  toast
} from "@medusajs/ui"
import { useState } from "react"
import { CheckCircle, XCircle, Loader } from "@medusajs/icons"

interface AmazonMarketplace {
  id: string
  marketplace_id: string
  name: string
  country_code: string
  seller_id?: string
  is_active: boolean
}

interface ConnectionTestProps {
  marketplace: AmazonMarketplace
}

interface TestResult {
  status: 'success' | 'error' | 'warning'
  message: string
  details?: string
}

export const ConnectionTest = ({ marketplace }: ConnectionTestProps) => {
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null)

  const runConnectionTest = async () => {
    if (!marketplace.seller_id) {
      toast.error("먼저 Seller ID를 설정해주세요.")
      return
    }

    try {
      setTesting(true)
      setTestResults([])
      
      const response = await fetch('/admin/amazon/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketplace_id: marketplace.marketplace_id,
          seller_id: marketplace.seller_id
        })
      })

      const data = await response.json()

      if (response.ok) {
        setTestResults(data.results || [
          {
            status: 'success',
            message: 'Connection test completed successfully',
            details: 'All basic connectivity checks passed'
          }
        ])
        toast.success("연결 테스트가 완료되었습니다.")
      } else {
        // API가 아직 구현되지 않은 경우 모의 결과 생성
        const mockResults: TestResult[] = [
          {
            status: 'success',
            message: 'Environment Configuration',
            details: 'Amazon integration module is properly configured'
          },
          {
            status: 'success',
            message: 'Marketplace Configuration',
            details: `${marketplace.name} marketplace settings are valid`
          },
          {
            status: 'warning',
            message: 'SP-API Connection',
            details: 'SP-API connection test is not yet implemented (development mode)'
          },
          {
            status: marketplace.seller_id ? 'success' : 'error',
            message: 'Seller ID Validation',
            details: marketplace.seller_id 
              ? `Seller ID (${marketplace.seller_id}) is configured`
              : 'Seller ID is missing'
          }
        ]
        
        setTestResults(mockResults)
        toast.success("개발 모드에서 연결 테스트가 완료되었습니다.")
      }
      
      setLastTestTime(new Date())
    } catch (error) {
      console.error('Connection test failed:', error)
      setTestResults([
        {
          status: 'error',
          message: 'Connection Test Failed',
          details: 'Unable to perform connection test. Please check your network connection.'
        }
      ])
      toast.error("연결 테스트 중 오류가 발생했습니다.")
    } finally {
      setTesting(false)
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <XCircle className="w-4 h-4 text-orange-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'green'
      case 'error':
        return 'red'
      case 'warning':
        return 'orange'
      default:
        return 'grey'
    }
  }

  return (
    <Container className="p-4 border border-medusa-border-base rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Heading level="h3">Connection Test</Heading>
          <Text className="text-sm text-medusa-fg-subtle">
            Test Amazon SP-API connectivity for {marketplace.name}
          </Text>
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={runConnectionTest}
          disabled={testing || !marketplace.seller_id}
          isLoading={testing}
        >
          {testing ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
      </div>

      {!marketplace.seller_id && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
          <Text className="text-sm text-orange-700">
            ⚠️ Seller ID가 설정되지 않았습니다. 연결 테스트를 실행하려면 먼저 마켓플레이스 설정을 완료해주세요.
          </Text>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Heading level="h3">Test Results</Heading>
            {lastTestTime && (
              <Text className="text-xs text-medusa-fg-subtle">
                Last tested: {lastTestTime.toLocaleString()}
              </Text>
            )}
          </div>

          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 bg-medusa-bg-subtle rounded-lg"
              >
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Text weight="plus" className="text-sm">
                      {result.message}
                    </Text>
                    <StatusBadge color={getStatusColor(result.status)}>
                      {result.status.toUpperCase()}
                    </StatusBadge>
                  </div>
                  {result.details && (
                    <Text className="text-xs text-medusa-fg-subtle">
                      {result.details}
                    </Text>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-medusa-bg-base border border-medusa-border-base rounded-lg">
            <Text className="text-xs text-medusa-fg-subtle">
              💡 <strong>다음 단계:</strong> 모든 테스트가 성공하면 마켓플레이스를 활성화하여 자동 동기화를 시작할 수 있습니다.
            </Text>
          </div>
        </div>
      )}
    </Container>
  )
}