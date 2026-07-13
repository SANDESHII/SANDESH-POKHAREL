
/**
 * TEAM MAPPING SERVICE
 * Canonicalizes team names across data providers (CSV, Gemini, Baseline).
 */

export class TeamMappingService {
    private static readonly CANONICAL_MAP: Record<string, string[]> = {
        "MAN_CITY": ["Man City", "Manchester City", "MCFC"],
        "MAN_UTD": ["Man United", "Manchester United", "Man Utd", "MUFC"],
        "LIVERPOOL": ["Liverpool", "LFC"],
        "ARSENAL": ["Arsenal", "AFC"],
        "REAL_MADRID": ["Real Madrid", "RMA", "Madrid"],
        "BARCELONA": ["Barcelona", "FCB", "Barca"],
        "BAYERN_MUNICH": ["Bayern Munich", "Bayern", "FC Bayern"],
        "PSG": ["PSG", "Paris Saint-Germain", "Paris SG"],
        "INTER_MILAN": ["Inter Milan", "Inter", "Internazionale"],
        "AC_MILAN": ["AC Milan", "Milan"],
        "JUVENTUS": ["Juventus", "Juve"],
        "DORTMUND": ["Dortmund", "Borussia Dortmund", "BVB"],
        "BAYER_LEVERKUSEN": ["Bayer Leverkusen", "Leverkusen"],
        "ATLETICO_MADRID": ["Atletico Madrid", "Atleti", "Atletico"],
        "NAPOLI": ["Napoli", "SSC Napoli"],
        "TOTTENHAM": ["Tottenham", "Spurs", "Tottenham Hotspur"],
        "NEWCASTLE": ["Newcastle", "Newcastle United", "NUFC"],
        "ASTON_VILLA": ["Aston Villa", "AVFC"],
        "CHELSEA": ["Chelsea", "CFC"],
        "BRIGHTON": ["Brighton", "Brighton & Hove Albion", "Brighton and Hove Albion"],
        "WEST_HAM": ["West Ham", "West Ham United", "WHU"],
        "EVERTON": ["Everton", "EFC"],
        "WOLVES": ["Wolves", "Wolverhampton", "Wolverhampton Wanderers"],
        "FULHAM": ["Fulham", "FFC"],
        "BOURNEMOUTH": ["Bournemouth", "AFC Bournemouth"],
        "BRENTFORD": ["Brentford"],
        "CRYSTAL_PALACE": ["Crystal Palace", "CPFC"],
        "NOTTM_FOREST": ["Nott'm Forest", "Nottingham Forest", "Forest"],
        "LUTON": ["Luton", "Luton Town"],
        "BURNLEY": ["Burnley"],
        "SHEFFIELD_UTD": ["Sheffield Utd", "Sheffield United"],
        "BENFICA": ["Benfica", "SL Benfica"],
        "PORTO": ["Porto", "FC Porto"],
        "SPORTING_CP": ["Sporting CP", "Sporting Lisbon", "Sporting"],
        "FEYENOORD": ["Feyenoord"],
        "PSV": ["PSV", "PSV Eindhoven"],
        "AJAX": ["Ajax", "AFC Ajax"],
        "RB_LEIPZIG": ["RB Leipzig", "Leipzig"],
        "REAL_SOCIEDAD": ["Real Sociedad", "Sociedad"]
    };

    private static aliasToId: Map<string, string> = new Map();
    private static initialized = false;

    private static initialize() {
        if (this.initialized) return;
        for (const [id, aliases] of Object.entries(this.CANONICAL_MAP)) {
            // ID itself is an alias
            this.aliasToId.set(id.toLowerCase(), id);
            for (const alias of aliases) {
                this.aliasToId.set(alias.toLowerCase(), id);
            }
        }
        this.initialized = true;
    }

    /**
     * Canonicalizes a team name.
     * @returns The canonical ID if found, otherwise the original name (normalized).
     */
    static canonicalize(name: string): { id: string; isMapped: boolean } {
        this.initialize();
        if (!name) return { id: "UNKNOWN", isMapped: false };

        const normalized = name.trim().toLowerCase();
        const found = this.aliasToId.get(normalized);

        if (found) {
            return { id: found, isMapped: true };
        }

        console.warn(`[TEAM_MAPPING] Unmapped team name detected: "${name}"`);
        // Return uppercase normalized name for consistency even if unmapped
        return { id: name.toUpperCase().replace(/\s+/g, '_'), isMapped: false };
    }

    /**
     * Human-readable name for a canonical ID.
     */
    static getDisplayName(id: string): string {
        const aliases = this.CANONICAL_MAP[id];
        return aliases ? aliases[0] : id;
    }
}
