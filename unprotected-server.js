#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { nubilaTools } from './tools/nubila-tools.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if running in DEMO_MODE
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Create FastMCP server instance
const mcp = new FastMCP({
  name: 'nubila-mcp-server',
  version: '1.0.0',
  description: DEMO_MODE ? 'MCP server for Nubila Weather API (DEMO MODE)' : 'MCP server for Nubila Weather API (Unprotected)'
});

// Register all tools
Object.values(nubilaTools).forEach(tool => {
  mcp.addTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    execute: async (args) => {
      const result = await tool.handler(args);
      return {
        content: [{
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    }
  });
});

// Start the server
async function main() {
  try {
    await mcp.start();
    if (DEMO_MODE) {
      console.log('🎮 Nubila MCP server running in DEMO MODE');
      console.log('All tools available without authentication:');
      console.log('  - ping (health check)');
      console.log('  - getCurrentWeather (current weather data)');
      console.log('  - getForecast (weather forecast)');
      console.log('  - getDetailedWeatherAnalysis (comprehensive analysis)');
    } else {
      console.log('Nubila MCP server (unprotected) is running');
      console.log('Available tools:', Object.keys(nubilaTools).join(', '));
    }
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