// UI helpers for ONLYPOLY

window.OnlypolyUI = (function () {
  const toastContainer = document.getElementById('toastContainer');
  const boardEl = document.getElementById('board');
  const playersOverlay = document.getElementById('playersOverlay');

  let boardData = [];

  function setBoard(board) {
    boardData = board || [];
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    if (!boardData.length) return;

    // New: deterministic 11x11 perimeter grid (40 cells) so the board is always
    // fully visible, centered, and never relies on scroll/auto-pan.
    boardEl.classList.add('board-grid--perimeter');

    boardData.forEach((tile, index) => {
      const div = document.createElement('div');
      const isCorner = index % 10 === 0;
      div.className = 'tile';
      div.dataset.tileId = tile.id; // CRITICAL: Add tile ID for token binding

      if (tile.group) {
        const countryClass = 'flag-' + tile.group.toLowerCase().replace(/\s+/g, '-');
        div.classList.add(countryClass);
      }

      if (tile.type === 'property') div.classList.add('property');
      if (isCorner) div.classList.add('tile-corner');
      if (tile.type === 'chance') div.classList.add('tile-chance');
      if (tile.type === 'tax') div.classList.add('tile-tax');
      if (tile.type === 'jail' || tile.type === 'goto_jail') div.classList.add('tile-jail');
      if (tile.type === 'vacation') div.classList.add('tile-vacation');

      const pos = getPerimeterGridPos(index);
      if (!pos) return;
      div.style.gridRow = String(pos.row);
      div.style.gridColumn = String(pos.col);

      if (tile.color) {
        const strip = document.createElement('div');
        strip.className = 'tile-strip';
        strip.style.background = tile.color;
        div.appendChild(strip);
      }

      const label = document.createElement('div');
      label.className = 'tile-label';
      label.textContent = tile.name;
      div.appendChild(label);

      // Add price for properties
      if (tile.type === 'property' && tile.price) {
        const price = document.createElement('div');
        price.className = 'tile-price';
        price.textContent = `$${tile.price}`;
        div.appendChild(price);
      }

      // Add icons for special tiles
      if (tile.type === 'airport') {
        const icon = document.createElement('div');
        icon.textContent = '✈';
        icon.style.fontSize = '14px';
        icon.style.marginTop = '2px';
        div.appendChild(icon);
      } else if (tile.type === 'utility') {
        const icon = document.createElement('div');
        icon.textContent = '⚡';
        icon.style.fontSize = '14px';
        icon.style.marginTop = '2px';
        div.appendChild(icon);
      } else if (tile.type === 'chance') {
        const icon = document.createElement('div');
        icon.textContent = '?';
        icon.style.fontSize = '16px';
        icon.style.fontWeight = '700';
        icon.style.marginTop = '2px';
        div.appendChild(icon);
      }

      // Add development indicator container
      if (tile.type === 'property') {
        const developmentContainer = document.createElement('div');
        developmentContainer.className = 'tile-development-container';
        div.appendChild(developmentContainer);
      }

      boardEl.appendChild(div);
    });
  }

  // Map tile index (0..39) to an 11x11 perimeter grid position.
  // Orientation: index 0 starts at bottom-right corner and moves counter-clockwise.
  function getPerimeterGridPos(index) {
    const i = Number(index);
    if (!Number.isFinite(i) || i < 0 || i > 39) return null;

    const n = 11;
    // Bottom row: 0..10 (right -> left)
    if (i >= 0 && i <= 10) {
      return { row: n, col: n - i };
    }

    // Left column: 11..19 (bottom-1 -> top+1)
    if (i >= 11 && i <= 19) {
      const offset = i - 10; // 1..9
      return { row: n - offset, col: 1 };
    }

    // Top row: 20..30 (left -> right)
    if (i >= 20 && i <= 30) {
      const offset = i - 19; // 1..11
      return { row: 1, col: offset };
    }

    // Right column: 31..39 (top+1 -> bottom-1)
    const offset = i - 30; // 1..9
    return { row: 1 + offset, col: n };
  }

  // NEW: Helper function for CSS Grid positioning
  function getGridArea(index, perSide) {
    const row = Math.floor(index / perSide);
    const col = index % perSide;

    // Map to Monopoly board layout
    if (row === 0) {
      // Top row
      if (col === 0) return 'corner';
      if (col === perSide - 1) return 'corner';
      return 'side';
    } else if (row === perSide - 1) {
      // Right column
      if (col === 0) return 'corner';
      if (col === perSide - 1) return 'corner';
      return 'side';
    } else if (row === perSide - 2) {
      // Bottom row
      if (col === 0) return 'corner';
      if (col === perSide - 1) return 'corner';
      return 'side';
    } else {
      // Left column
      if (col === 0) return 'corner';
      if (col === perSide - 1) return 'corner';
      return 'side';
    }
  }

  // NEW: Enhanced tile content creation
  function addTileContent(tileEl, tile, isCorner) {
    // Color strip for properties
    if (tile.color) {
      const strip = document.createElement('div');
      strip.className = 'tile-color-strip';
      strip.style.background = tile.color;
      tileEl.appendChild(strip);
    }

    // Tile name
    const name = document.createElement('div');
    name.className = 'tile-name';
    name.textContent = tile.name;
    tileEl.appendChild(name);

    // Price for properties
    if (tile.type === 'property' && tile.price) {
      const price = document.createElement('div');
      price.className = 'tile-price';
      price.textContent = `$${tile.price}`;
      tileEl.appendChild(price);
    }

    // Icons for special tiles
    if (tile.type === 'airport') {
      const icon = document.createElement('div');
      icon.className = 'tile-icon airport-icon';
      icon.textContent = '✈';
      tileEl.appendChild(icon);
    } else if (tile.type === 'utility') {
      const icon = document.createElement('div');
      icon.className = 'tile-icon utility-icon';
      icon.textContent = '⚡';
      tileEl.appendChild(icon);
    } else if (tile.type === 'chance') {
      const icon = document.createElement('div');
      icon.className = 'tile-icon chance-icon';
      icon.textContent = '?';
      tileEl.appendChild(icon);
    }

    // Development indicator container
    if (tile.type === 'property') {
      const devContainer = document.createElement('div');
      devContainer.className = 'tile-development';
      tileEl.appendChild(devContainer);
    }
  }

  function positionTile(el, index, perSide) {
    const c = perSide;
    const pos = index;
    const unit = 100 / (c - 1);
    const innerMargin = 4; // RICHUP-STYLE: Increased spacing for cleaner separation

    // Calculate position with mathematical precision
    let left, top, width, height;

    if (pos < c) {
      // Top row (left to right)
      left = pos * unit;
      top = 0;
      width = unit;
      height = unit * 0.25;
    } else if (pos < c * 2 - 1) {
      // Right column (top to bottom)
      left = 100;
      top = (pos - c + 1) * unit;
      width = unit * 0.25;
      height = unit;
    } else if (pos < c * 3 - 2) {
      // Bottom row (right to left)
      left = 100 - (pos - (c * 2 - 2)) * unit;
      top = 100;
      width = unit;
      height = unit * 0.25;
    } else {
      // Left column (bottom to top)
      left = 0;
      top = 100 - (pos - (c * 3 - 3)) * unit;
      width = unit * 0.25;
      height = unit;
    }

    // RICHUP-STYLE: Apply precise positioning with consistent spacing
    el.style.left = `calc(${left}% + ${innerMargin}px)`;
    el.style.top = `calc(${top}% + ${innerMargin}px)`;
    el.style.width = `calc(${width}% - ${innerMargin * 2}px)`;
    el.style.height = `calc(${height}% - ${innerMargin * 2}px)`;

    // RICHUP-STYLE: Corner tiles are perfectly square and anchored
    const isCorner = index % perSide === 0;
    if (isCorner) {
      const cornerSize = Math.min(
        parseFloat(el.style.width),
        parseFloat(el.style.height)
      );
      el.style.width = `${cornerSize}px`;
      el.style.height = `${cornerSize}px`;
      // RICHUP-STYLE: Ensure corners are perfectly positioned
      if (pos === 0) {
        el.style.left = `${innerMargin}px`;
        el.style.top = `${innerMargin}px`;
      } else if (pos === c) {
        el.style.left = `calc(100% - ${cornerSize}px - ${innerMargin}px)`;
        el.style.top = `${innerMargin}px`;
      } else if (pos === c * 2 - 2) {
        el.style.left = `calc(100% - ${cornerSize}px - ${innerMargin}px)`;
        el.style.top = `calc(100% - ${cornerSize}px - ${innerMargin}px)`;
      } else if (pos === c * 3 - 3) {
        el.style.left = `${innerMargin}px`;
        el.style.top = `calc(100% - ${cornerSize}px - ${innerMargin}px)`;
      }
    }
  }

  // Persistent token map: playerId -> element
  const tokenElements = new Map();

  function renderPlayers(players, currentPlayerId) {
    if (!players) return;

    const currentIds = new Set();

    // Group players by position to handle stacking
    const playersAtPos = {};
    Object.values(players).forEach(p => {
      if (p.bankrupt) return;
      if (!playersAtPos[p.position]) playersAtPos[p.position] = [];
      playersAtPos[p.position].push(p);
    });

    Object.values(players).forEach(p => {
      if (p.bankrupt) {
        // Remove bankrupt token if exists
        const el = tokenElements.get(p.id);
        if (el) { el.remove(); tokenElements.delete(p.id); }
        return;
      }

      currentIds.add(p.id);
      let tokenEl = tokenElements.get(p.id);

      if (!tokenEl) {
        tokenEl = document.createElement('div');
        tokenEl.className = 'player-token';
        tokenEl.dataset.playerId = p.id;

        const initial = document.createElement('div');
        initial.className = 'player-token-initial';
        initial.textContent = p.name ? p.name[0].toUpperCase() : '?';
        tokenEl.appendChild(initial);

        boardEl.appendChild(tokenEl); // Direct child of board!
        tokenElements.set(p.id, tokenEl);

        // Initial placement without transition
        const coords = getTileCenter(p.position);
        if (coords) {
          tokenEl.style.transition = 'none';
          tokenEl.style.left = coords.x + '%';
          tokenEl.style.top = coords.y + '%';
          // Force layout flush used to be necessary, but requestAnimationFrame handles it better if needed
          // For now, next frame or update will enable transition
          setTimeout(() => { tokenEl.style.transition = ''; }, 50);
        }
      }

      // Update appearance
      const color = p.color || '#888';
      tokenEl.style.background = `linear-gradient(135deg, ${color}, #fff)`;
      tokenEl.style.boxShadow = currentPlayerId === p.id
        ? `0 0 0 2px ${color}, 0 0 16px ${color}80`
        : `0 4px 6px rgba(0,0,0,0.5)`;

      if (currentPlayerId === p.id) tokenEl.classList.add('active');
      else tokenEl.classList.remove('active');

      // Calculate position with stacking
      const group = playersAtPos[p.position] || [];
      const indexInGroup = group.findIndex(x => x.id === p.id);
      const coords = getTileCenter(p.position);

      if (coords) {
        // Simple stacking offset
        let offsetX = 0;
        let offsetY = 0;

        if (group.length > 1) {
          // Spiral/grid offset for multiples
          const offset = 3; // percent or px? using % roughly for responsiveness
          if (indexInGroup === 1) { offsetX = offset; }
          else if (indexInGroup === 2) { offsetX = -offset; }
          else if (indexInGroup === 3) { offsetY = offset; }
          else if (indexInGroup === 4) { offsetY = -offset; }
        }

        tokenEl.style.left = `calc(${coords.x}% + ${offsetX}px)`;
        tokenEl.style.top = `calc(${coords.y}% + ${offsetY}px)`;
      }
    });

    // Cleanup removed players
    for (const [pid, el] of tokenElements) {
      if (!currentIds.has(pid)) {
        el.remove();
        tokenElements.delete(pid);
      }
    }

    // Ownership Indicators (Border color on tiles)
    // We already do this below, but let's keep it separate from tokens
    renderOwnership(players);
  }

  function getTileCenter(index) {
    // Retrieve the tile element from DOM to get its computed position within grid?
    // OR calculate logically based on 11x11 grid same as getPerimeterGridPos.
    // CSS Grid makes exact % tricky if we rely purely on DOM rects during resize.
    // Better to use logical geometric center based on grid logic.

    const pos = getPerimeterGridPos(index); // returns {row, col} 1..11
    if (!pos) return { x: 50, y: 50 }; // fallback

    // 11 rows/cols. Each cell is ~ 100/11 %.
    // Center of cell (row, col) = 
    // Left = (col - 1) * (100/11) + (100/11)/2
    // Top = (row - 1) * (100/11) + (100/11)/2

    const cellSize = 100 / 11;
    const x = (pos.col - 1) * cellSize + cellSize / 2;
    const y = (pos.row - 1) * cellSize + cellSize / 2;

    return { x, y };
  }

  function renderOwnership(players) {
    boardEl.querySelectorAll('.tile').forEach(t => {
      t.classList.remove('owned');
      t.style.removeProperty('--owner-color');
      const dev = t.querySelector('.tile-development-container');
      if (dev) dev.innerHTML = '';
    });

    Object.values(players).forEach(p => {
      if (!p.ownedProperties) return;
      Object.entries(p.ownedProperties).forEach(([tid, data]) => {
        const tile = boardEl.querySelector(`.tile[data-tile-id="${tid}"]`);
        if (tile) {
          tile.classList.add('owned');
          tile.style.setProperty('--owner-color', p.color);

          const dev = tile.querySelector('.tile-development-container');
          if (dev) {
            if (data.hotel) dev.innerHTML = '<span class="dev-icon">🏨</span>';
            else if (data.houses) dev.innerHTML = `<span class="dev-icon">🏠</span>${data.houses > 1 ? data.houses : ''}`;
          }
        }
      });
    });
  }

  function toast(message, type) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast';
    if (type) el.classList.add(type);
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 180);
    }, 2200);
  }

  return {
    setBoard,
    renderPlayers,
    toast,
  };
})();


