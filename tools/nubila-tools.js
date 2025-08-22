import { z } from 'zod';
import { makeNubilaRequest, formatCoordinates } from '../config/nubila-config.js';
import { logToFile } from '../logger.js';

// Token requirements for each tool
export const TOKEN_REQUIREMENTS = {
  ping: 0,                        // Free tier - health check
  getCurrentWeather: 1,           // Basic tier - current weather
  getForecast: 3,                // Premium tier - forecast data
  getDetailedWeatherAnalysis: 5   // Pro tier - comprehensive analysis
};

// Tool definitions
export const nubilaTools = {
  ping: {
    name: 'ping',
    description: 'Check if the Nubila MCP server is running',
    inputSchema: z.object({}),
    handler: async () => {
      return {
        status: 'ok',
        message: 'Nubila MCP server is running',
        timestamp: new Date().toISOString(),
        service: 'Nubila Weather API'
      };
    }
  },

  getCurrentWeather: {
    name: 'getCurrentWeather',
    description: 'Get current weather data for specific coordinates',
    inputSchema: z.object({
      latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
      longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
      units: z.enum(['C', 'F']).optional().default('C').describe('Temperature units (C for Celsius, F for Fahrenheit)')
    }),
    handler: async ({ latitude, longitude, units }) => {
      try {
        const requestData = await makeNubilaRequest('/api/v1/weather', {
          lat: latitude,
          lon: longitude
        });
        const weatherData = requestData.ok ? requestData.data : {};

        // Format the response
        const formatted = formatCoordinates(latitude, longitude);
        
        return {
          location: {
            ...formatted,
            name: weatherData.location_name || 'Unknown Location'
          },
          current: {
            temperature: units === 'F' ? 
              `${((weatherData.temperature * 9/5) + 32).toFixed(1)}°F` : 
              `${weatherData.temperature}°C`,
            feels_like: units === 'F' ? 
              `${((weatherData.feels_like * 9/5) + 32).toFixed(1)}°F` : 
              `${weatherData.feels_like}°C`,
            humidity: `${weatherData.humidity}%`,
            wind_speed: `${weatherData.wind_speed} m/s`,
            condition: weatherData.condition,
            pressure: weatherData.pressure ? `${weatherData.pressure} hPa` : undefined,
            uv_index: weatherData.uv_index
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        throw new Error(`Failed to get current weather: ${error.message}`);
      }
    }
  },

  getForecast: {
    name: 'getForecast',
    description: 'Get weather forecast for the next 24-48 hours',
    inputSchema: z.object({
      latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
      longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
      hours: z.number().min(1).max(48).optional().default(24).describe('Number of hours to forecast'),
      units: z.enum(['C', 'F']).optional().default('C').describe('Temperature units')
    }),
    handler: async ({ latitude, longitude, hours, units }) => {
      try {
        const forecastData = await makeNubilaRequest('/api/v1/forecast', {
          lat: latitude,
          lon: longitude
        });

        // Handle different API response formats
        let forecastArray = forecastData;
        if (!Array.isArray(forecastData)) {
          // Check common nested structures
          forecastArray = forecastData.data || forecastData.forecast || forecastData.items || [];
          logToFile(`Forecast data was not array, extracted from: ${JSON.stringify(Object.keys(forecastData))}`);
        }
        
        // Ensure we have an array
        if (!Array.isArray(forecastArray)) {
          console.error('Could not extract array from forecast data:', forecastData);
          forecastArray = [];
        }
        
        // Limit forecast to requested hours
        const limitedForecast = forecastArray.slice(0, hours);
        
        // Format the forecast data
        const formatted = formatCoordinates(latitude, longitude);
        const formattedForecast = limitedForecast.map(item => ({
          time: item.timestamp || new Date(Date.now() + item.hour * 3600000).toISOString(),
          temperature: units === 'F' ? 
            `${((item.temperature * 9/5) + 32).toFixed(1)}°F` : 
            `${item.temperature}°C`,
          min_temp: units === 'F' ? 
            `${((item.min * 9/5) + 32).toFixed(1)}°F` : 
            `${item.min}°C`,
          max_temp: units === 'F' ? 
            `${((item.max * 9/5) + 32).toFixed(1)}°F` : 
            `${item.max}°C`,
          condition: item.condition,
          humidity: `${item.humidity}%`,
          wind_speed: `${item.wind_speed} m/s`,
          precipitation_chance: item.precipitation ? `${item.precipitation}%` : '0%'
        }));

        return {
          location: {
            ...formatted,
            name: limitedForecast[0]?.location_name || forecastData.location_name || 'Unknown Location'
          },
          forecast_hours: hours,
          forecast: formattedForecast,
          generated_at: new Date().toISOString()
        };
      } catch (error) {
        throw new Error(`Failed to get forecast: ${error.message}`);
      }
    }
  },

  getDetailedWeatherAnalysis: {
    name: 'getDetailedWeatherAnalysis',
    description: 'Get comprehensive weather analysis with insights and recommendations',
    inputSchema: z.object({
      latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
      longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
      purpose: z.enum(['outdoor', 'travel', 'agriculture', 'general']).optional().default('general').describe('Purpose of the weather analysis'),
      units: z.enum(['C', 'F']).optional().default('C').describe('Temperature units')
    }),
    handler: async ({ latitude, longitude, purpose, units }) => {
      try {
        // Get both current weather and forecast
        const [currentWeather, forecastData] = await Promise.all([
          makeNubilaRequest('/api/v1/weather', { lat: latitude, lon: longitude }),
          makeNubilaRequest('/api/v1/forecast', { lat: latitude, lon: longitude })
        ]);

        const formatted = formatCoordinates(latitude, longitude);
        
        // Handle different API response formats for forecast
        let forecastArray = forecastData;
        if (!Array.isArray(forecastData)) {
          forecastArray = forecastData.data || forecastData.forecast || forecastData.items || [];
        }
        
        // Ensure we have an array
        if (!Array.isArray(forecastArray)) {
          console.error('Could not extract array from forecast data:', forecastData);
          forecastArray = [];
        }
        
        // Analyze the data based on purpose
        const analysis = analyzeWeatherData(currentWeather, forecastArray, purpose);
        
        // Get next 24 hours forecast summary
        const next24Hours = forecastArray.slice(0, 24);
        const avgTemp = next24Hours.reduce((sum, item) => sum + item.temperature, 0) / next24Hours.length;
        const maxTemp = Math.max(...next24Hours.map(item => item.max || item.temperature));
        const minTemp = Math.min(...next24Hours.map(item => item.min || item.temperature));
        const totalPrecip = next24Hours.reduce((sum, item) => sum + (item.precipitation || 0), 0) / next24Hours.length;

        return {
          location: {
            ...formatted,
            name: currentWeather.location_name || 'Unknown Location'
          },
          current_conditions: {
            temperature: units === 'F' ? 
              `${((currentWeather.temperature * 9/5) + 32).toFixed(1)}°F` : 
              `${currentWeather.temperature}°C`,
            feels_like: units === 'F' ? 
              `${((currentWeather.feels_like * 9/5) + 32).toFixed(1)}°F` : 
              `${currentWeather.feels_like}°C`,
            humidity: `${currentWeather.humidity}%`,
            wind_speed: `${currentWeather.wind_speed} m/s`,
            condition: currentWeather.condition,
            uv_index: currentWeather.uv_index
          },
          forecast_summary: {
            next_24h_avg_temp: units === 'F' ? 
              `${((avgTemp * 9/5) + 32).toFixed(1)}°F` : 
              `${avgTemp.toFixed(1)}°C`,
            next_24h_max_temp: units === 'F' ? 
              `${((maxTemp * 9/5) + 32).toFixed(1)}°F` : 
              `${maxTemp.toFixed(1)}°C`,
            next_24h_min_temp: units === 'F' ? 
              `${((minTemp * 9/5) + 32).toFixed(1)}°F` : 
              `${minTemp.toFixed(1)}°C`,
            precipitation_chance: `${totalPrecip.toFixed(0)}%`,
            trend: determineTrend(forecastArray)
          },
          analysis: analysis,
          generated_at: new Date().toISOString()
        };
      } catch (error) {
        throw new Error(`Failed to generate weather analysis: ${error.message}`);
      }
    }
  }
};

// Helper function to analyze weather data based on purpose
function analyzeWeatherData(current, forecast, purpose) {
  const insights = [];
  const recommendations = [];
  
  // Basic weather quality assessment
  const weatherQuality = assessWeatherQuality(current);
  insights.push(`Current weather conditions are ${weatherQuality}`);
  
  // Purpose-specific analysis
  switch (purpose) {
    case 'outdoor':
      if (current.uv_index > 6) {
        recommendations.push('High UV index - wear sunscreen and protective clothing');
      }
      if (current.wind_speed > 10) {
        recommendations.push('Strong winds - secure loose items and dress appropriately');
      }
      if (current.temperature < 10) {
        recommendations.push('Cold weather - dress in layers');
      } else if (current.temperature > 30) {
        recommendations.push('Hot weather - stay hydrated and seek shade');
      }
      break;
      
    case 'travel':
      const hasRain = forecast.slice(0, 12).some(f => (f.precipitation || 0) > 50);
      if (hasRain) {
        recommendations.push('Rain expected in the next 12 hours - pack rain gear');
      }
      if (current.visibility && current.visibility < 5000) {
        recommendations.push('Reduced visibility - drive carefully');
      }
      break;
      
    case 'agriculture':
      if (current.humidity < 30) {
        recommendations.push('Low humidity - consider irrigation');
      }
      if (forecast.slice(0, 24).some(f => f.temperature < 0)) {
        recommendations.push('Frost risk in next 24 hours - protect sensitive crops');
      }
      break;
      
    default:
      // General recommendations
      if (weatherQuality === 'excellent') {
        recommendations.push('Great day for outdoor activities');
      } else if (weatherQuality === 'poor') {
        recommendations.push('Consider indoor activities today');
      }
  }
  
  // Add trend insight
  const trend = determineTrend(forecast);
  insights.push(`Weather trend: ${trend}`);
  
  return {
    overall_assessment: weatherQuality,
    insights,
    recommendations,
    best_time_outdoors: findBestOutdoorTime(forecast)
  };
}

// Helper function to assess weather quality
function assessWeatherQuality(weather) {
  let score = 100;
  
  // Temperature factors
  if (weather.temperature < 0 || weather.temperature > 35) score -= 30;
  else if (weather.temperature < 10 || weather.temperature > 30) score -= 15;
  
  // Humidity factors
  if (weather.humidity > 80) score -= 20;
  else if (weather.humidity < 20) score -= 10;
  
  // Wind factors
  if (weather.wind_speed > 15) score -= 25;
  else if (weather.wind_speed > 10) score -= 10;
  
  // Condition factors
  const condition = weather.condition?.toLowerCase() || '';
  if (condition.includes('storm') || condition.includes('heavy')) score -= 40;
  else if (condition.includes('rain') || condition.includes('snow')) score -= 20;
  else if (condition.includes('cloud')) score -= 5;
  
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

// Helper function to determine weather trend
function determineTrend(forecast) {
  if (!forecast || forecast.length < 6) return 'stable';
  
  const firstHours = forecast.slice(0, 3);
  const lastHours = forecast.slice(-3);
  
  const avgTempFirst = firstHours.reduce((sum, f) => sum + f.temperature, 0) / firstHours.length;
  const avgTempLast = lastHours.reduce((sum, f) => sum + f.temperature, 0) / lastHours.length;
  
  const tempDiff = avgTempLast - avgTempFirst;
  
  if (tempDiff > 3) return 'warming';
  if (tempDiff < -3) return 'cooling';
  return 'stable';
}

// Helper function to find best outdoor time
function findBestOutdoorTime(forecast) {
  if (!forecast || forecast.length === 0) return 'No forecast data available';
  
  let bestHour = null;
  let bestScore = -1;
  
  forecast.slice(0, 24).forEach((hour, index) => {
    let score = 100;
    
    // Prefer moderate temperatures
    if (hour.temperature >= 18 && hour.temperature <= 25) score += 20;
    else if (hour.temperature < 10 || hour.temperature > 30) score -= 30;
    
    // Prefer low precipitation
    score -= (hour.precipitation || 0) * 0.5;
    
    // Prefer moderate wind
    if (hour.wind_speed > 10) score -= 20;
    
    // Prefer daytime hours (assuming index 6-18 are daytime)
    if (index >= 6 && index <= 18) score += 10;
    
    if (score > bestScore) {
      bestScore = score;
      bestHour = index;
    }
  });
  
  if (bestHour !== null) {
    const time = new Date(Date.now() + bestHour * 3600000);
    return `${time.getHours()}:00 - ${time.getHours() + 1}:00`;
  }
  
  return 'Current conditions are suitable';
}