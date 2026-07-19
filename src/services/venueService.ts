/**
 * VENUE SERVICE
 * Provides stadium coordinates and surface types for environmental modeling.
 */
export class VenueService {
    private static STADIUM_MAP: Record<string, { lat: number, lon: number, name: string, capacity: number }> = {
        'MAN_CITY': { lat: 53.4831, lon: -2.2004, name: 'Etihad Stadium', capacity: 53400 },
        'MAN_UTD': { lat: 53.4631, lon: -2.2913, name: 'Old Trafford', capacity: 74310 },
        'LIVERPOOL': { lat: 53.4308, lon: -2.9608, name: 'Anfield', capacity: 61276 },
        'ARSENAL': { lat: 51.5549, lon: -0.1084, name: 'Emirates Stadium', capacity: 60704 },
        'CHELSEA': { lat: 51.4817, lon: -0.1910, name: 'Stamford Bridge', capacity: 40341 },
        'REAL_MADRID': { lat: 40.4531, lon: -3.6883, name: 'Santiago Bernabéu', capacity: 81044 },
        'BARCELONA': { lat: 41.3809, lon: 2.1228, name: 'Camp Nou', capacity: 99354 },
        'BAYERN_MUNICH': { lat: 48.2188, lon: 11.6247, name: 'Allianz Arena', capacity: 75000 },
        'DORTMUND': { lat: 51.4926, lon: 7.4519, name: 'Signal Iduna Park', capacity: 81365 },
        'INTER_MILAN': { lat: 45.4781, lon: 9.1240, name: 'San Siro', capacity: 80018 },
        'AC_MILAN': { lat: 45.4781, lon: 9.1240, name: 'San Siro', capacity: 80018 },
        'PSG': { lat: 48.8414, lon: 2.2530, name: 'Parc des Princes', capacity: 47929 }
    };

    static getVenue(teamId: string) {
        return this.STADIUM_MAP[teamId] || { lat: 51.5074, lon: -0.1278, name: 'Universal Grounds', capacity: 30000 };
    }
}
