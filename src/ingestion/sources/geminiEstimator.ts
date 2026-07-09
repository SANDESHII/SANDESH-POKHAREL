import { GoogleGenAI, Type } from "@google/genai";
import { IngestionCache } from '../cache';

/**
 * GEMINI ESTIMATOR (FALLBACK)
 * Uses AI to estimate team strength when historical data is missing.
 */
export class GeminiEstimator {
    private static ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
            headers: {
                'User-Agent': 'aistudio-build',
            }
        }
    });

    static async estimateStats(teamName: string, context: string): Promise<any> {
        const cacheKey = `gemini_est_v2_${teamName}`;
        const cached = IngestionCache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await this.ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: `Estimate the current offensive and defensive strength (expected goals npxG and expected goals against npxGA) for the football team "${teamName}" in the context of ${context}. Return a realistic number between 0.5 and 3.0 based on general knowledge of their league tier.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            npxG: { type: Type.NUMBER, description: "Expected goals per match" },
                            npxGA: { type: Type.NUMBER, description: "Expected goals against per match" },
                            purity: { type: Type.NUMBER, description: "Confidence in this estimate (0.0 to 1.0)" }
                        },
                        required: ["npxG", "npxGA", "purity"]
                    }
                }
            });

            const estimation = JSON.parse(response.text || '{}');
            // Ensure fallback values if AI fails to return proper JSON
            const result = {
                npxG: estimation.npxG || 1.35,
                npxGA: estimation.npxGA || 1.35,
                purity: estimation.purity || 0.25,
                source: 'Gemini-AI'
            };

            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
            return result;
        } catch (error) {
            console.error(`[GEMINI_EST] Error estimating for ${teamName}:`, error);
            return null;
        }
    }
}
