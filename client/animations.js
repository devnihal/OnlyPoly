// Lightweight animation helpers (GPU-optimized for 60fps)

window.OnlypolyAnim = {
  flash(el) {
    if (!el) return;
    // Use requestAnimationFrame for smooth timing
    requestAnimationFrame(() => {
      el.classList.add('anim-flash');
      setTimeout(() => {
        requestAnimationFrame(() => {
          el.classList.remove('anim-flash');
        });
      }, 260);
    });
  },
  shake(el) {
    if (!el) return;
    requestAnimationFrame(() => {
      el.classList.add('anim-shake');
      setTimeout(() => {
        requestAnimationFrame(() => {
          el.classList.remove('anim-shake');
        });
      }, 320);
    });
  },
  // Smooth token movement animation (tile-by-tile)
  moveToken(tokenEl, fromPos, toPos, duration = 300) {
    if (!tokenEl) return Promise.resolve();
    return new Promise((resolve) => {
      // Calculate position difference
      const delta = (toPos - fromPos + 40) % 40;
      const steps = Math.min(delta, 40 - delta);
      
      tokenEl.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      requestAnimationFrame(() => {
        // Trigger reflow for animation
        tokenEl.offsetHeight;
        // Move token (position will be recalculated by UI renderer)
        setTimeout(() => {
          tokenEl.style.transition = '';
          resolve();
        }, duration);
      });
    });
  },
  // Money payment animation (visual feedback)
  animateMoneyFlow(fromEl, toEl, amount) {
    if (!fromEl || !toEl) return;
    // Create floating money indicator
    const indicator = document.createElement('div');
    indicator.className = 'money-indicator';
    indicator.textContent = `-$${amount}`;
    indicator.style.position = 'fixed';
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = '1000';
    indicator.style.color = '#ff4b81';
    indicator.style.fontWeight = '600';
    indicator.style.fontSize = '14px';
    
    const fromRect = fromEl.getBoundingClientRect();
    indicator.style.left = `${fromRect.left + fromRect.width / 2}px`;
    indicator.style.top = `${fromRect.top + fromRect.height / 2}px`;
    indicator.style.transform = 'translate(-50%, -50%)';
    indicator.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease';
    
    document.body.appendChild(indicator);
    
    requestAnimationFrame(() => {
      const toRect = toEl.getBoundingClientRect();
      indicator.style.transform = `translate(${toRect.left + toRect.width / 2 - fromRect.left - fromRect.width / 2}px, ${toRect.top + toRect.height / 2 - fromRect.top - fromRect.height / 2}px)`;
      indicator.style.opacity = '0';
      
      setTimeout(() => {
        indicator.remove();
      }, 500);
    });
  },
};



