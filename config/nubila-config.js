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