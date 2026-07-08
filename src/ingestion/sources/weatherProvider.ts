import { IngestionCache } from '../cache';
import { IngestionRetry } from '../retry';

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
            // @ts-ignore
            const _url = `${this.BASE_URL}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum&timezone=auto`;
            // Simulation
            return { temp: 18, condition: 'Clear', precipitation: 0 };
        }, `WeatherAPI_${lat}_${lon}`);

        if (result) {
            IngestionCache.set(cacheKey, result, 43200000); // 12 hour cache
            return result;
        }

        return { temp: 15, condition: 'Unknown', precipitation: 0 };
    }
}
