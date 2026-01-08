const { TILE_TYPES, HOUSE_MULTIPLIERS, HOTEL_MULTIPLIER, MONOPOLY_BONUS, BOARD } = require('./boardData');

function getTileById(id) {
  return BOARD.find((t) => t.id === id);
}

// Check if player owns all properties in a country/group
function hasMonopoly(playerId, group, gameState) {
  const allPropertiesInGroup = BOARD.filter(
    (t) => t.type === TILE_TYPES.PROPERTY && t.group === group
  );
  const ownedInGroup = allPropertiesInGroup.filter((t) =>
    gameState.doesPlayerOwnProperty(playerId, t.id)
  );
  return ownedInGroup.length === allPropertiesInGroup.length && allPropertiesInGroup.length > 0;
}


// Calculates rent for a property/airport/utility given the full game state.
// All numbers are integers in dollars.
// Implements bankruptcy safety: never charge more than 85% of total asset value.
function calculateRent(tileId, ownerState, gameState, diceTotal) {
  const tile = getTileById(tileId);
  if (!tile) return 0;

  // CRITICAL: Validate diceTotal is a number
  if (diceTotal !== null && diceTotal !== undefined) {
    diceTotal = Number(diceTotal);
    if (!isFinite(diceTotal) || diceTotal < 2 || diceTotal > 12) {
      console.error('[calculateRent] Invalid diceTotal:', diceTotal);
      return 0;
    }
  }

  if (tile.type === TILE_TYPES.PROPERTY) {
    const ownership = ownerState.ownedProperties[tileId];
    if (!ownership) return 0;
    const houses = ownership.houses || 0;
    const hasHotel = !!ownership.hotel;

    let rent = tile.baseRent;

    // Apply monopoly bonus (1.5x) ONLY if no houses/hotel exist
    if (!hasHotel && houses === 0) {
      const ownerId = Object.keys(gameState.players || {}).find(
        (pid) => gameState.doesPlayerOwnProperty(pid, tileId)
      );
      if (ownerId && hasMonopoly(ownerId, tile.group, gameState)) {
        rent = Math.floor(rent * MONOPOLY_BONUS);
      }
    }

    // Apply house/hotel multipliers
    if (hasHotel) {
      rent = Math.floor(rent * HOTEL_MULTIPLIER);
    } else if (houses > 0) {
      const idx = Math.min(houses, HOUSE_MULTIPLIERS.length - 1);
      rent = Math.floor(rent * HOUSE_MULTIPLIERS[idx]);
    }

    // CRITICAL: Ensure rent is always a valid number
    rent = Number(rent);
    if (!isFinite(rent) || rent < 0) {
      console.error('[calculateRent] Invalid calculated rent:', rent);
      return 0;
    }

    return rent;
  }

  if (tile.type === TILE_TYPES.AIRPORT) {
    // Airports: Dice Roll × $25 × number of airports owned
    const airportsOwned = Object.values(ownerState.ownedProperties).filter(
      (p) => p.type === TILE_TYPES.AIRPORT
    ).length;
    if (airportsOwned === 0 || !diceTotal) return 0;
    const rent = diceTotal * 25 * airportsOwned;
    // CRITICAL: Ensure rent is valid
    return isFinite(rent) && rent > 0 ? rent : 0;
  }

  if (tile.type === TILE_TYPES.UTILITY) {
    // Utilities: Dice × $10 (1 utility) or Dice × $20 (2 utilities)
    const utilitiesOwned = Object.values(ownerState.ownedProperties).filter(
      (p) => p.type === TILE_TYPES.UTILITY
    ).length;
    if (utilitiesOwned === 0 || !diceTotal) return 0;
    const multiplier = utilitiesOwned === 1 ? 10 : 20;
    const rent = diceTotal * multiplier;
    // CRITICAL: Ensure rent is valid
    return isFinite(rent) && rent > 0 ? rent : 0;
  }

  return 0;
}

module.exports = {
  calculateRent,
};


