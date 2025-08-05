#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { nubilaTools } from './tools/nubila-tools.js';

// Create FastMCP server instance
const mcp = new FastMCP({
  name: 'nubila-mcp-server',
  version: '1.0.0',
  description: 'MCP server for Nubila Weather API (Unprotected)'
});

// Register all tools
Object.values(nubilaTools).forEach(tool => {
  mcp.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
});

// Start the server
async function main() {
  try {
    await mcp.start();
    console.log('Nubila MCP server (unprotected) is running');
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