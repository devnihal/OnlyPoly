// ONLYPOLY Board Data (Server Side)
// 100% Server Authoritative

const TILE_TYPES = {
  START: 'start',
  PROPERTY: 'property',
  AIRPORT: 'airport',
  UTILITY: 'utility',
  CHANCE: 'chance',
  TAX: 'tax',
  JAIL: 'jail',
  GOTO_JAIL: 'goto_jail',
  VACATION: 'vacation',
};

// House multipliers: standard monopoly progression
const HOUSE_MULTIPLIERS = [1.0, 5.0, 15.0, 45.0, 65.0]; // Rent multipliers for 0-4 houses (Just examples, logic is in rentCalculator)
const HOTEL_MULTIPLIER = 80.0;
const MONOPOLY_BONUS = 2.0;

// Helper to build property
// Tier 1 (Cheap) -> Tier 8 (Expensive)
function property(id, name, country, price, groupColor, baseRent) {
  return {
    id,
    type: TILE_TYPES.PROPERTY,
    name,
    country,
    price,
    baseRent,
    housePrice: Math.round(price * 0.5), // Simplified house cost logic
    hotelPrice: Math.round(price * 0.5),
    mortgageValue: Math.round(price * 0.5),
    color: groupColor,
    group: country, // Grouping by country for monopoly logic
  };
}

function airport(id, name) {
  return { id, type: TILE_TYPES.AIRPORT, name, price: 200, group: 'airport' };
}

function utility(id, name) {
  return { id, type: TILE_TYPES.UTILITY, name, price: 150, group: 'utility' };
}

function chance(id) {
  return { id, type: TILE_TYPES.CHANCE, name: 'Surprise' };
}

function tax(id, name, amount) {
  return { id, type: TILE_TYPES.TAX, name, amount };
}

// 40 Tiles Total (0-39)
// Layout: Bottom Right (0, Start) -> Bottom Left (10, Jail) -> Top Left (20, Vacation) -> Top Right (30, GoToJail)

const BOARD = [
  // --- BOTTOM SIDE (Right to Left visually, but index increases) ---
  { id: 0, type: TILE_TYPES.START, name: 'GO', salary: 200 },

  // Group 1: Pakistan (2)
  property(1, 'Karachi', 'PAKISTAN', 60, '#8d6e63', 2),
  chance(2),
  property(3, 'Lahore', 'PAKISTAN', 60, '#8d6e63', 4),

  tax(4, 'Income Tax', 200),
  airport(5, 'Dubai Int.', 'UAE'), // Airport 1

  // Group 2: Poland (2) // Changed Mexico to Poland as per refined plan to fit tiers
  // Actually, let's stick to the "Revised Layout" from my detailed plan in thought process
  // Tier 1: Pakistan (2)
  // Tier 2: Mexico (2)
  // 6, 8

  property(6, 'Mexico City', 'MEXICO', 100, '#03a9f4', 6), // Light Blue
  chance(7),
  property(8, 'Cancún', 'MEXICO', 100, '#03a9f4', 6),
  property(9, 'Warsaw', 'POLAND', 120, '#e91e63', 8), // Pink - Start of next group

  // --- LEFT SIDE (Bottom to Top) ---
  // 10: Jail
  { id: 10, type: TILE_TYPES.JAIL, name: 'Jail' },

  property(11, 'Krakow', 'POLAND', 120, '#e91e63', 8), // Pink
  utility(12, 'Electric Company'),

  // Group 4: India (3) - Orange
  property(13, 'Mumbai', 'INDIA', 140, '#ff9800', 10),
  property(14, 'Delhi', 'INDIA', 140, '#ff9800', 10),
  airport(15, 'Chhatrapati Int.', 'INDIA'), // Airport 2
  property(16, 'Bangalore', 'INDIA', 160, '#ff9800', 12),

  chance(17),
  // Group 5: Russia (2) - Red
  property(18, 'Moscow', 'RUSSIA', 180, '#f44336', 14),
  property(19, 'St. Petersburg', 'RUSSIA', 180, '#f44336', 14),

  // --- TOP SIDE (Left to Right) ---
  // 20: Vacation
  { id: 20, type: TILE_TYPES.VACATION, name: 'Free Parking' },

  // Group 6: China (3) - Yellow
  property(21, 'Shanghai', 'CHINA', 220, '#ffeb3b', 18),
  chance(22),
  property(23, 'Beijing', 'CHINA', 220, '#ffeb3b', 18),
  property(24, 'Shenzhen', 'CHINA', 240, '#ffeb3b', 20),

  airport(25, 'Beijing Capital', 'CHINA'), // Airport 3

  // Group 7: Qatar (2) - Green (Rich)
  property(26, 'Doha', 'QATAR', 260, '#4caf50', 22),
  property(27, 'Al Rayyan', 'QATAR', 260, '#4caf50', 22),

  utility(28, 'Water Works'),

  // Group 8: Japan (3) - Blue
  property(29, 'Tokyo', 'JAPAN', 280, '#2196f3', 24), // Starting Japan group

  // --- RIGHT SIDE (Top to Bottom) ---
  // 30: Go To Jail
  { id: 30, type: TILE_TYPES.GOTO_JAIL, name: 'Go To Jail' },

  property(31, 'Osaka', 'JAPAN', 300, '#2196f3', 26),
  property(32, 'Kyoto', 'JAPAN', 300, '#2196f3', 26),

  chance(33),

  // Group 9: USA (2) - Purple/Gold (Elite)
  property(34, 'New York', 'USA', 350, '#9c27b0', 35),
  airport(35, 'JFK Int.', 'USA'), // Airport 4
  chance(36),
  property(37, 'San Francisco', 'USA', 400, '#9c27b0', 50),

  tax(38, 'Luxury Tax', 100),
  chance(39),
];

const TOTAL_TILES = 40;

module.exports = {
  TILE_TYPES,
  BOARD,
  TOTAL_TILES,
  HOUSE_MULTIPLIERS,
  HOTEL_MULTIPLIER,
  MONOPOLY_BONUS,
};
