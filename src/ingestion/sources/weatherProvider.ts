import { IngestionCache } from '../cache';
import { IngestionRetry } from '../retry';
import { fetchWithTimeout } from '../../lib/fetchUtils';
import { IngestionValidator } from '../validator';

/**
 * OPEN-METEO WEATHER PROVIDER
 * Fully free, no key required weather data.
 */
export class WeatherProvider {
    private static BASE_URL = 'https://api.open-meteo.com/v1/forecast';

    static async getForecast(lat: number, lon: number, date: string): Promise<any> {
        const cacheKey = `weather_${lat}_${lon}_${date}`;
        const cached = IngestionCache.get(cacheKey);
        if (cached) return cached;

        const result = await IngestionRetry.execute(async () => {
            const url = `${this.BASE_URL}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum&timezone=auto&start_date=${date}&end_date=${date}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`Weather API Error: ${response.status}`);
            const raw = await response.json();
            
            const validated = IngestionValidator.validateWeather(raw);
            if (!validated) throw new Error('Invalid weather data format from API');
            
            return validated;
        }, `WeatherAPI_${lat}_${lon}`);

        if (result) {
            IngestionCache.set(cacheKey, result, IngestionCache.WEATHER_DATA_TTL);
            return result;
        }

        return null;
    }
}
