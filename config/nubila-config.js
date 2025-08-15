import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// API Configuration
export const NUBILA_API_URL = process.env.NUBILA_API_URL || 'https://api.nubila.ai';
export const NUBILA_API_KEY = process.env.NUBILA_API_KEY;

if (!NUBILA_API_KEY) {
  console.warn('Warning: NUBILA_API_KEY not found in environment variables');
}

// Create axios instance with default config
export const nubilaApi = axios.create({
  baseURL: NUBILA_API_URL,
  headers: {
    'X-Api-Key': NUBILA_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Helper function to make API requests
export async function makeNubilaRequest(endpoint, params = {}) {
  // If no API key, return mock data for demo
  if (!NUBILA_API_KEY) {
    console.log('⚠️ No Nubila API key - returning mock data for demo');
    return getMockData(endpoint, params);
  }
  
  try {
    const response = await nubilaApi.get(endpoint, { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      // API returned an error response
      throw new Error(`Nubila API Error: ${error.response.data.message || error.response.statusText}`);
    } else if (error.request) {
      // Request was made but no response
      throw new Error('No response from Nubila API');
    } else {
      // Something else went wrong
      throw new Error(`Request failed: ${error.message}`);
    }
  }
}

// Mock data for demo purposes
function getMockData(endpoint, params) {
  if (endpoint.includes('weather')) {
    return {
      location_name: 'Demo Location',
      temperature: 22.5,
      feels_like: 21.0,
      humidity: 65,
      wind_speed: 5.2,
      condition: 'Partly Cloudy',
      pressure: 1013,
      uv_index: 3
    };
  }
  
  if (endpoint.includes('forecast')) {
    // Return array of forecast data
    const forecast = [];
    for (let i = 0; i < 48; i++) {
      forecast.push({
        hour: i,
        timestamp: new Date(Date.now() + i * 3600000).toISOString(),
        temperature: 20 + Math.random() * 10,
        min: 18 + Math.random() * 5,
        max: 23 + Math.random() * 7,
        condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
        humidity: 50 + Math.random() * 30,
        wind_speed: 3 + Math.random() * 10,
        precipitation: Math.random() * 100
      });
    }
    return forecast;
  }
  
  return {};
}

// Utility function to format coordinates
export function formatCoordinates(lat, lon) {
  return {
    latitude: parseFloat(lat).toFixed(4),
    longitude: parseFloat(lon).toFixed(4)
  };
}

// Utility function to convert temperature units
export function convertTemperature(celsius, unit = 'C') {
  if (unit === 'F') {
    return (celsius * 9/5) + 32;
  }
  return celsius;
}