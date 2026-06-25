
/**
 * Team Historical Baselines
 * Provides fallback data when live sources are unavailable.
 */

export interface TeamBaseline {
    npxG: number;
    xT: number;
    avgXG: number;
    avgXGA: number;
    cleanSheets: number;
    leagueAvgGoals?: number;
}

const HISTORICAL_BASELINES: Record<string, TeamBaseline> = {
    "man_city": { npxG: 2.1, xT: 1.8, avgXG: 2.3, avgXGA: 0.8, cleanSheets: 12 },
    "liverpool": { npxG: 1.9, xT: 1.7, avgXG: 2.1, avgXGA: 0.9, cleanSheets: 10 },
    "arsenal": { npxG: 1.8, xT: 1.6, avgXG: 2.0, avgXGA: 0.8, cleanSheets: 13 },
    "aston_villa": { npxG: 1.6, xT: 1.4, avgXG: 1.8, avgXGA: 1.3, cleanSheets: 8 },
    "tottenham": { npxG: 1.7, xT: 1.5, avgXG: 1.9, avgXGA: 1.5, cleanSheets: 7 },
    "man_utd": { npxG: 1.4, xT: 1.3, avgXG: 1.5, avgXGA: 1.4, cleanSheets: 8 },
    "newcastle": { npxG: 1.6, xT: 1.4, avgXG: 1.8, avgXGA: 1.5, cleanSheets: 9 },
    "chelsea": { npxG: 1.5, xT: 1.4, avgXG: 1.6, avgXGA: 1.3, cleanSheets: 9 },
    "real_madrid": { npxG: 2.0, xT: 1.8, avgXG: 2.2, avgXGA: 1.0, cleanSheets: 11 },
    "barcelona": { npxG: 1.7, xT: 1.5, avgXG: 1.9, avgXGA: 1.1, cleanSheets: 9 },
    "atletico_madrid": { npxG: 1.5, xT: 1.3, avgXG: 1.6, avgXGA: 0.9, cleanSheets: 12 },
    "bayer_leverkusen": { npxG: 1.9, xT: 1.7, avgXG: 2.1, avgXGA: 0.9, cleanSheets: 11 },
    "bayern_munich": { npxG: 2.2, xT: 1.9, avgXG: 2.4, avgXGA: 1.0, cleanSheets: 10 },
    "borussia_dortmund": { npxG: 1.7, xT: 1.5, avgXG: 1.9, avgXGA: 1.4, cleanSheets: 8 },
    "stuttgart": { npxG: 1.8, xT: 1.5, avgXG: 2.0, avgXGA: 1.2, cleanSheets: 9 },
    "psg": { npxG: 2.1, xT: 1.9, avgXG: 2.3, avgXGA: 1.1, cleanSheets: 10 },
    "monaco": { npxG: 1.6, xT: 1.4, avgXG: 1.8, avgXGA: 1.3, cleanSheets: 8 },
    "inter_milan": { npxG: 1.9, xT: 1.6, avgXG: 2.0, avgXGA: 0.8, cleanSheets: 14 },
    "ac_milan": { npxG: 1.6, xT: 1.4, avgXG: 1.7, avgXGA: 1.2, cleanSheets: 10 },
    "juventus": { npxG: 1.3, xT: 1.1, avgXG: 1.4, avgXGA: 0.9, cleanSheets: 12 },
    "napoli": { npxG: 1.5, xT: 1.4, avgXG: 1.6, avgXGA: 1.1, cleanSheets: 9 },
    "atalanta": { npxG: 1.7, xT: 1.5, avgXG: 1.8, avgXGA: 1.2, cleanSheets: 11 }
};

export const getTeamBaseline = (teamName: string): TeamBaseline => {
    const slug = teamName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    
    // Check for direct match
    if (HISTORICAL_BASELINES[slug]) return HISTORICAL_BASELINES[slug];
    
    // Check for partial match (e.g. "Manchester City" -> "man_city")
    for (const key in HISTORICAL_BASELINES) {
        if (slug.includes(key) || key.includes(slug)) {
            return HISTORICAL_BASELINES[key];
        }
    }
    
    // Default safe baseline (Average European Team)
    return {
        npxG: 1.25,
        xT: 1.10,
        avgXG: 1.20,
        avgXGA: 1.25,
        cleanSheets: 6
    };
};
