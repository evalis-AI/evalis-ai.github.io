/* ============================================
   EVALIS AI — EMBEDDABLE AI AGENT v1.0
   White-label chatbot widget that clients
   embed on their websites via a single script tag
   ============================================ */

(function() {
  'use strict';

  const cfg = window.EVALIS_AGENT_CONFIG || {};
  const API_BASE = cfg.apiBase || 'https://evalis-api.evalisglobal.workers.dev';
  const AGENT_ID = cfg.agentId || null;
  const AGENT_NAME = cfg.agentName || 'AI Assistant';
  const BRAND = cfg.brandColor || '#6366f1';

  // Derive accent colors from brand
  function hexToHSL(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  const hsl = hexToHSL(BRAND);
  const brandLight = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 100)}%, ${Math.min(hsl.l + 20, 90)}%)`;
  const brandDark = `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(hsl.l - 15, 10)}%)`;
  const brandAlpha = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.4)`;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes evai-pulse{0%,100%{box-shadow:0 0 0 0 ${brandAlpha}}70%{box-shadow:0 0 0 14px hsla(${hsl.h},${hsl.s}%,${hsl.l}%,0)}}
    @keyframes evai-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

    #evai-btn{
      position:fixed;bottom:24px;right:24px;z-index:99999;
      width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;
      background:${BRAND};color:#fff;font-size:1.4rem;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 6px 24px ${brandAlpha};
      animation:evai-pulse 2.5s infinite;
      transition:transform .2s;
    }
    #evai-btn:hover{transform:scale(1.08)}
    #evai-btn.open{animation:none;background:#ef4444}

    #evai-panel{
      position:fixed;bottom:96px;right:24px;z-index:99998;
      width:360px;max-height:520px;
      background:#0a0c1a;border:1px solid rgba(255,255,255,.1);
      border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);
      display:none;flex-direction:column;overflow:hidden;
      animation:evai-fade .3s ease;
    }
    #evai-panel.open{display:flex}

    .evai-hdr{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}
    .evai-hdr-left{display:flex;align-items:center;gap:10px}
    .evai-avatar{width:32px;height:32px;border-radius:50%;background:${BRAND};display:flex;align-items:center;justify-content:center;font-size:.9rem}
    .evai-name{font-size:.88rem;font-weight:700;color:#fff}
    .evai-status{font-size:.68rem;color:#10b981;display:flex;align-items:center;gap:4px}
    .evai-status::before{content:'';width:5px;height:5px;border-radius:50%;background:#10b981}
    .evai-x{background:none;border:none;color:rgba(255,255,255,.3);font-size:1.2rem;cursor:pointer}
    .evai-x:hover{color:#fff}

    .evai-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:320px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
    .evai-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:.82rem;line-height:1.6;animation:evai-fade .25s ease;word-wrap:break-word}
    .evai-msg.bot{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#ccc;border-bottom-left-radius:3px}
    .evai-msg.user{align-self:flex-end;background:${BRAND};color:#fff;border-bottom-right-radius:3px}
    .evai-msg.typing{color:rgba(255,255,255,.3);font-style:italic}

    .evai-input-row{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.01)}
    .evai-input{flex:1;padding:9px 14px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;font-size:.82rem;outline:none;font-family:inherit}
    .evai-input::placeholder{color:rgba(255,255,255,.2)}
    .evai-input:focus{border-color:${BRAND}}
    .evai-send{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:${BRAND};color:#fff;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:transform .2s;flex-shrink:0}
    .evai-send:hover{transform:scale(1.06)}
    .evai-send:disabled{opacity:.3;cursor:not-allowed;transform:none}
    .evai-ft{padding:6px 16px;text-align:center;font-size:.6rem;color:rgba(255,255,255,.15);border-top:1px solid rgba(255,255,255,.03)}
    .evai-ft a{color:rgba(255,255,255,.25);text-decoration:none}
    .evai-ft a:hover{color:rgba(255,255,255,.5)}

    @media(max-width:480px){
      #evai-panel{width:calc(100vw - 20px);right:10px;bottom:90px;max-height:65vh}
      #evai-btn{width:52px;height:52px;right:14px;bottom:14px}
    }
  `;
  document.head.appendChild(style);

  // Build DOM
  const btn = document.createElement('button');
  btn.id = 'evai-btn';
  btn.innerHTML = '💬';

  const panel = document.createElement('div');
  panel.id = 'evai-panel';
  panel.innerHTML = `
    <div class="evai-hdr">
      <div class="evai-hdr-left">
        <div class="evai-avatar">🤖</div>
        <div><div class="evai-name">${AGENT_NAME}</div><div class="evai-status">Online</div></div>
      </div>
      <button class="evai-x" id="evai-close">&times;</button>
    </div>
    <div class="evai-msgs" id="evai-msgs">
      <div class="evai-msg bot">👋 Hi! I'm <strong>${AGENT_NAME}</strong>. How can I help you today?</div>
    </div>
    <div class="evai-input-row">
      <input class="evai-input" id="evai-input" placeholder="Type a message..." autocomplete="off" />
      <button class="evai-send" id="evai-send">➤</button>
    </div>
    <div class="evai-ft">Powered by <a href="https://evalis-ai.github.io" target="_blank" rel="noopener">Evalis AI</a></div>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(btn);

  const msgs = document.getElementById('evai-msgs');
  const input = document.getElementById('evai-input');
  const send = document.getElementById('evai-send');
  const close = document.getElementById('evai-close');
  let isOpen = false;
  let history = [];

  btn.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    btn.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen ? '✕' : '💬';
    if (isOpen) input.focus();
  });
  close.addEventListener('click', () => {
    isOpen = false;
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.innerHTML = '💬';
  });

  send.addEventListener('click', () => doSend(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(input.value); });

  function addMsg(text, role) {
    const d = document.createElement('div');
    d.className = `evai-msg ${role}`;
    d.innerHTML = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function doSend(text) {
    text = (text || '').trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    history.push({ role: 'user', content: text });

    const typing = document.createElement('div');
    typing.className = 'evai-msg bot typing';
    typing.textContent = `${AGENT_NAME} is thinking...`;
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    send.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-6),
          agent_id: AGENT_ID,
        })
      });
      typing.remove();
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const reply = data.reply || "I'm sorry, please try again.";
      addMsg(reply, 'bot');
      history.push({ role: 'assistant', content: reply });
    } catch(e) {
      typing.remove();
      addMsg("I'm having trouble connecting. Please try again!", 'bot');
    }
    send.disabled = false;
  }
})();
