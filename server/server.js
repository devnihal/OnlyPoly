const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const GameState = require('./gameState');
const AuctionSystem = require('./auctionSystem');
const TradeSystem = require('./tradeSystem');
const { generateToken } = require('./utils');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const CLIENT_DIR = path.join(__dirname, '..', 'client');
app.use(express.static(CLIENT_DIR));

const gameStatePlaceholder = {};
const auctionSystem = new AuctionSystem(io, gameStatePlaceholder);
const gameState = new GameState(io, auctionSystem);
auctionSystem.gameState = gameState;
const tradeSystem = new TradeSystem(io, gameState);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

io.on('connection', (socket) => {
  let playerId = null;

  socket.on('reconnect', () => {
    if (playerId) {
      socket.emit('state_update', gameState.serialize());
    }
  });

  socket.on('join_lobby', ({ name }) => {
    if (!name || typeof name !== 'string') return;
    const id = socket.id;
    const token = generateToken();
    const player = gameState.addPlayer(id, name.slice(0, 16), socket.id, token);
    if (!player) return;
    playerId = id;
    socket.emit('joined', { playerId: id, token, hostId: gameState.hostId });
    io.emit('state_update', gameState.serialize());
  });

  socket.on('set_player_color', ({ color }) => {
    if (!playerId || gameState.started) return;
    const ok = gameState.setPlayerColor(playerId, color);
    if (ok) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('color_rejected', { reason: 'color_taken' });
    }
  });

  socket.on('set_ready', ({ ready }) => {
    if (!playerId) return;
    gameState.markReady(playerId, !!ready);
    io.emit('state_update', gameState.serialize());
  });

  socket.on('start_game', () => {
    if (!playerId) return;
    const ok = gameState.startGame(playerId);
    if (!ok) return;
    io.emit('state_update', gameState.serialize());
  });

  socket.on('roll_dice', () => {
    if (!playerId || !gameState.assertTurn(playerId)) return;
    // CRITICAL: Prevent multiple rolls and rapid clicking
    if (gameState.hasRolledThisTurn) {
      socket.emit('action_rejected', { reason: 'already_rolled' });
      return;
    }
    
    // CRITICAL: Add debouncing to prevent rapid clicking
    if (gameState._lastRollTime && (Date.now() - gameState._lastRollTime) < 1000) {
      socket.emit('action_rejected', { reason: 'too_fast' });
      return;
    }
    
    const result = gameState.rollAndMove(playerId);
    if (!result) {
      socket.emit('action_rejected', { reason: 'invalid_roll' });
      return;
    }
    
    gameState._lastRollTime = Date.now();
    io.emit('dice_rolled', { playerId, ...result });
    io.emit('state_update', gameState.serialize());
  });

  socket.on('buy_property', ({ propertyId }) => {
    if (!playerId || !gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    
    // CRITICAL: Validate propertyId is a number
    const propId = Number(propertyId);
    if (!isFinite(propId)) {
      socket.emit('action_rejected', { reason: 'invalid_property' });
      return;
    }
    
    // Prevent buying if already bought this turn
    if (gameState.hasBoughtThisTurn) {
      socket.emit('action_rejected', { reason: 'already_bought' });
      return;
    }
    // Prevent buying if auction was started
    if (gameState.hasStartedAuctionThisTurn) {
      socket.emit('action_rejected', { reason: 'auction_started' });
      return;
    }
    
    const tile = gameState.getTile(propId);
    const player = gameState.players[playerId];
    
    if (!tile || !player) {
      socket.emit('action_rejected', { reason: 'invalid_tile_or_player' });
      return;
    }
    
    // CRITICAL: Strict ownership check - property must be unowned
    const currentOwner = gameState.findOwnerOfProperty(propId);
    if (currentOwner) {
      socket.emit('action_rejected', { reason: 'property_already_owned', owner: currentOwner });
      return;
    }
    
    // CRITICAL: Validate price and money are numbers
    const price = Number(tile.price);
    if (!isFinite(price) || price <= 0) {
      socket.emit('action_rejected', { reason: 'invalid_price' });
      return;
    }
    
    // CRITICAL: Ensure player money is valid number
    if (typeof player.money !== 'number' || !isFinite(player.money)) {
      console.error('[buy_property] Invalid player.money:', player.money);
      player.money = 1500; // Reset to safe value
    }
    
    if (player.money < price) {
      socket.emit('action_rejected', { reason: 'insufficient_funds' });
      return;
    }
    
    // All checks passed - execute purchase
    gameState.hasBoughtThisTurn = true;
    const success = gameState.transferMoney(playerId, null, price, 'purchase');
    if (success) {
      gameState.assignProperty(propId, playerId);
      io.emit('state_update', gameState.serialize());
    } else {
      // Roll back the purchase flag if transfer failed
      gameState.hasBoughtThisTurn = false;
      socket.emit('action_rejected', { reason: 'purchase_failed' });
    }
  });

  socket.on('start_auction', ({ propertyId }) => {
    if (!playerId || !gameState.assertTurn(playerId)) return;
    // Prevent auction if already bought this turn
    if (gameState.hasBoughtThisTurn) {
      socket.emit('action_rejected', { reason: 'already_bought' });
      return;
    }
    // Prevent multiple auctions per turn
    if (gameState.hasStartedAuctionThisTurn) {
      socket.emit('action_rejected', { reason: 'auction_already_started' });
      return;
    }

    const propId = Number(propertyId);
    if (!isFinite(propId)) {
      socket.emit('action_rejected', { reason: 'invalid_property' });
      return;
    }
    if (gameState.findOwnerOfProperty(propId)) {
      socket.emit('action_rejected', { reason: 'property_already_owned' });
      return;
    }
    gameState.hasStartedAuctionThisTurn = true;

    const auction = auctionSystem.startAuction(propId, playerId);
    if (!auction) {
      gameState.hasStartedAuctionThisTurn = false;
      socket.emit('action_rejected', { reason: 'cannot_start_auction' });
    }
  });

  socket.on('auction_bid', ({ step }) => {
    if (!playerId) return;

    const s = Number(step);
    const amount = s === 2 || s === 10 || s === 100 ? s : null;
    if (!amount) {
      socket.emit('action_rejected', { reason: 'invalid_bid_step' });
      return;
    }
    const ok = auctionSystem.placeBid(playerId, amount);
    if (!ok) {
      socket.emit('action_rejected', { reason: 'bid_rejected' });
    }
  });

  socket.on('end_turn', () => {
    if (!playerId || !gameState.assertTurn(playerId)) return;
    // Require roll before ending turn (unless in jail)
    const player = gameState.players[playerId];
    if (!player.inJail && !gameState.hasRolledThisTurn) {
      socket.emit('action_rejected', { reason: 'must_roll_first' });
      return;
    }
    const ok = gameState.endTurn(playerId);
    if (!ok) return;
    io.emit('state_update', gameState.serialize());
  });

  socket.on('pay_jail_fine', () => {
    if (!playerId || !gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    const success = gameState.payJailFine(playerId);
    if (success) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('action_rejected', { reason: 'cannot_pay_fine' });
    }
  });

  socket.on('build_house', ({ propertyId }) => {
    if (!playerId) return;
    // CRITICAL: Building requires turn validation to prevent cheating
    if (!gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    // CRITICAL: Validate property ownership
    if (!gameState.doesPlayerOwnProperty(playerId, propertyId)) {
      socket.emit('action_rejected', { reason: 'not_owner' });
      return;
    }
    // CRITICAL: Validate propertyId is a number
    const propId = Number(propertyId);
    if (!isFinite(propId)) {
      socket.emit('action_rejected', { reason: 'invalid_property' });
      return;
    }
    const success = gameState.buildHouse(playerId, propId);
    if (success) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('action_rejected', { reason: 'cannot_build' });
    }
  });

  socket.on('build_hotel', ({ propertyId }) => {
    if (!playerId) return;
    // CRITICAL: Building requires turn validation to prevent cheating
    if (!gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    // CRITICAL: Validate property ownership
    if (!gameState.doesPlayerOwnProperty(playerId, propertyId)) {
      socket.emit('action_rejected', { reason: 'not_owner' });
      return;
    }
    // CRITICAL: Validate propertyId is a number
    const propId = Number(propertyId);
    if (!isFinite(propId)) {
      socket.emit('action_rejected', { reason: 'invalid_property' });
      return;
    }
    const success = gameState.buildHotel(playerId, propId);
    if (success) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('action_rejected', { reason: 'cannot_build' });
    }
  });

  socket.on('propose_trade', (payload) => {
    if (!playerId) return;
    tradeSystem.createTrade(playerId, payload.toPlayerId, payload);
  });

  socket.on('accept_trade', ({ tradeId }) => {
    if (!playerId) return;
    tradeSystem.acceptTrade(tradeId, playerId);
    io.emit('state_update', gameState.serialize());
  });

  socket.on('reject_trade', ({ tradeId }) => {
    if (!playerId) return;
    tradeSystem.rejectTrade(tradeId, playerId);
  });

  socket.on('disconnect', () => {
    if (!playerId) return;
    gameState.removePlayer(playerId);
    io.emit('state_update', gameState.serialize());
  });
});

// Get local IP address for LAN connections
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
const localIP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🎮 ONLYPOLY SERVER IS RUNNING!');
  console.log('='.repeat(60));
  console.log(`\n📍 Local URL:    http://localhost:${PORT}`);
  console.log(`🌐 Network URL:  http://${localIP}:${PORT}`);
  console.log('\n📱 To join from other devices:');
  console.log(`   Open browser and go to: http://${localIP}:${PORT}`);
  console.log('\n⚠️  Make sure all devices are on the SAME Wi-Fi network!');
  console.log('='.repeat(60) + '\n');
});


