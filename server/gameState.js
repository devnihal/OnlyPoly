const { BOARD, TOTAL_TILES, TILE_TYPES } = require('./boardData');
const { rollDice, shuffle } = require('./utils');
const { calculateRent } = require('./rentCalculator');

// Simple Chance/Surprise deck
const BASE_CHANCE_CARDS = [
  { id: 'gain50', type: 'money', amount: 50, text: 'Side hustle paid off. Collect $50.' },
  { id: 'gain150', type: 'money', amount: 150, text: 'Angel investor backs you. Collect $150.' },
  { id: 'lose50', type: 'money', amount: -50, text: 'Unexpected bill. Pay $50.' },
  { id: 'lose150', type: 'money', amount: -150, text: 'Luxury vacation ran long. Pay $150.' },
  { id: 'fwd3', type: 'move', delta: 3, text: 'Fast-track success. Move forward 3 tiles.' },
  { id: 'back3', type: 'move', delta: -3, text: 'Market correction. Move back 3 tiles.' },
  { id: 'gotoJail', type: 'goto', targetType: 'jail', text: 'Audit hits. Go directly to Jail.' },
];

class GameState {
  constructor(io, auctionSystem) {
    this.io = io;
    this.auctionSystem = auctionSystem;
    this.reset();
  }

  reset() {
    this.players = {}; // playerId -> {id, name, money, position, socketId, token, inJail, jailTurns, ownedProperties, bankrupt}
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.started = false;
    this.hostId = null;
    this.readyPlayers = new Set();
    this.chanceDeck = shuffle(BASE_CHANCE_CARDS);
    this.currentChanceIndex = 0;
    this.lastDice = null;
    // Turn authority: track per-turn actions
    this.hasRolledThisTurn = false;
    this.hasBoughtThisTurn = false;
    this.hasStartedAuctionThisTurn = false;
    // CRITICAL: Add debouncing timer for roll prevention
    this._lastRollTime = 0;
  }

  addPlayer(id, name, socketId, token, color = null) {
    if (this.started) return null;
    if (Object.keys(this.players).length >= 8) return null;

    // CRITICAL: Ensure money is always initialized as a number
    const player = {
      id,
      name,
      money: 1500, // CRITICAL: Always initialize as number
      position: 0,
      socketId,
      token,
      color: color || null, // Player's chosen color (must be set before game start)
      inJail: false,
      jailTurns: 0,
      ownedProperties: {}, // propertyId -> {type, houses, hotel}
      bankrupt: false,
    };
    
    // CRITICAL: Validate money is a number
    if (typeof player.money !== 'number' || !isFinite(player.money)) {
      console.error('[addPlayer] Invalid money initialization:', player.money);
      player.money = 1500; // Force to safe value
    }
    
    this.players[id] = player;
    if (!this.hostId) this.hostId = id;
    this.turnOrder = Object.keys(this.players);
    return player;
  }

  setPlayerColor(playerId, color) {
    // CRITICAL: Validate inputs
    if (!playerId || !color || typeof color !== 'string') {
      console.error('[setPlayerColor] Invalid inputs:', playerId, color);
      return false;
    }
    
    const player = this.players[playerId];
    if (!player) {
      console.error('[setPlayerColor] Player not found:', playerId);
      return false;
    }
    
    // CRITICAL: Cannot change color after game starts
    if (this.started) {
      console.error('[setPlayerColor] Cannot change color after game start');
      return false;
    }
    
    // CRITICAL: Check if color is already taken by another player
    const colorTaken = Object.values(this.players).some(
      (p) => p.id !== playerId && p.color === color
    );
    if (colorTaken) {
      console.error('[setPlayerColor] Color already taken:', color);
      return false;
    }
    
    // All checks passed - assign color
    player.color = color;
    return true;
  }

  removePlayer(id) {
    const p = this.players[id];
    if (!p) return;
    // Release their properties
    Object.keys(p.ownedProperties).forEach((pid) => {
      delete p.ownedProperties[pid];
    });
    p.bankrupt = true;
    delete this.players[id];
    this.turnOrder = this.turnOrder.filter((pid) => pid !== id);
    if (this.turnOrder.length === 0) {
      this.reset();
    } else if (this.currentTurnIndex >= this.turnOrder.length) {
      this.currentTurnIndex = 0;
    }
  }

