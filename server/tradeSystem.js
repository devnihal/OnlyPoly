// Trading system: properties and money between two players

class TradeSystem {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    this.activeTrades = {}; // tradeId -> trade
  }

  _normalizeMoney(v) {
    const n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  _normalizePropertyIds(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    list.forEach((x) => {
      const n = Number(x);
      if (!isFinite(n)) return;
      if (n < 0 || n > 39) return;
      if (seen.has(n)) return;
      seen.add(n);
      out.push(n);
    });
    return out;
  }

  createTrade(fromPlayerId, toPlayerId, offer) {
    const from = this.gameState.players[fromPlayerId];
    const to = this.gameState.players[toPlayerId];
    if (!from || !to) return null;

    const offerMoney = this._normalizeMoney(offer?.offerMoney);
    const requestMoney = this._normalizeMoney(offer?.requestMoney);
    const offerProperties = this._normalizePropertyIds(offer?.offerProperties);
    const requestProperties = this._normalizePropertyIds(offer?.requestProperties);

    const tradeId = `${Date.now()}-${fromPlayerId}-${toPlayerId}`;
    const normalized = {
      id: tradeId,
      from: fromPlayerId,
      to: toPlayerId,
      offerMoney,
      requestMoney,
      offerProperties,
      requestProperties,
      status: 'pending',
    };

    this.activeTrades[tradeId] = normalized;
    this.io.to(to.socketId).emit('trade_offer', normalized);
    return normalized;
  }

  rejectTrade(tradeId, byPlayerId) {
    const trade = this.activeTrades[tradeId];
    if (!trade || trade.status !== 'pending') return;
    if (trade.to !== byPlayerId && trade.from !== byPlayerId) return;
    trade.status = 'rejected';
    this.io.emit('trade_updated', trade);
    delete this.activeTrades[tradeId];
  }

  acceptTrade(tradeId, byPlayerId) {
    const trade = this.activeTrades[tradeId];
    if (!trade || trade.status !== 'pending') return;
    if (trade.to !== byPlayerId) return;

    const from = this.gameState.players[trade.from];
    const to = this.gameState.players[trade.to];
    if (!from || !to) return;

    // Normalize again defensively (idempotent)
    trade.offerMoney = this._normalizeMoney(trade.offerMoney);
    trade.requestMoney = this._normalizeMoney(trade.requestMoney);
    trade.offerProperties = this._normalizePropertyIds(trade.offerProperties);
    trade.requestProperties = this._normalizePropertyIds(trade.requestProperties);

    if (from.money < trade.offerMoney || to.money < trade.requestMoney) {
      trade.status = 'rejected';
      this.io.emit('trade_updated', trade);
      delete this.activeTrades[tradeId];
      return;
    }

    // Validate property ownership
    const hasAllOffered = trade.offerProperties.every((pid) =>
      this.gameState.doesPlayerOwnProperty(trade.from, pid)
    );
    const hasAllRequested = trade.requestProperties.every((pid) =>
      this.gameState.doesPlayerOwnProperty(trade.to, pid)
    );
    if (!hasAllOffered || !hasAllRequested) {
      trade.status = 'rejected';
      this.io.emit('trade_updated', trade);
      delete this.activeTrades[tradeId];
      return;
    }

    // Execute money transfers
    if (trade.offerMoney > 0) {
      this.gameState.settlePayment(trade.from, trade.to, trade.offerMoney, 'trade_offer');
    }
    if (trade.requestMoney > 0) {
      this.gameState.settlePayment(trade.to, trade.from, trade.requestMoney, 'trade_request');
    }

    // Execute property transfers
    trade.offerProperties.forEach((pid) => {
      this.gameState.assignProperty(pid, trade.to);
    });
    trade.requestProperties.forEach((pid) => {
      this.gameState.assignProperty(pid, trade.from);
    });

    trade.status = 'accepted';
    this.io.emit('trade_updated', trade);
    delete this.activeTrades[tradeId];
  }
}

module.exports = TradeSystem;


