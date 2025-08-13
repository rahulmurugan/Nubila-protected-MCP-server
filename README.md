# Nubila Protected MCP Server

An MCP (Model Context Protocol) server for the Nubila Weather API with EVMAuth token-gated protection. This server provides weather data tools that require different token tiers for access.

## Overview

This project implements a weather data MCP server that:
- Provides real-time weather data from Nubila's hyperlocal weather network
- Uses @radiustechsystems/mcp-sdk for token-gated access control
- Supports both local development and cloud deployment
- Offers tiered access based on token ownership

## Token Requirements

| Tool | Token Required | Access Level | Description |
|------|----------------|--------------|-------------|
| `ping` | None (Free) | Public | Health check and server status |
| `getCurrentWeather` | Token 1 (Basic) | Basic | Real-time weather data for coordinates |
| `getForecast` | Token 3 (Premium) | Premium | Weather forecast up to 48 hours |
| `getDetailedWeatherAnalysis` | Token 5 (Pro) | Pro | Comprehensive weather analysis with insights |

## Project Structure

```
nubila-protected-mcp-server/
├── package.json              # Project configuration
├── README.md                 # This file
├── .env                      # Environment variables (not in git)
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── unprotected-server.js    # Basic MCP server (no auth)
├── protected-server.js      # Protected MCP server (Radius MCP SDK)
├── protected-server-http.js # HTTP variant for deployment
├── tools/
│   └── nubila-tools.js      # Weather API tools implementation
├── config/
│   └── nubila-config.js     # API configuration and helpers
├── railway.json             # Railway deployment config
└── Procfile                 # Heroku deployment config
```

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Update `.env` with your Nubila API key:
```env
# Nubila API Configuration
NUBILA_API_KEY=your_nubila_api_key_here
NUBILA_API_URL=https://api.nubila.ai

# Server Configuration
NODE_ENV=development
PORT=3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Choose Your Server Mode

#### Option A: Unprotected Server (No Token Required)
```bash
npm start
# or
node unprotected-server.js
```

#### Option B: Protected Server (Token-Gated)
```bash
npm run start:protected
# or
node protected-server.js
```

#### Option C: HTTP Server for Deployment
```bash
npm run start:http
# or
node protected-server-http.js
```

## Available Tools

### 1. `ping` (Free Tier)
Health check tool - no token required.

**Usage:**
```json
{
  "tool": "ping"
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Nubila MCP server is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "Nubila Weather API"
}
```

### 2. `getCurrentWeather` (Basic Tier - Token 1)
Get current weather data for specific coordinates.

**Parameters:**
- `latitude` (number): Latitude coordinate (-90 to 90)
- `longitude` (number): Longitude coordinate (-180 to 180)
- `units` (string, optional): Temperature units ('C' or 'F', default: 'C')

**Usage:**
```json
{
  "tool": "getCurrentWeather",
  "arguments": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "units": "F"
  }
}
```

**Response:**
```json
{
  "location": {
    "latitude": "37.7749",
    "longitude": "-122.4194",
    "name": "San Francisco, CA"
  },
  "current": {
    "temperature": "68.5°F",
    "feels_like": "70.2°F",
    "humidity": "75%",
    "wind_speed": "12 m/s",
    "condition": "Partly Cloudy",
    "pressure": "1013 hPa",
    "uv_index": 6
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. `getForecast` (Premium Tier - Token 3)
Get weather forecast for the next 24-48 hours.

**Parameters:**
- `latitude` (number): Latitude coordinate
- `longitude` (number): Longitude coordinate
- `hours` (number, optional): Number of hours to forecast (1-48, default: 24)
- `units` (string, optional): Temperature units ('C' or 'F', default: 'C')

**Usage:**
```json
{
  "tool": "getForecast",
  "arguments": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "hours": 12,
    "units": "C"
  }
}
```

### 4. `getDetailedWeatherAnalysis` (Pro Tier - Token 5)
Get comprehensive weather analysis with insights and recommendations.

**Parameters:**
- `latitude` (number): Latitude coordinate
- `longitude` (number): Longitude coordinate
- `purpose` (string, optional): Analysis purpose ('outdoor', 'travel', 'agriculture', 'general')
- `units` (string, optional): Temperature units ('C' or 'F', default: 'C')

**Usage:**
```json
{
  "tool": "getDetailedWeatherAnalysis",
  "arguments": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "purpose": "outdoor",
    "units": "C"
  }
}
```

**Response includes:**
- Current weather conditions
- 24-hour forecast summary
- Weather quality assessment
- Purpose-specific recommendations
- Best outdoor time suggestions
- Weather trend analysis

## Radius MCP SDK Configuration

For deployment, set these environment variables in your hosting platform (Railway, Heroku, etc.):

```env
# Radius MCP SDK Configuration (Radius Testnet)
RADIUS_CONTRACT_ADDRESS=0x9f2B42FB651b75CC3db4ef9FEd913A22BA4629Cf
RADIUS_CHAIN_ID=1223953
RADIUS_RPC_URL=https://rpc.testnet.radiustech.xyz
DEBUG=false
```

## Deployment

### Railway
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically with `railway.json` configuration

### Heroku
1. Create a new Heroku app
2. Set environment variables using Heroku CLI or dashboard
3. Deploy with Git push or connect GitHub repository

### Other Platforms
The server automatically detects production environment and switches to HTTP transport.

## Development

### Local Testing
1. Start unprotected server for basic testing:
   ```bash
   npm start
   ```

2. Start protected server for token testing:
   ```bash
   npm run start:protected
   ```

### Token Testing
- **Free tools** (ping): Work without any tokens
- **Basic tools** (getCurrentWeather): Require Token 1 ownership
- **Premium tools** (getForecast): Require Token 3 ownership
- **Pro tools** (getDetailedWeatherAnalysis): Require Token 5 ownership

## API Integration

This server integrates with:
- **Nubila Weather API**: Real-time hyperlocal weather data
- **@radiustechsystems/mcp-sdk**: Token-gated access control on Radius testnet
- **Model Context Protocol**: Standard interface for AI model tools

## Error Handling

The server handles various error scenarios:
- Invalid coordinates
- API rate limits
- Network timeouts
- Missing tokens (402 Payment Required)
- Invalid API keys

## Support

For issues with:
- **Nubila API**: Check [Nubila Documentation](https://nubila-1.gitbook.io/api-docs)
- **Radius MCP SDK**: Check [@radiustechsystems/mcp-sdk](https://www.npmjs.com/package/@radiustechsystems/mcp-sdk) documentation
- **MCP Protocol**: Check Model Context Protocol specifications

## License

ISC License - see package.json for details.

---

**Note**: This server requires a valid Nubila API key and Radius MCP token ownership for protected tools. Ensure you have the necessary tokens before testing protected endpoints.