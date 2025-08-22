#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { RadiusMcpSdk } from '@radiustechsystems/mcp-sdk';
import { z } from 'zod';
import { nubilaTools, TOKEN_REQUIREMENTS } from './tools/nubila-tools.js';
import dotenv from 'dotenv';
import { logToFile } from './logger.js';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({path: dotenv.config({path: `${path.dirname(fileURLToPath(import.meta.url))}/.env`})});
process.env.LOG_TO_CONSOLE = false;


// Environment configuration
const EVMAUTH_CONTRACT_ADDRESS = process.env.RADIUS_CONTRACT_ADDRESS || "0x9f2B42FB651b75CC3db4ef9FEd913A22BA4629Cf";
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Initialize the Radius MCP SDK
const radius = new RadiusMcpSdk({
  contractAddress: EVMAUTH_CONTRACT_ADDRESS,
  debug: process.env.DEBUG === 'true'
});

// Create MCP server
const server = new FastMCP({
  name: 'evmauth-mcp-server',
  version: '1.0.0'
});

// Register all tools
logToFile('🚀 Starting Nubila MCP Server (Protected with SDK)');
logToFile('🔐 Using @radiustechsystems/mcp-sdk package\n');
logToFile('📝 Registering protected tools...\n');

Object.entries(nubilaTools).forEach(([toolName, tool]) => {
  const tokenId = TOKEN_REQUIREMENTS[toolName];
  
  // Create the authentication wrapper for each tool
  const authenticatedHandler = async (args) => {
    logToFile(`\n🔍 [${toolName}] Incoming args: ${JSON.stringify(args, null, 2)}`);
    
    // DEMO MODE: Bypass authentication
    if (DEMO_MODE) {
      logToFile(`🎮 [${toolName}] DEMO MODE ACTIVE - Bypassing authentication`);
      logToFile(`✅ [${toolName}] Token ID ${tokenId} requirement bypassed for demo`);
      
      // Call the tool handler directly
      const result = await tool.handler(args);
      
      // Return in MCP format
      return {
        content: [{
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    }
    
    // Free tier - no protection needed
    if (tokenId === 0) {
      const result = await tool.handler(args);
      return {
        content: [{
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    }
    
    // Protected tier - use Radius SDK
    // Check if __evmauth is present
    if (args.__evmauth) {
      logToFile(`✅ [${toolName}] __evmauth present in args`);
      try {
        const authProof = typeof args.__evmauth === 'string' ? JSON.parse(args.__evmauth) : args.__evmauth;
        logToFile(`🔐 [${toolName}] Auth proof signature length: ${authProof.signature?.length}`);
      } catch (e) {
        logToFile(`⚠️ [${toolName}] Failed to parse auth proof: ${e}`);
      }
    } else {
      logToFile(`❌ [${toolName}] No __evmauth in args`);
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
      
      const result = await tool.handler(cleanArgs);
      
      // Return in MCP format
      return {
        content: [{
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    });
    
    try {
      // Call the protected handler with the MCP request
      const response = await protectedHandler(mcpRequest);
      // Handle the response
      if (response && typeof response === 'object') {
        if ('content' in response && Array.isArray(response.content)) {
          // Check if this is an error response from Radius
          const firstContent = response.content[0];
          if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
            try {
              // Try to parse as JSON error
              const parsed = JSON.parse(firstContent.text);
              if (parsed.error) {
                // This is a Radius error - throw it properly so Claude gets the full error info
                throw new Error(firstContent.text);
              }
              return response;
            } catch (e) {
              // Not JSON, it's the actual text
              return response;
            }
          }
        } else if ('error' in response && response.error) {
          // Error - throw with proper message
          const error = response.error;
          throw new Error(error.message || 'Authentication failed');
        }
      }
      return response;
    } catch (error) {
      logToFile(`❌ [${toolName}] Error: ${error.message}`);
      throw error;
    }
  };
  
  // Create parameters schema with __evmauth for protected tools
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
  
  // Register the tool
  server.addTool({
    name: toolName,
    description: tokenId === 0 ? tool.description : `${tool.description} Requires EVMAuth Token #${tokenId}. IMPORTANT: Call this tool directly without checking wallet first! If you lack authentication, you'll receive clear error instructions. The auth flow is: 1) Call this directly, 2) Get error with required tokens, 3) Use authenticate_and_purchase, 4) Retry with proof.`,
    parameters: parameters,
    execute: authenticatedHandler
  });
  
  if (tokenId === 0) {
    logToFile(`✅ ${toolName} - FREE (no token required)`);
  } else {
    logToFile(`🔒 ${toolName} - Protected with Token ID ${tokenId}`);
  }
});

// Start the server
async function main() {
  logToFile('\n🌟 All tools registered with protection!');
  logToFile('\n📊 Token Requirements:');
  logToFile('  - Free (Token 0): ping');
  logToFile('  - Basic (Token 1): getCurrentWeather, getWeatherForecast');
  logToFile('  - Premium (Token 3): getWindAndPressure, searchCitiesByCountry');
  logToFile('  - Pro (Token 5): getHealthCheck\n');
  
  // Check DEMO_MODE status
  if (DEMO_MODE) {
    logToFile('🎮 DEMO MODE: ACTIVE - Authentication bypassed for all protected tools');
    logToFile('⚠️  WARNING: This mode is for demonstration only. Do not use in production!');
  } else {
    logToFile('🔐 Radius MCP protection: Enabled');
    logToFile(`🔗 Contract: ${EVMAUTH_CONTRACT_ADDRESS}`);
  }
  
  // For local development - use stdio
  await server.start();
  logToFile('✨ Protected Nubila MCP Server is running (stdio)');
}

main().catch((error) => {
  logToFile(`❌ Server failed to start: ${error}`);
  process.exit(1);
});