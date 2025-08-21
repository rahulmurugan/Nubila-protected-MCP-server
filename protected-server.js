#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { RadiusMcpSdk } from '@radiustechsystems/mcp-sdk';
import { z } from 'zod';
import { nubilaTools, TOKEN_REQUIREMENTS } from './tools/nubila-tools.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Radius MCP SDK - Using environment variables from Railway
const radius = new RadiusMcpSdk({
  contractAddress: process.env.RADIUS_CONTRACT_ADDRESS || '0x9f2B42FB651b75CC3db4ef9FEd913A22BA4629Cf',
  chainId: parseInt(process.env.RADIUS_CHAIN_ID) || 1223953,
  rpcUrl: process.env.RADIUS_RPC_URL || 'https://rpc.testnet.radiustech.xyz',
  cache: {
    ttl: 300,
    maxSize: 1000,
    disabled: false
  },
  debug: process.env.DEBUG === 'true'
});

// Create FastMCP server
const server = new FastMCP({
  name: 'evmauth-mcp-server',
  version: '1.0.0',
  description: 'Nubila MCP server protected with @radiustechsystems/mcp-sdk',
  // NOTE: Authentication handler is called BEFORE tools execute
  // We can't capture __evmauth here because it comes with tool calls
  // So we'll handle it differently in the tool execution
});

// Register all tools with appropriate protection
console.log('🚀 Starting Nubila MCP Server (Protected with SDK)');
console.log('🔐 Using @radiustechsystems/mcp-sdk package\n');
console.log('📝 Registering protected tools...\n');

Object.entries(nubilaTools).forEach(([toolName, tool]) => {
  const tokenId = TOKEN_REQUIREMENTS[toolName];
  
  // Create handler based on token requirement
  let execute;
  if (tokenId === 0) {
    // Free tier - no protection
    execute = async (args) => {
      const result = await tool.handler(args);
      // Wrap result in FastMCP expected format
      return {
        content: [{
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    };
    console.log(`✅ ${toolName} - FREE (no token required)`);
  } else {
    // Protected tiers - wrap with Radius MCP SDK
    const originalHandler = tool.handler;
    
    // Check for DEMO_MODE
    const DEMO_MODE = process.env.DEMO_MODE === 'true';
    
    execute = async (args) => {
      console.log(`\n🔍 [${toolName}] Incoming args:`, JSON.stringify(args, null, 2));
      
      // DEMO MODE: Bypass authentication entirely
      if (DEMO_MODE) {
        console.log(`🎮 [${toolName}] DEMO MODE ACTIVE - Bypassing authentication`);
        console.log(`✅ [${toolName}] Token ID ${tokenId} requirement bypassed for demo`);
        
        // Call the original handler directly with clean args
        const cleanArgs = { ...args };
        delete cleanArgs.__evmauth;
        
        const result = await originalHandler(cleanArgs);
        
        // In DEMO MODE, we need to wrap the result since we're bypassing the SDK
        return {
          content: [{
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        };
      }
      
      // PRODUCTION MODE: Normal authentication flow
      // Check if __evmauth is present
      if (args.__evmauth) {
        console.log(`✅ [${toolName}] __evmauth present in args`);
        try {
          const authProof = typeof args.__evmauth === 'string' ? JSON.parse(args.__evmauth) : args.__evmauth;
          console.log(`🔐 [${toolName}] Auth proof signature length:`, authProof.signature?.length);
        } catch (e) {
          console.log(`⚠️ [${toolName}] Failed to parse auth proof:`, e);
        }
      } else {
        console.log(`❌ [${toolName}] No __evmauth in args`);
      }
      
      // Create MCP request structure expected by Radius SDK
      const mcpRequest = {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };
      
      // Create the protected handler
      const protectedHandler = radius.protect(tokenId, async (request) => {
        // Extract args from the MCP request
        const toolArgs = request.params?.arguments || {};
        
        // Call the original handler with clean args (without __evmauth)
        const cleanArgs = { ...toolArgs };
        delete cleanArgs.__evmauth;
        
        const result = await originalHandler(cleanArgs);
        
        // Return the raw result - let FastMCP handle formatting
        return result;
      });
      
      try {
        // Call the protected handler with the MCP request
        const response = await protectedHandler(mcpRequest);
        
        // Return the SDK response directly (it's already in MCP format)
        return response;
      } catch (error) {
        console.error(`❌ [${toolName}] Error:`, error.message);
        throw error;
      }
    };
    console.log(`🔒 ${toolName} - Protected with Token ID ${tokenId}`);
  }
  
  // Add __evmauth to the tool's input schema for protected tools
  let parameters = tool.inputSchema;
  if (tokenId !== 0) {
    // For protected tools, ensure __evmauth is in the schema
    const schemaObj = parameters._def || parameters;
    if (schemaObj && schemaObj.shape && !schemaObj.shape.__evmauth) {
      // Clone the schema and add __evmauth
      parameters = tool.inputSchema.extend({
        __evmauth: z.any().optional().describe("Authentication proof (automatically provided)")
      });
    }
  }
  
  // Register the tool with the appropriate handler
  server.addTool({
    name: toolName,
    description: tokenId === 0 ? tool.description : `${tool.description} Requires EVMAuth Token #${tokenId}. IMPORTANT: Call this tool directly without checking wallet first! If you lack authentication, you'll receive clear error instructions. The auth flow is: 1) Call this directly, 2) Get error with required tokens, 3) Use authenticate_and_purchase, 4) Retry with proof.`,
    parameters: parameters,
    execute: execute
  });
});

// Start the server
async function main() {
  console.log('\n🌟 All tools registered with protection!');
  console.log('\n📊 Token Requirements:');
  console.log('  - Free (Token 0): ping');
  console.log('  - Basic (Token 1): getCurrentWeather, getWeatherForecast');
  console.log('  - Premium (Token 3): getWindAndPressure, searchCitiesByCountry');
  console.log('  - Pro (Token 5): getHealthCheck\n');
  
  // Check DEMO_MODE status
  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  
  // For local development - use stdio
  await server.start();
  console.log('✨ Protected Nubila MCP Server is running (stdio)');
  
  if (DEMO_MODE) {
    console.log('🎮 DEMO MODE: ACTIVE - Authentication bypassed for all protected tools');
    console.log('⚠️  WARNING: This mode is for demonstration only. Do not use in production!');
  } else {
    console.log('🔐 Radius MCP protection: Enabled');
    console.log('🔗 Contract:', process.env.RADIUS_CONTRACT_ADDRESS || '0x9f2B42FB651b75CC3db4ef9FEd913A22BA4629Cf');
    console.log('🔗 Chain ID:', process.env.RADIUS_CHAIN_ID || 1223953);
  }
}

main().catch((error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});