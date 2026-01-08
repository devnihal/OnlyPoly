// Client game logic & networking for ONLYPOLY

(function () {
  const socket = io();

  const nameInput = document.getElementById('nameInput');
  const joinBtn = document.getElementById('joinBtn');
  const lobbyStatus = document.getElementById('lobbyStatus');
  const lobbyPlayers = document.getElementById('lobbyPlayers');
  const readyToggle = document.getElementById('readyToggle');
  const startGameBtn = document.getElementById('startGameBtn');
  const gamePanel = document.getElementById('gamePanel');
  const turnLabel = document.getElementById('turnLabel');
  const moneyDisplay = document.getElementById('moneyDisplay');
  const positionDisplay = document.getElementById('positionDisplay');
  const rollBtn = document.getElementById('rollBtn');
  const endTurnBtn = document.getElementById('endTurnBtn');
  const buyBtn = document.getElementById('buyBtn');
  const auctionBtn = document.getElementById('auctionBtn');
  const payJailBtn = document.getElementById('payJailBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const lobbyPanel = document.getElementById('lobbyPanel');

  const auctionModal = document.getElementById('auctionModal');
  const auctionInfo = document.getElementById('auctionInfo');
  const auctionTimer = document.getElementById('auctionTimer');
  const tradeModal = document.getElementById('tradeModal');
  const tradeContent = document.getElementById('tradeContent');
  const colorSelection = document.getElementById('colorSelection');
  const colorGrid = document.getElementById('colorGrid');
  const playersInfoRow = document.getElementById('playersInfoRow');
  const diceContainer = document.getElementById('diceContainer');
  const dice1 = document.getElementById('dice1');
  const dice2 = document.getElementById('dice2');

  // New menu elements
  const menuToggle = document.getElementById('menuToggle');
  const secondaryMenu = document.getElementById('secondaryMenu');
  const closeSecondaryMenu = document.getElementById('closeSecondaryMenu');
  const propertiesBtn = document.getElementById('propertiesBtn');
  const playersBtn = document.getElementById('playersBtn');
  const propertiesCount = document.getElementById('propertiesCount');
  const propertiesPanel = document.getElementById('propertiesPanel');
  const closeProperties = document.getElementById('closeProperties');
  const propertiesList = document.getElementById('propertiesList');
  const propertiesTitle = document.querySelector('.properties-panel-title');

  let me = { id: null, token: null, hostId: null };
  let state = null;
  let ready = false;
  let currentAuction = null;
  let auctionInterval = null;

  // CRITICAL: Add debounced resize handler for stable board scaling
  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Board scales automatically via CSS, no manual intervention needed
      console.log('[resize] Board scaled via CSS responsive design');
    }, 250);
  });

  // Available player colors (colorblind-safe, high contrast)
  const PLAYER_COLORS = [
    { name: 'Cyan', value: '#00d2ff' },
    { name: 'Pink', value: '#ff4b81' },
    { name: 'Gold', value: '#f1c40f' },
    { name: 'Green', value: '#2ecc71' },
    { name: 'Purple', value: '#9b59b6' },
    { name: 'Orange', value: '#e67e22' },
    { name: 'Blue', value: '#3498db' },
    { name: 'Red', value: '#e74c3c' },
  ];

  joinBtn.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    if (!name) return;
    socket.emit('join_lobby', { name });
  });

  readyToggle.addEventListener('click', () => {
    if (readyToggle.disabled) return;
    ready = !ready;
    socket.emit('set_ready', { ready });
    readyToggle.textContent = ready ? 'Ready ✓' : 'Ready';
    readyToggle.classList.toggle('btn-ready', ready);
  });

  startGameBtn.addEventListener('click', () => {
    if (me.id !== me.hostId) return;
    socket.emit('start_game');
  });

  rollBtn.addEventListener('click', () => {
    // Prevent double-clicks and spam
    if (rollBtn.disabled) return;
    rollBtn.disabled = true;
    rollBtn.textContent = 'Rolling...';
    // CRITICAL: Start animation immediately (will show random values)
    // Server will send actual values which we'll animate to
    animateDiceRoll();
    socket.emit('roll_dice');
  });

  endTurnBtn.addEventListener('click', () => {
    if (endTurnBtn.disabled) return;
    endTurnBtn.disabled = true;
    socket.emit('end_turn');
  });

  buyBtn.addEventListener('click', () => {
    if (buyBtn.disabled) return;
    const myPlayer = state?.players[me.id];
    if (!myPlayer) return;
    const tileId = myPlayer.position;
    buyBtn.disabled = true;
    socket.emit('buy_property', { propertyId: tileId });
  });

  auctionBtn.addEventListener('click', () => {
    if (auctionBtn.disabled) return;
    const myPlayer = state?.players[me.id];
    if (!myPlayer) return;
    const tileId = myPlayer.position;
    auctionBtn.disabled = true;
    socket.emit('start_auction', { propertyId: tileId });
  });

  payJailBtn.addEventListener('click', () => {
    socket.emit('pay_jail_fine');
  });

  tradeBtn.addEventListener('click', () => {
    openTradeComposer();
  });

  // Menu toggle functionality
  menuToggle?.addEventListener('click', () => {
    secondaryMenu.classList.remove('hidden');
  });

  closeSecondaryMenu?.addEventListener('click', () => {
    secondaryMenu.classList.add('hidden');
  });

  secondaryMenu?.addEventListener('click', (e) => {
    if (e.target === secondaryMenu || e.target.classList.contains('secondary-menu-backdrop')) {
      secondaryMenu.classList.add('hidden');
    }
  });

  propertiesBtn?.addEventListener('click', () => {
    secondaryMenu.classList.add('hidden');
    propertiesPanel.classList.remove('hidden');
    renderPropertiesPanel();
  });

  closeProperties?.addEventListener('click', () => {
    propertiesPanel.classList.add('hidden');
  });

  propertiesPanel?.addEventListener('click', (e) => {
    if (e.target === propertiesPanel || e.target.classList.contains('properties-panel-backdrop')) {
      propertiesPanel.classList.add('hidden');
    }
  });

  playersBtn?.addEventListener('click', () => {
    secondaryMenu.classList.add('hidden');
    // TODO: Implement players info modal
    toast('Players info coming soon!');
  });

  auctionModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('bid')) {
      const step = Number(e.target.getAttribute('data-step'));
      socket.emit('auction_bid', { step });
    }
  });

  socket.on('joined', (payload) => {
    me = { id: payload.playerId, token: payload.token, hostId: payload.hostId };
    lobbyStatus.hidden = false;
    lobbyPanel.classList.remove('hidden');
    renderColorSelection();
  });

  socket.on('color_rejected', ({ reason }) => {
    if (reason === 'color_taken') {
      OnlypolyUI.toast('Color already taken. Choose another.', 'rent');
    }
  });

  socket.on('state_update', (newState) => {
    state = newState;
    OnlypolyUI.setBoard(state.board);
    OnlypolyUI.renderPlayers(state.players, state.currentPlayerId);
    renderLobby();
    renderGame();
  });

  socket.on('dice_rolled', ({ playerId, dice, tile, events }) => {
    const meTurn = playerId === me.id;
    // Show dice result visually (animation already triggered by button click)
    showDiceResult(dice.d1, dice.d2);
    if (meTurn) {
      OnlypolyUI.toast(`Moved ${dice.total} spaces`, 'chance');
    }
    events.forEach((ev) => {
      if (ev.type === 'rent_paid' && meTurn) {
        OnlypolyUI.toast(`Paid $${ev.amount} in rent.`, 'rent');
      }
      if (ev.type === 'chance' && meTurn) {
        OnlypolyUI.toast(ev.card.text, 'chance');
      }
      // Re-enable buy/auction buttons if property is unowned
      if (ev.type === 'unowned_property' && meTurn) {
        buyBtn.disabled = false;
        auctionBtn.disabled = false;
      }
    });
    // Update UI after roll
    renderGame();
  });

  socket.on('action_rejected', ({ reason }) => {
    // Handle server-side rejections gracefully
    if (reason === 'already_rolled') {
      OnlypolyUI.toast('You have already rolled this turn.', 'rent');
    } else if (reason === 'must_roll_first') {
      OnlypolyUI.toast('You must roll dice before ending turn.', 'rent');
    } else if (reason === 'already_bought' || reason === 'auction_started' || reason === 'auction_already_started') {
      OnlypolyUI.toast('Action not available.', 'rent');
    } else if (reason === 'cannot_start_auction') {
      OnlypolyUI.toast('Cannot start auction right now.', 'rent');
    } else if (reason === 'invalid_bid_step') {
      OnlypolyUI.toast('Invalid bid amount.', 'rent');
    } else if (reason === 'bid_rejected') {
      OnlypolyUI.toast('Bid rejected (not enough money or auction ended).', 'rent');
    } else if (reason === 'not_owner') {
      OnlypolyUI.toast('You do not own this property.', 'rent');
    } else if (reason === 'not_your_turn') {
      OnlypolyUI.toast('It is not your turn.', 'rent');
    } else if (reason === 'cannot_build') {
      OnlypolyUI.toast('Cannot build on this property.', 'rent');
    } else if (reason === 'cannot_pay_fine') {
      OnlypolyUI.toast('Insufficient funds to pay jail fine.', 'rent');
    } else if (reason === 'too_fast') {
      OnlypolyUI.toast('Please wait before rolling again.', 'rent');
    } else if (reason === 'purchase_failed') {
      OnlypolyUI.toast('Purchase failed. Please try again.', 'rent');
    }
    renderGame(); // Refresh button states
  });

  socket.on('auction_started', (auction) => {
    currentAuction = auction;
    showAuctionModal();
  });

  socket.on('auction_updated', (auction) => {
    currentAuction = auction;
    renderAuction();
  });

  socket.on('auction_finished', (auction) => {
    currentAuction = auction;
    renderAuction();
    setTimeout(hideAuctionModal, 800);
  });

  socket.on('trade_offer', (trade) => {
    openTradeReview(trade);
  });

  socket.on('trade_updated', () => {
    closeTradeModal();
  });

  function renderLobby() {
    if (!state) return;
    lobbyPlayers.innerHTML = '';
    const readySet = new Set(state.readyPlayers || []);
    Object.values(state.players || {}).forEach((p) => {
      const pill = document.createElement('div');
      pill.className = 'pill';
      const isReady = readySet.has(p.id);
      if (isReady) {
        pill.classList.add('pill-ready');
        pill.textContent = `${p.name} ✓`;
      } else {
        pill.textContent = `${p.name} (not ready)`;
      }
      lobbyPlayers.appendChild(pill);
    });
    const playerCount = Object.keys(state.players || {}).length;
    const readyCount = readySet.size;
    const canStart = !state.started && playerCount >= 2 && readyCount >= 2 && me.id === state.hostId;
    startGameBtn.disabled = !canStart;
    if (canStart) {
      startGameBtn.classList.add('btn-primary-glow');
    } else {
      startGameBtn.classList.remove('btn-primary-glow');
    }
  }

  function renderGame() {
    if (!state) return;
    if (!state.started) {
      gamePanel.classList.add('hidden');
      lobbyPanel.classList.remove('hidden');
      menuToggle?.classList.add('hidden');
      return;
    }
    lobbyPanel.classList.add('hidden');
    gamePanel.classList.remove('hidden');
    menuToggle?.classList.remove('hidden');

    const myPlayer = state.players[me.id];
    const current = state.players[state.currentPlayerId];
    if (current) {
      turnLabel.textContent =
        current.id === me.id ? 'Your turn' : `${current.name}'s turn`;
    }

    if (myPlayer) {
      moneyDisplay.textContent = `$${myPlayer.money}`;
      positionDisplay.textContent = `Tile ${myPlayer.position}`;
    }

    const isMyTurn = state.currentPlayerId === me.id;
    const hasRolled = state.hasRolledThisTurn || false;
    const hasBought = state.hasBoughtThisTurn || false;
    const hasAuction = state.hasStartedAuctionThisTurn || false;

    // Roll button: only enabled if it's my turn AND I haven't rolled
    rollBtn.disabled = !isMyTurn || hasRolled;
    rollBtn.textContent = hasRolled ? 'Rolled' : 'Roll';

    // End turn: enabled if it's my turn AND I've rolled (or in jail)
    endTurnBtn.disabled = !isMyTurn || (!hasRolled && !myPlayer?.inJail);

    // Buy/Auction: only enabled if it's my turn, I've rolled, and haven't bought/auctioned
    const canBuyOrAuctionBase = isMyTurn && hasRolled && !hasBought && !hasAuction;
    let canBuyOrAuction = canBuyOrAuctionBase;
    if (canBuyOrAuctionBase && myPlayer) {
      const tileId = Number(myPlayer.position);
      const tile = (state.board || []).find((t) => t.id === tileId) || null;
      const isBuyable = tile && (tile.type === 'property' || tile.type === 'airport' || tile.type === 'utility');
      // Determine ownership by scanning players' ownedProperties (server is source of truth)
      let isOwned = false;
      if (isBuyable) {
        Object.values(state.players || {}).some((p) => {
          if (p?.ownedProperties && p.ownedProperties[String(tileId)]) {
            isOwned = true;
            return true;
          }
          return false;
        });
      }
      canBuyOrAuction = isBuyable && !isOwned;
    }

    buyBtn.disabled = !canBuyOrAuction;
    auctionBtn.disabled = !canBuyOrAuction;

    // Pay jail: only if it's my turn and I'm in jail
    payJailBtn.disabled = !isMyTurn || !myPlayer?.inJail;

    // Trade: always available (doesn't require turn)
    tradeBtn.disabled = false;

    // Update properties count
    const ownedProperties = Object.keys(myPlayer?.ownedProperties || {}).length;
    if (propertiesCount) {
      propertiesCount.textContent = `(${ownedProperties})`;
    }
  }

  function showAuctionModal() {
    auctionModal.classList.remove('hidden');
    renderAuction();
    if (auctionInterval) clearInterval(auctionInterval);
    auctionInterval = setInterval(() => {
      renderAuction();
    }, 200);
  }

  function hideAuctionModal() {
    auctionModal.classList.add('hidden');
    if (auctionInterval) clearInterval(auctionInterval);
    auctionInterval = null;
    currentAuction = null;
  }

  function renderAuction() {
    if (!currentAuction) return;
    const prop = state.board.find((t) => t.id === currentAuction.propertyId);
    const bidder =
      state.players[currentAuction.highestBidder || ''] || null;
    auctionInfo.textContent = `${prop ? prop.name : 'Property'
      } – $${currentAuction.highestBid || 0} ${bidder ? `by ${bidder.name}` : ''
      }`;
    const remaining = Math.max(0, currentAuction.endsAt - Date.now());
    auctionTimer.textContent = `${Math.ceil(remaining / 1000)}s remaining`;
  }

  function openTradeComposer() {
    if (!state) return;
    const myPlayer = state.players[me.id];
    if (!myPlayer) return;

    const others = Object.values(state.players).filter(
      (p) => p.id !== me.id && !p.bankrupt
    );
    if (!others.length) {
      OnlypolyUI.toast('No one available to trade with.');
      return;
    }

    let partnerId = others[0].id;
    let moneyDelta = 0; // + => you give money, - => you take money
    const offerProps = new Set();
    const requestProps = new Set();

    function getTileById(id) {
      return (state.board || []).find((t) => t.id === Number(id)) || null;
    }

    function getOwnedTileIds(player) {
      return Object.keys(player?.ownedProperties || {}).map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }

    function formatMoneyLine(delta) {
      const d = Number(delta) || 0;
      if (d > 0) return `You give $${d}`;
      if (d < 0) return `You take $${Math.abs(d)}`;
      return 'No money exchanged';
    }

    function computeLimits() {
      const partner = state.players[partnerId];
      const maxGive = Math.max(0, Math.floor(myPlayer.money || 0));
      const maxTake = Math.max(0, Math.floor(partner?.money || 0));
      return { maxGive, maxTake };
    }

    function renderTradeComposer() {
      const partner = state.players[partnerId];
      if (!partner) return;

      const { maxGive, maxTake } = computeLimits();
      // Clamp moneyDelta in case partner changed
      moneyDelta = Math.max(-maxTake, Math.min(maxGive, moneyDelta));

      tradeModal.classList.remove('hidden');
      tradeContent.innerHTML = '';

      const root = document.createElement('div');
      root.className = 'trade-composer';

      const header = document.createElement('div');
      header.className = 'trade-header';

      const title = document.createElement('div');
      title.className = 'trade-title';
      title.textContent = 'Compose Trade';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn ghost small';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = closeTradeModal;

      header.appendChild(title);
      header.appendChild(closeBtn);
      root.appendChild(header);

      const partnerRow = document.createElement('div');
      partnerRow.className = 'trade-partner-row';

      const partnerLabel = document.createElement('div');
      partnerLabel.className = 'trade-muted';
      partnerLabel.textContent = 'Trading with';

      const select = document.createElement('select');
      select.className = 'trade-select';
      others.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} ($${p.money})`;
        select.appendChild(opt);
      });
      select.value = partnerId;
      select.onchange = () => {
        partnerId = select.value;
        offerProps.clear();
        requestProps.clear();
        moneyDelta = 0;
        renderTradeComposer();
      };

      partnerRow.appendChild(partnerLabel);
      partnerRow.appendChild(select);
      root.appendChild(partnerRow);

      const moneyBox = document.createElement('div');
      moneyBox.className = 'trade-money-box';

      const moneyLine = document.createElement('div');
      moneyLine.className = 'trade-money-line';
      moneyLine.textContent = formatMoneyLine(moneyDelta);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'trade-slider';
      slider.min = String(-maxTake);
      slider.max = String(maxGive);
      slider.step = '10';
      slider.value = String(moneyDelta);
      slider.oninput = () => {
        moneyDelta = Number(slider.value) || 0;
        moneyLine.textContent = formatMoneyLine(moneyDelta);
      };

      const moneyCaps = document.createElement('div');
      moneyCaps.className = 'trade-money-caps';
      moneyCaps.textContent = `Take up to $${maxTake} • Give up to $${maxGive}`;

      moneyBox.appendChild(moneyLine);
      moneyBox.appendChild(slider);
      moneyBox.appendChild(moneyCaps);
      root.appendChild(moneyBox);

      const split = document.createElement('div');
      split.className = 'trade-split';

      function renderSide(sideEl, whoLabel, whoMoney, tileIds, setRef, color) {
        sideEl.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'trade-side-header';
        h.style.setProperty('--trade-accent', color);

        const nameEl = document.createElement('div');
        nameEl.className = 'trade-side-name';
        nameEl.textContent = whoLabel;
        const moneyEl = document.createElement('div');
        moneyEl.className = 'trade-side-money';
        moneyEl.textContent = `$${whoMoney}`;
        h.appendChild(nameEl);
        h.appendChild(moneyEl);
        sideEl.appendChild(h);

        const list = document.createElement('div');
        list.className = 'trade-props';

        if (!tileIds.length) {
          const empty = document.createElement('div');
          empty.className = 'trade-muted';
          empty.textContent = 'No properties';
          list.appendChild(empty);
        } else {
          tileIds
            .slice()
            .sort((a, b) => a - b)
            .forEach((pid) => {
              const tile = getTileById(pid);
              const row = document.createElement('label');
              row.className = 'trade-prop-row';

              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = setRef.has(pid);
              cb.onchange = () => {
                if (cb.checked) setRef.add(pid);
                else setRef.delete(pid);
              };

              const meta = document.createElement('div');
              meta.className = 'trade-prop-meta';
              const n = document.createElement('div');
              n.className = 'trade-prop-name';
              n.textContent = tile ? tile.name : `Tile ${pid}`;
              const sub = document.createElement('div');
              sub.className = 'trade-prop-sub';
              sub.textContent = tile?.country || tile?.type || '';
              meta.appendChild(n);
              meta.appendChild(sub);

              row.appendChild(cb);
              row.appendChild(meta);
              list.appendChild(row);
            });
        }

        sideEl.appendChild(list);
      }

      const left = document.createElement('div');
      left.className = 'trade-side';
      const right = document.createElement('div');
      right.className = 'trade-side';

      renderSide(
        left,
        `${myPlayer.name} (you)`,
        myPlayer.money,
        getOwnedTileIds(myPlayer),
        offerProps,
        myPlayer.color || '#00d2ff'
      );
      renderSide(
        right,
        partner.name,
        partner.money,
        getOwnedTileIds(partner),
        requestProps,
        partner.color || '#ff4b81'
      );

      split.appendChild(left);
      split.appendChild(right);
      root.appendChild(split);

      const actions = document.createElement('div');
      actions.className = 'trade-actions';
      const send = document.createElement('button');
      send.className = 'btn primary';
      send.textContent = 'Send Offer';
      send.onclick = () => {
        const offerMoney = moneyDelta > 0 ? moneyDelta : 0;
        const requestMoney = moneyDelta < 0 ? Math.abs(moneyDelta) : 0;
        socket.emit('propose_trade', {
          toPlayerId: partnerId,
          offerMoney,
          requestMoney,
          offerProperties: Array.from(offerProps),
          requestProperties: Array.from(requestProps),
        });
        closeTradeModal();
      };

      const cancel = document.createElement('button');
      cancel.className = 'btn ghost';
      cancel.textContent = 'Cancel';
      cancel.onclick = closeTradeModal;

      actions.appendChild(cancel);
      actions.appendChild(send);
      root.appendChild(actions);

      tradeContent.appendChild(root);
    }

    renderTradeComposer();
  }

  function openTradeReview(trade) {
    tradeModal.classList.remove('hidden');
    tradeContent.innerHTML = '';
    const from = state.players[trade.from];
    const to = state.players[trade.to];

    function tileName(pid) {
      const t = (state.board || []).find((x) => x.id === Number(pid));
      return t ? t.name : `Tile ${pid}`;
    }

    const p = document.createElement('div');
    p.className = 'trade-review-title';
    p.textContent = `${from?.name || 'Player'} sent you a trade offer`;

    const details = document.createElement('div');
    details.className = 'trade-review-details';

    const moneyLine = document.createElement('div');
    moneyLine.className = 'trade-review-line';
    const giveMoney = Number(trade.offerMoney) || 0;
    const takeMoney = Number(trade.requestMoney) || 0;
    moneyLine.textContent = `Money: ${giveMoney > 0 ? `${from.name} gives you $${giveMoney}` : ''}${giveMoney > 0 && takeMoney > 0 ? ' • ' : ''}${takeMoney > 0 ? `You give ${from.name} $${takeMoney}` : ''}${giveMoney === 0 && takeMoney === 0 ? 'None' : ''}`;

    const propsLine = document.createElement('div');
    propsLine.className = 'trade-review-line';
    const offerProps = (trade.offerProperties || []).map(tileName);
    const reqProps = (trade.requestProperties || []).map(tileName);
    propsLine.textContent = `Properties: ${offerProps.length ? `You receive: ${offerProps.join(', ')}` : 'You receive: none'}${reqProps.length ? ` • You give: ${reqProps.join(', ')}` : ' • You give: none'}`;

    details.appendChild(moneyLine);
    details.appendChild(propsLine);
    const accept = document.createElement('button');
    accept.className = 'btn primary small';
    accept.textContent = 'Accept';
    accept.onclick = () => {
      socket.emit('accept_trade', { tradeId: trade.id });
      closeTradeModal();
    };
    const reject = document.createElement('button');
    reject.className = 'btn ghost small';
    reject.textContent = 'Reject';
    reject.onclick = () => {
      socket.emit('reject_trade', { tradeId: trade.id });
      closeTradeModal();
    };
    const actions = document.createElement('div');
    actions.className = 'trade-actions';
    actions.appendChild(reject);
    actions.appendChild(accept);

    tradeContent.appendChild(p);
    tradeContent.appendChild(details);
    tradeContent.appendChild(actions);
  }

  function closeTradeModal() {
    tradeModal.classList.add('hidden');
  }

  // Close trade modal on backdrop click
  tradeModal?.addEventListener('click', (e) => {
    if (e.target === tradeModal || e.target.classList.contains('modal-backdrop')) {
      closeTradeModal();
    }
  });

  function renderPropertiesPanel() {
    if (!state || !me.id || !propertiesList || !propertiesTitle) return;

    const myPlayer = state.players[me.id];
    if (!myPlayer) {
      propertiesPanel?.classList.add('hidden');
      return;
    }

    const ownedProperties = Object.entries(myPlayer.ownedProperties || {});
    const propertyCount = ownedProperties.length;

    // Update title with count
    propertiesTitle.textContent = `Properties (${propertyCount})`;

    // Clear existing properties
    propertiesList.innerHTML = '';

    if (propertyCount === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'properties-empty';
      emptyMessage.textContent = 'No properties owned yet';
      emptyMessage.style.cssText = 'text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;';
      propertiesList.appendChild(emptyMessage);
      return;
    }

    // Sort properties by ID (board order)
    ownedProperties.sort(([a], [b]) => Number(a) - Number(b));

    ownedProperties.forEach(([propertyId, ownership]) => {
      const tile = state.board.find(t => t.id === Number(propertyId));
      if (!tile || tile.type !== 'property') return;

      const propertyCard = document.createElement('div');
      propertyCard.className = 'property-card';
      propertyCard.style.setProperty('--property-color', tile.color || '#666');

      const propertyName = document.createElement('div');
      propertyName.className = 'property-name';
      propertyName.textContent = tile.name;

      const propertyCountry = document.createElement('div');
      propertyCountry.className = 'property-country';
      propertyCountry.textContent = tile.country || '';

      const propertyDevelopment = document.createElement('div');
      propertyDevelopment.className = 'property-development';

      if (ownership.hotel) {
        propertyDevelopment.classList.add('hotel');
        propertyDevelopment.innerHTML = '<span class="hotel-icon">🏨</span> Hotel';
      } else if (ownership.houses > 0) {
        propertyDevelopment.innerHTML = `<span class="house-icon">🏠</span> × ${ownership.houses}`;
      } else {
        propertyDevelopment.textContent = 'Land';
        propertyDevelopment.style.color = 'var(--text-muted)';
      }

      propertyCard.appendChild(propertyName);
      propertyCard.appendChild(propertyCountry);
      propertyCard.appendChild(propertyDevelopment);

      // Add click handler to highlight property without moving board
      propertyCard.addEventListener('click', () => {
        const tileEl = document.querySelector(`[data-tile-id="${propertyId}"]`);
        if (tileEl) {
          // CRITICAL: Do NOT scrollIntoView - it causes board to shift
          // Instead, highlight tile visually without moving viewport
          tileEl.style.transform = 'scale(1.1)';
          tileEl.style.boxShadow = '0 0 20px rgba(0, 210, 255, 0.6)';
          tileEl.style.zIndex = '1000';
          setTimeout(() => {
            tileEl.style.transform = '';
            tileEl.style.boxShadow = '';
            tileEl.style.zIndex = '';
          }, 1000);
        }
      });

      propertiesList.appendChild(propertyCard);
    });
  }

  // Dice animation functions - Exact Reference Implementation
  function animateDiceRoll() {
    if (!dice1 || !dice2) return;

    // Start rolling animation (reference uses style.animation)
    dice1.style.animation = 'rolling 1s';
    dice2.style.animation = 'rolling 1s';
    diceContainer.classList.add('active');
  }

  function showDiceResult(d1, d2) {
    if (!dice1 || !dice2) return;

    console.log(`[DICE] Showing result: d1=${d1}, d2=${d2}, total=${d1 + d2}`);

    // Apply transforms after animation (1050ms to match 1s animation)
    setTimeout(() => {
      rollDice(dice1, d1);
      rollDice(dice2, d2);
      console.log(`[DICE] Transforms applied: ${d1}, ${d2}`);
    }, 1050);
  }

  function rollDice(diceEl, value) {
    // Exact transform mapping from reference
    switch (value) {
      case 1:
        diceEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
        break;
      case 6:
        diceEl.style.transform = 'rotateX(180deg) rotateY(0deg)';
        break;
      case 2:
        diceEl.style.transform = 'rotateX(-90deg) rotateY(0deg)';
        break;
      case 5:
        diceEl.style.transform = 'rotateX(90deg) rotateY(0deg)';
        break;
      case 3:
        diceEl.style.transform = 'rotateX(0deg) rotateY(90deg)';
        break;
      case 4:
        diceEl.style.transform = 'rotateX(0deg) rotateY(-90deg)';
        break;
      default:
        break;
    }

    diceEl.style.animation = 'none';
  }

  function renderPlayersInfo() {
    if (!playersInfoRow) return;
    if (!state || !state.started) {
      playersInfoRow.innerHTML = '';
      return;
    }
    playersInfoRow.innerHTML = '';
    Object.values(state.players || {}).forEach((p) => {
      if (p.bankrupt) return;
      const card = document.createElement('div');
      card.className = 'player-card';
      if (state.currentPlayerId === p.id) {
        card.classList.add('active-turn');
      }
      if (p.color) {
        card.style.borderLeftColor = p.color;
        card.style.borderLeftWidth = '3px';
      }

      const name = document.createElement('div');
      name.className = 'player-card-name';
      name.textContent = p.name;
      if (p.color) {
        name.style.color = p.color;
      }

      const money = document.createElement('div');
      money.className = 'player-card-money';
      money.textContent = `$${p.money}`;
      if (p.money < 200) {
        money.classList.add('low-funds');
      }

      const status = document.createElement('div');
      status.className = 'player-card-status';
      if (p.inJail) {
        status.textContent = '🔒 Jail';
      } else if (p.money < 0) {
        status.textContent = '⚠️ Debt';
      }

      card.appendChild(name);
      card.appendChild(money);
      if (status.textContent) card.appendChild(status);
      playersInfoRow.appendChild(card);
    });
  }

  // Override renderGame to include players info
  const originalRenderGame = renderGame;
  renderGame = function () {
    originalRenderGame();
    renderPlayersInfo();
  };
})();


