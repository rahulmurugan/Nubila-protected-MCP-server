#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import { nubilaTools, TOKEN_REQUIREMENTS } from './tools/nubila-tools.js';

// Load environment variables
dotenv.config();

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Import EVMAuth SDK using CommonJS require
let EVMAuthSDK;
try {
  const evmauthModule = require('@matt_dionis/evmauth-sdk-test');
  EVMAuthSDK = evmauthModule.EVMAuthSDK || evmauthModule.default || evmauthModule;
} catch (error) {
  console.error('Failed to import EVMAuth SDK:', error);
  console.log('Trying fallback import...');
  try {
    const evmauthModule = require('./evmauth-import-fix.cjs');
    EVMAuthSDK = evmauthModule.EVMAuthSDK || evmauthModule.default || evmauthModule;
  } catch (fallbackError) {
    console.error('Fallback import also failed:', fallbackError);
    throw new Error('Could not import EVMAuth SDK');
  }
}

// Initialize EVMAuth SDK
const evmauth = new EVMAuthSDK({
  contractAddress: process.env.EVMAUTH_CONTRACT_ADDRESS || '0x5448b6c0D06C4e073fC95FE256F52E02e456d049',
  chainId: parseInt(process.env.EVMAUTH_CHAIN_ID) || 1223953,
  rpcUrl: process.env.EVMAUTH_RPC_URL || 'https://rpc.testnet.radius.space'
});

// Create FastMCP server instance
const mcp = new FastMCP({
  name: 'nubila-protected-mcp-server',
  version: '1.0.0',
  description: 'MCP server for Nubila Weather API with EVMAuth token protection'
});

// Register all tools with token protection
Object.entries(nubilaTools).forEach(([toolName, tool]) => {
  const tokenId = TOKEN_REQUIREMENTS[toolName] || 0;
  
  let execute;
  if (tokenId === 0) {
    // Free tier - no protection needed
    execute = tool.handler;
  } else {
    // Protected tool - wrap with EVMAuth
    execute = evmauth.protect(tokenId, tool.handler);
  }
  
  // Register the tool with MCP
  mcp.tool(tool.name, tool.description, tool.inputSchema, execute);
});

// Log token requirements
console.log('Token Requirements:');
Object.entries(TOKEN_REQUIREMENTS).forEach(([tool, tokenId]) => {
  const tier = tokenId === 0 ? 'Free' : 
               tokenId === 1 ? 'Basic (Token 1)' : 
               tokenId === 3 ? 'Premium (Token 3)' : 
               tokenId === 5 ? 'Pro (Token 5)' : `Token ${tokenId}`;
  console.log(`  ${tool}: ${tier}`);
});

// Start the server
async function main() {
  try {
    await mcp.start();
    console.log('\nNubila MCP server (protected) is running');
    console.log('EVMAuth Contract:', process.env.EVMAUTH_CONTRACT_ADDRESS || '0x5448b6c0D06C4e073fC95FE256F52E02e456d049');
    console.log('Chain ID:', process.env.EVMAUTH_CHAIN_ID || 1223953);
    console.log('Available tools:', Object.keys(nubilaTools).join(', '));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await mcp.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  await mcp.stop();
  process.exit(0);
});

// Run the server
main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});