  markReady(id, ready) {
    if (!this.players[id] || this.started) return;
    if (ready) this.readyPlayers.add(id);
    else this.readyPlayers.delete(id);
  }

  canStart() {
    const count = Object.keys(this.players).length;
    if (count < 2) return false;
    return this.readyPlayers.size >= 2;
  }

  startGame(requestingPlayerId) {
    if (this.started) return false;
    if (requestingPlayerId !== this.hostId) return false;
    if (!this.canStart()) return false;
    
    // CRITICAL: Validate all players have colors before starting
    const playersWithoutColors = Object.values(this.players).filter(p => !p.color);
    if (playersWithoutColors.length > 0) {
      console.error('[startGame] Players without colors:', playersWithoutColors.map(p => p.name));
      // Assign default colors if missing
      const defaultColors = ['#00d2ff', '#ff4b81', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#3498db', '#e74c3c'];
      const usedColors = new Set(Object.values(this.players).map(p => p.color).filter(Boolean));
      let colorIndex = 0;
      playersWithoutColors.forEach(p => {
        while (usedColors.has(defaultColors[colorIndex % defaultColors.length])) {
          colorIndex++;
        }
        p.color = defaultColors[colorIndex % defaultColors.length];
        usedColors.add(p.color);
        colorIndex++;
      });
    }
    
    // CRITICAL: Validate all money values are numbers
    Object.values(this.players).forEach(p => {
      if (typeof p.money !== 'number' || !isFinite(p.money)) {
        console.error('[startGame] Invalid money for player', p.id, ':', p.money);
        p.money = 1500; // Reset to starting amount
      }
    });
    
    this.started = true;
    this.turnOrder = Object.keys(this.players);
    this.currentTurnIndex = 0;
    return true;
  }

  get currentPlayerId() {
    return this.turnOrder[this.currentTurnIndex] || null;
  }

  get currentPlayer() {
    return this.players[this.currentPlayerId] || null;
  }

  assertTurn(playerId) {
    return this.currentPlayerId === playerId;
  }

  getTile(id) {
    return BOARD.find((t) => t.id === id);
  }

  doesPlayerOwnProperty(playerId, propertyId) {
    const p = this.players[playerId];
    if (!p) return false;
    return !!p.ownedProperties[propertyId];
  }

  assignProperty(propertyId, playerId) {
    // Clear existing ownership
    Object.values(this.players).forEach((p) => {
      if (p.ownedProperties[propertyId]) {
        delete p.ownedProperties[propertyId];
      }
    });
    if (!playerId) return;
    const tile = this.getTile(propertyId);
    if (!tile || tile.type !== TILE_TYPES.PROPERTY && tile.type !== TILE_TYPES.AIRPORT && tile.type !== TILE_TYPES.UTILITY) {
      return;
    }
    const owner = this.players[playerId];
    if (!owner) return;
    owner.ownedProperties[propertyId] = {
      type: tile.type,
      houses: 0,
      hotel: false,
    };
  }

  buildHouse(playerId, propertyId) {
    const player = this.players[playerId];
    const tile = this.getTile(propertyId);
    if (!player || !tile || tile.type !== TILE_TYPES.PROPERTY) return false;
    const own = player.ownedProperties[propertyId];
    if (!own || own.hotel) return false;
    if (own.houses >= 4) return false;
    const cost = Number(tile.housePrice);
    if (!isFinite(cost) || cost <= 0) return false;
    if (player.money < cost) return false;
    
    // CRITICAL: Use transferMoney for consistency and validation
    const success = this.transferMoney(playerId, null, cost, 'build_house');
    if (success) {
      own.houses += 1;
      this.checkBankruptcy(playerId);
      return true;
    }
    return false;
  }

  _ensureValidMoney(player, fallback) {
    if (!player) return;
    if (typeof player.money !== 'number' || !isFinite(player.money)) {
      console.error('[money] Invalid money for player', player.id, ':', player.money);
      player.money = typeof fallback === 'number' && isFinite(fallback) ? fallback : 0;
    }
  }

  // Settle a mandatory payment. This must never silently fail.
  // Strategy (Option A): try normal transfer -> liquidate -> if still short allow debt
  // and let bankruptcy resolution run.
  settlePayment(fromId, toId, amount, reason) {
    amount = Number(amount);
    if (!isFinite(amount) || amount <= 0) {
      console.error('[settlePayment] Invalid amount:', amount, 'reason:', reason);
      return false;
    }

    const from = fromId ? this.players[fromId] : null;
    const to = toId ? this.players[toId] : null;

    if (fromId && !from) {
      console.error('[settlePayment] Invalid from player:', fromId);
      return false;
    }
    if (toId && !to) {
      console.error('[settlePayment] Invalid to player:', toId);
      return false;
    }

    if (!from) {
      // Bank paying player: just credit receiver.
      if (to) {
        this._ensureValidMoney(to, 0);
        to.money = Number((to.money + amount).toFixed(2));
        if (!isFinite(to.money)) to.money = 0;
      }
      return true;
    }

    this._ensureValidMoney(from, 0);
    if (to) this._ensureValidMoney(to, 0);

    // Try normal path first.
    if (this.transferMoney(fromId, toId, amount, reason)) {
      return true;
    }

    // Liquidate to cover shortfall.
    const shortfall = Math.max(0, amount - (from.money || 0));
    if (shortfall > 0) {
      this.forceLiquidateAssets(fromId, shortfall);
      this._ensureValidMoney(from, 0);
      if (this.transferMoney(fromId, toId, amount, reason)) {
        return true;
      }
    }

    // Still can't cover: allow debt and let bankruptcy resolution run.
    from.money = Number(((from.money || 0) - amount).toFixed(2));
    if (!isFinite(from.money)) from.money = -amount;
    if (to) {
      to.money = Number(((to.money || 0) + amount).toFixed(2));
      if (!isFinite(to.money)) to.money = 0;
    }
    this.checkBankruptcy(fromId);
    return true;
  }

  buildHotel(playerId, propertyId) {
    const player = this.players[playerId];
    const tile = this.getTile(propertyId);
    if (!player || !tile || tile.type !== TILE_TYPES.PROPERTY) return false;
    const own = player.ownedProperties[propertyId];
    if (!own || own.hotel || own.houses < 4) return false;
    
    // CRITICAL: Validate cost and money are numbers
    const cost = Number(tile.hotelPrice);
    if (!isFinite(cost) || cost <= 0) return false;
    
    // CRITICAL: Ensure money is valid
    if (typeof player.money !== 'number' || !isFinite(player.money)) {
      console.error('[buildHotel] Invalid player.money:', player.money);
      player.money = 0;
    }
    
    if (player.money < cost) return false;
    
    // CRITICAL: Use transferMoney for consistency and validation
    const success = this.transferMoney(playerId, null, cost, 'build_hotel');
    if (success) {
      own.hotel = true;
      this.checkBankruptcy(playerId);
      return true;
    }
    return false;
  }

  transferMoney(fromId, toId, amount, reason) {
    // CRITICAL: Ensure amount is a valid number
    amount = Number(amount);
    if (!isFinite(amount) || amount <= 0) {
      console.error('[transferMoney] Invalid amount:', amount, 'for reason:', reason);
      return false;
    }
    
    const from = fromId ? this.players[fromId] : null;
    const to = toId ? this.players[toId] : null;
    
    // CRITICAL: Validate players exist
    if (fromId && !from) {
      console.error('[transferMoney] Invalid from player:', fromId);
      return false;
    }
    if (toId && !to) {
      console.error('[transferMoney] Invalid to player:', toId);
      return false;
    }
    
    if (from) {
      // CRITICAL: Ensure money is always a number
      if (typeof from.money !== 'number' || !isFinite(from.money)) {
        console.error('[transferMoney] Invalid from.money:', from.money, 'for player', fromId, '- resetting to 1500');
        from.money = 1500;
      }
      
      // CRITICAL: Prevent negative money transfers
      if (from.money < amount) {
        console.error('[transferMoney] Insufficient funds:', fromId, 'has', from.money, 'needs', amount);
        return false;
      }
      
      from.money = Number((from.money - amount).toFixed(2));
      // Ensure money never becomes null/undefined/NaN
      if (!isFinite(from.money)) {
        console.error('[transferMoney] Money became invalid after transfer:', from.money, 'for player', fromId);
        from.money = 0;
      }
      this.checkBankruptcy(fromId);
    }
    if (to) {
      // CRITICAL: Ensure money is always a number
      if (typeof to.money !== 'number' || !isFinite(to.money)) {
        console.error('[transferMoney] Invalid to.money:', to.money, 'for player', toId, '- resetting to 0');
        to.money = 0;
      }
      to.money = Number((to.money + amount).toFixed(2));
      // Ensure money never becomes null/undefined/NaN
      if (!isFinite(to.money)) {
        console.error('[transferMoney] Money became invalid after transfer:', to.money, 'for player', toId);
        to.money = 0;
      }
    }
    
    return true; // CRITICAL: Return success/failure status
  }

  drawChanceCard() {
    if (this.currentChanceIndex >= this.chanceDeck.length) {
      this.chanceDeck = shuffle(BASE_CHANCE_CARDS);
      this.currentChanceIndex = 0;
    }
    const card = this.chanceDeck[this.currentChanceIndex];
    this.currentChanceIndex += 1;
    return card;
  }

  movePlayer(playerId, delta) {
    const player = this.players[playerId];
    if (!player) return null;
    
    // CRITICAL: Validate delta is a number
    if (!isFinite(delta)) {
      console.error('[movePlayer] Invalid delta:', delta, 'for player', playerId);
      return null;
    }
    
    let newPos = player.position + delta;
    while (newPos >= TOTAL_TILES) {
      newPos -= TOTAL_TILES;
      const startTile = this.getTile(0);
      // CRITICAL: Validate salary is a number and use transferMoney for consistency
      const salary = Number(startTile.salary || 200);
      if (isFinite(salary) && salary > 0) {
        this.transferMoney(null, playerId, salary, 'salary');
      }
    }
    while (newPos < 0) {
      newPos += TOTAL_TILES;
    }
    
    // CRITICAL: Ensure position is always a valid number
    player.position = isFinite(newPos) ? newPos : 0;
    return this.getTile(player.position);
  }

  sendFullState() {
    this.io.emit('state_update', this.serialize());
  }

  serialize() {
    // CRITICAL: Deep copy players to prevent mutation issues
    // Ensure all money values are valid numbers
    const safePlayers = {};
    Object.entries(this.players).forEach(([id, player]) => {
      safePlayers[id] = {
        ...player,
        money: typeof player.money === 'number' && isFinite(player.money) 
          ? Number(player.money.toFixed(2)) 
          : 1500, // Fallback to starting amount if invalid
      };
      // Ensure all numeric fields are safe
      if (!isFinite(safePlayers[id].position)) safePlayers[id].position = 0;
      if (!isFinite(safePlayers[id].jailTurns)) safePlayers[id].jailTurns = 0;
    });
    
    return {
      players: safePlayers,
      turnOrder: this.turnOrder,
      currentTurnIndex: this.currentTurnIndex,
      currentPlayerId: this.currentPlayerId,
      started: this.started,
      hostId: this.hostId,
      board: BOARD,
      lastDice: this.lastDice,
      // Include turn state for client-side button management
      hasRolledThisTurn: this.hasRolledThisTurn,
      hasBoughtThisTurn: this.hasBoughtThisTurn,
      hasStartedAuctionThisTurn: this.hasStartedAuctionThisTurn,
      // Include ready players for lobby UI
      readyPlayers: Array.from(this.readyPlayers),
    };
  }

  rollAndMove(playerId) {
    if (!this.assertTurn(playerId)) return null;
    // CRITICAL: Prevent multiple rolls per turn
    if (this.hasRolledThisTurn) return null;
    const player = this.players[playerId];
    if (!player || player.inJail) return null;

    const dice = rollDice();
    this.lastDice = dice;
    this.hasRolledThisTurn = true; // Lock roll for this turn
    const tile = this.movePlayer(playerId, dice.total);
    const events = this.resolveTile(playerId, tile, dice.total);
    return { dice, tile, events };
  }

  resolveTile(playerId, tile, diceTotal) {
    const events = [];
    const player = this.players[playerId];
    if (!player || !tile) return events;

    switch (tile.type) {
      case TILE_TYPES.START:
        // No extra effect beyond salary handled on passing
        break;
      case TILE_TYPES.TAX: {
        const amount = tile.amount || 100;
        this.settlePayment(playerId, null, amount, 'tax');
        events.push({ type: 'tax', amount });
        break;
      }
      case TILE_TYPES.JAIL:
        // Visiting only
        break;
      case TILE_TYPES.GOTO_JAIL: {
        this.sendToJail(playerId);
        events.push({ type: 'goto_jail' });
        break;
      }
      case TILE_TYPES.CHANCE: {
        const card = this.drawChanceCard();
        events.push({ type: 'chance', card });
        this.applyChanceCard(playerId, card);
        break;
      }
      case TILE_TYPES.VACATION:
        events.push({ type: 'vacation' });
        break;
      case TILE_TYPES.PROPERTY:
      case TILE_TYPES.AIRPORT:
      case TILE_TYPES.UTILITY: {
        const ownerId = this.findOwnerOfProperty(tile.id);
        if (!ownerId) {
          events.push({ type: 'unowned_property', propertyId: tile.id });
        } else if (ownerId === playerId) {
          events.push({ type: 'own_property', propertyId: tile.id });
        } else {
          const owner = this.players[ownerId];
          let rent = calculateRent(tile.id, owner, this, diceTotal);
          if (rent > 0) {
            // Bankruptcy safety: cap rent at 85% of total asset value
            const totalAssets = this.calculateTotalAssetValue(player);
            const maxRent = Math.floor(totalAssets * 0.85);
            if (rent > maxRent) {
              // Trigger forced liquidation before paying
              this.forceLiquidateAssets(playerId, rent - maxRent);
              rent = maxRent;
            }
            this.settlePayment(playerId, ownerId, rent, 'rent');
            events.push({ type: 'rent_paid', to: ownerId, amount: rent, propertyId: tile.id });
          }
        }
        break;
      }
      default:
        break;
    }

    return events;
  }

  sendToJail(playerId) {
    const player = this.players[playerId];
    if (!player) return;
    player.inJail = true;
    player.jailTurns = 2;
    const jailTile = BOARD.find((t) => t.type === TILE_TYPES.JAIL);
    if (jailTile) {
      player.position = jailTile.id;
    }
  }

  payJailFine(playerId) {
    const player = this.players[playerId];
    if (!player || !player.inJail) return false;
    
    const fine = 100;
    const success = this.settlePayment(playerId, null, fine, 'jail_fine');
    if (success) {
      player.inJail = false;
      player.jailTurns = 0;
      this.checkBankruptcy(playerId);
      return true;
    }
    return false;
  }

  endTurn(playerId) {
    if (!this.assertTurn(playerId)) return false;
    const player = this.players[playerId];
    if (player && player.inJail) {
      player.jailTurns -= 1;
      if (player.jailTurns <= 0) {
        player.inJail = false;
      }
    }
    if (this.turnOrder.length === 0) return false;
    // CRITICAL: Reset per-turn action flags when turn advances
    this.hasRolledThisTurn = false;
    this.hasBoughtThisTurn = false;
    this.hasStartedAuctionThisTurn = false;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    return true;
  }

  applyChanceCard(playerId, card) {
    const player = this.players[playerId];
    if (!player) return;
    
    if (card.type === 'money') {
      const amount = Number(card.amount);
      if (!isFinite(amount)) {
        console.error('[applyChanceCard] Invalid amount:', amount);
        return;
      }
      
      if (amount > 0) {
        // CRITICAL: Use transferMoney for consistency
        this.transferMoney(null, playerId, amount, 'chance_gain');
      } else {
        this.settlePayment(playerId, null, -amount, 'chance_loss');
      }
    } else if (card.type === 'move') {
      const delta = Number(card.delta);
      if (!isFinite(delta)) {
        console.error('[applyChanceCard] Invalid delta:', delta);
        return;
      }
      const tile = this.movePlayer(playerId, delta);
      this.resolveTile(playerId, tile, null);
    } else if (card.type === 'goto' && card.targetType === 'jail') {
      this.sendToJail(playerId);
    }
  }

  findOwnerOfProperty(propertyId) {
    for (const p of Object.values(this.players)) {
      if (p.ownedProperties[propertyId]) return p.id;
    }
    return null;
  }

  calculateTotalAssetValue(player) {
    if (!player) return 0;
    let total = player.money || 0;
    Object.entries(player.ownedProperties || {}).forEach(([propId, own]) => {
      const tile = this.getTile(Number(propId));
      if (!tile) return;
      total += tile.mortgageValue || Math.round(tile.price * 0.5);
      if (tile.type === TILE_TYPES.PROPERTY) {
        if (own.hotel) {
          total += Math.round((tile.hotelPrice || Math.round(tile.price * 0.9)) * 0.5);
        } else if (own.houses) {
          total += Math.round((tile.housePrice || Math.round(tile.price * 0.55)) * 0.5 * (own.houses || 0));
        }
      }
    });
    return total;
  }

  forceLiquidateAssets(playerId, targetAmount) {
    const player = this.players[playerId];
    if (!player) return;
    this._ensureValidMoney(player, 0);
    let liquidated = 0;
    const props = Object.entries(player.ownedProperties);
    // Sell houses/hotels first
    props
      .sort(([aId], [bId]) => Number(bId) - Number(aId))
      .forEach(([pid, state]) => {
        const tile = this.getTile(Number(pid));
        if (!tile || liquidated >= targetAmount) return;
        if (state.hotel) {
          const value = Math.round((tile.hotelPrice || Math.round(tile.price * 0.9)) * 0.5);
          player.money = Number(((player.money || 0) + value).toFixed(2));
          if (!isFinite(player.money)) player.money = 0;
          liquidated += value;
          state.hotel = false;
        }
        while (state.houses > 0 && liquidated < targetAmount) {
          const value = Math.round((tile.housePrice || Math.round(tile.price * 0.55)) * 0.5);
          player.money = Number(((player.money || 0) + value).toFixed(2));
          if (!isFinite(player.money)) player.money = 0;
          liquidated += value;
          state.houses -= 1;
        }
      });
    // Sell properties if still needed
    props.forEach(([pid]) => {
      const tile = this.getTile(Number(pid));
      if (!tile || liquidated >= targetAmount) return;
      const value = tile.mortgageValue || Math.round(tile.price * 0.5);
      player.money = Number(((player.money || 0) + value).toFixed(2));
      if (!isFinite(player.money)) player.money = 0;
      liquidated += value;
      delete player.ownedProperties[pid];
    });
  }

  checkBankruptcy(playerId) {
    const player = this.players[playerId];
    if (!player) return;
    this._ensureValidMoney(player, 0);
    if (player.money >= 0) return;

    // Automatic debt resolution: sell houses, then properties
    const props = Object.entries(player.ownedProperties);
    // Sell houses first (highest rent ones first)
    props
      .sort(([aId], [bId]) => Number(bId) - Number(aId))
      .forEach(([pid, state]) => {
        const tile = this.getTile(Number(pid));
        if (!tile || player.money >= 0) return;
        while (state.hotel && player.money < 0) {
          player.money = Number(((player.money || 0) + Math.round(tile.hotelPrice * 0.5)).toFixed(2));
          if (!isFinite(player.money)) player.money = 0;
          state.hotel = false;
        }
        while (state.houses > 0 && player.money < 0) {
          player.money = Number(((player.money || 0) + Math.round(tile.housePrice * 0.5)).toFixed(2));
          if (!isFinite(player.money)) player.money = 0;
          state.houses -= 1;
        }
      });

    // Sell properties entirely if still in debt
    props.forEach(([pid]) => {
      const tile = this.getTile(Number(pid));
      if (!tile || player.money >= 0) return;
      player.money = Number(((player.money || 0) + (tile.mortgageValue || Math.round(tile.price * 0.5))).toFixed(2));
      if (!isFinite(player.money)) player.money = 0;
      delete player.ownedProperties[pid];
    });

    if (player.money < 0) {
      // Bankrupt
      Object.keys(player.ownedProperties).forEach((pid) => {
        delete player.ownedProperties[pid];
      });
      player.bankrupt = true;
      this.turnOrder = this.turnOrder.filter((id) => id !== playerId);
      if (this.currentTurnIndex >= this.turnOrder.length) {
        this.currentTurnIndex = 0;
      }
      this.io.emit('player_bankrupt', { playerId });
    }
  }
}

module.exports = GameState;


