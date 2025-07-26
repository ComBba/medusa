import { Module } from "@medusajs/framework/utils"
import AmazonIntegrationModuleService from "./service"

export const AMAZON_INTEGRATION_MODULE = "amazon_integration"

export default Module(AMAZON_INTEGRATION_MODULE, {
  service: AmazonIntegrationModuleService,
}) 