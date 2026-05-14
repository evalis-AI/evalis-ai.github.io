/* ============================================
   EVALIS AI — EMBEDDABLE AI AGENT v3.0
   Multi-tenant white-label voice + text chatbot
   with streaming, hands-free & API key auth
   ============================================ */

(function() {
  'use strict';

  const cfg = window.EVALIS_AGENT_CONFIG || {};
  const API_BASE = cfg.apiBase || 'https://evalis-api.evalisglobal.workers.dev';
  const AGENT_ID = cfg.agentId || null;
  const API_KEY = cfg.apiKey || null;
  const AGENT_NAME = cfg.agentName || 'AI Assistant';
  const BRAND = cfg.brandColor || '#6366f1';
  const VOICE_ENABLED = cfg.voiceEnabled !== false;

  // Derive accent from brand color
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
  const brandAlpha = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.4)`;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes evai-pulse{0%,100%{box-shadow:0 0 0 0 ${brandAlpha}}70%{box-shadow:0 0 0 14px hsla(${hsl.h},${hsl.s}%,${hsl.l}%,0)}}
    @keyframes evai-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes evai-wave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}

    #evai-btn{position:fixed;bottom:24px;right:24px;z-index:99999;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:${BRAND};color:#fff;font-size:1.4rem;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px ${brandAlpha};animation:evai-pulse 2.5s infinite;transition:transform .2s}
    #evai-btn:hover{transform:scale(1.08)}
    #evai-btn.open{animation:none;background:#ef4444}

    #evai-panel{position:fixed;bottom:96px;right:24px;z-index:99998;width:370px;max-height:540px;background:#0a0c1a;border:1px solid rgba(255,255,255,.1);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;animation:evai-fade .3s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    #evai-panel.open{display:flex}

    .evai-hdr{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}
    .evai-hdr-left{display:flex;align-items:center;gap:10px}
    .evai-avatar{width:34px;height:34px;border-radius:50%;background:${BRAND};display:flex;align-items:center;justify-content:center;font-size:.9rem;box-shadow:0 0 12px ${brandAlpha}}
    .evai-name{font-size:.88rem;font-weight:700;color:#fff}
    .evai-status{font-size:.68rem;color:#10b981;display:flex;align-items:center;gap:4px}
    .evai-status::before{content:'';width:5px;height:5px;border-radius:50%;background:#10b981}
    .evai-x{background:none;border:none;color:rgba(255,255,255,.3);font-size:1.2rem;cursor:pointer;padding:4px}
    .evai-x:hover{color:#fff}

    .evai-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-height:220px;max-height:330px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
    .evai-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:.82rem;line-height:1.6;animation:evai-fade .25s ease;word-wrap:break-word}
    .evai-msg.bot{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#ccc;border-bottom-left-radius:3px}
    .evai-msg.user{align-self:flex-end;background:${BRAND};color:#fff;border-bottom-right-radius:3px}
    .evai-msg.typing{color:rgba(255,255,255,.3);font-style:italic}

    .evai-wave-box{display:none;align-items:center;justify-content:center;gap:3px;height:28px;padding:6px 16px}
    .evai-wave-box.active{display:flex}
    .evai-wave-bar{width:3px;height:16px;border-radius:3px;background:${BRAND};animation:evai-wave .6s ease-in-out infinite}
    .evai-wave-bar:nth-child(1){animation-delay:0s}
    .evai-wave-bar:nth-child(2){animation-delay:.1s}
    .evai-wave-bar:nth-child(3){animation-delay:.2s}
    .evai-wave-bar:nth-child(4){animation-delay:.3s}
    .evai-wave-bar:nth-child(5){animation-delay:.2s}

    .evai-input-row{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.01)}
    .evai-input{flex:1;padding:9px 14px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#fff;font-size:.82rem;outline:none;font-family:inherit}
    .evai-input::placeholder{color:rgba(255,255,255,.2)}
    .evai-input:focus{border-color:${BRAND}}
    .evai-mic{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
    .evai-mic:hover{background:rgba(255,255,255,.1);color:#fff}
    .evai-mic.listening{background:rgba(239,68,68,.2);color:#ef4444;animation:evai-pulse 1.5s infinite}
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
  btn.setAttribute('aria-label', `Talk to ${AGENT_NAME}`);
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
    <div class="evai-wave-box" id="evai-wave">
      <div class="evai-wave-bar"></div><div class="evai-wave-bar"></div><div class="evai-wave-bar"></div>
      <div class="evai-wave-bar"></div><div class="evai-wave-bar"></div>
    </div>
    <div class="evai-input-row">
      <input class="evai-input" id="evai-input" placeholder="Type a message..." autocomplete="off" />
      ${VOICE_ENABLED ? '<button class="evai-mic" id="evai-mic" title="Voice input">🎤</button>' : ''}
      <button class="evai-send" id="evai-send" title="Send">➤</button>
    </div>
    <div class="evai-ft">Powered by <a href="https://evalis-ai.github.io" target="_blank" rel="noopener">Evalis AI</a></div>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(btn);

  const msgs = document.getElementById('evai-msgs');
  const input = document.getElementById('evai-input');
  const send = document.getElementById('evai-send');
  const close = document.getElementById('evai-close');
  const mic = document.getElementById('evai-mic');
  const wave = document.getElementById('evai-wave');
  let isOpen = false;
  let isListening = false;
  let isSpeaking = false;
  let isHandsFree = false;
  let recognition = null;
  let history = [];

  // Audio element for cloud TTS
  const audioEl = document.createElement('audio');
  audioEl.style.display = 'none';
  document.body.appendChild(audioEl);

  // ── Toggle Panel ──
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

  // ── Send Message ──
  send.addEventListener('click', () => doSend(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(input.value); });

  function addMsg(text, role) {
    const d = document.createElement('div');
    d.className = `evai-msg ${role}`;
    d.innerHTML = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function buildHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (API_KEY) h['X-API-Key'] = API_KEY;
    return h;
  }

  async function doSend(text) {
    text = (text || '').trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    history.push({ role: 'user', content: text });
    send.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ message: text, history: history.slice(-6), agent_id: AGENT_ID })
      });
      if (!res.ok) throw new Error('Stream failed');

      const botDiv = document.createElement('div');
      botDiv.className = 'evai-msg bot';
      botDiv.textContent = '';
      msgs.appendChild(botDiv);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.done) { fullReply = d.full || fullReply; break; }
            if (d.token) { fullReply += d.token; botDiv.textContent = fullReply; }
          } catch(e) {}
        }
        msgs.scrollTop = msgs.scrollHeight;
      }

      if (!fullReply) fullReply = "I'm here to help!";
      botDiv.innerHTML = fullReply;
      history.push({ role: 'assistant', content: fullReply });
      if (VOICE_ENABLED) speak(fullReply);

    } catch(e) {
      try {
        const res2 = await fetch(`${API_BASE}/api/ai/chat`, {
          method: 'POST', headers: buildHeaders(),
          body: JSON.stringify({ message: text, history: history.slice(-6), agent_id: AGENT_ID })
        });
        const data = await res2.json();
        const reply = data.reply || "Please try again.";
        addMsg(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
        if (VOICE_ENABLED) speak(reply);
      } catch(e2) {
        addMsg("I'm having trouble connecting. Please try again!", 'bot');
      }
    }
    send.disabled = false;
  }

  // ── Cloud TTS with browser fallback ──
  async function speak(text) {
    const clean = text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
    if (!clean) return;

    try {
      const res = await fetch(`${API_BASE}/api/ai/tts`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ text: clean.substring(0, 300), language: 'en' })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioEl.src = url;
        audioEl.onplay = () => { isSpeaking = true; wave.classList.add('active'); };
        audioEl.onended = () => { isSpeaking = false; wave.classList.remove('active'); URL.revokeObjectURL(url); if (isHandsFree) setTimeout(startListening, 600); };
        audioEl.onerror = () => { isSpeaking = false; wave.classList.remove('active'); speakFallback(clean); };
        await audioEl.play();
        return;
      }
    } catch(e) { /* fallback */ }
    speakFallback(clean);
  }

  function speakFallback(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; u.rate = 1.0; u.pitch = 1.1; u.volume = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v => v.name.includes('Zira') || v.name.includes('Female') || v.name.includes('Google UK English Female'));
    if (pref) u.voice = pref;
    u.onstart = () => { isSpeaking = true; wave.classList.add('active'); };
    u.onend = () => { isSpeaking = false; wave.classList.remove('active'); if (isHandsFree) setTimeout(startListening, 600); };
    u.onerror = () => { isSpeaking = false; wave.classList.remove('active'); };
    window.speechSynthesis.speak(u);
  }

  // ── Voice Input (Speech Recognition) ──
  if (mic && VOICE_ENABLED) {
    mic.addEventListener('click', () => isListening ? stopListening() : startListening());
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addMsg('⚠️ Voice not supported. Try Chrome or Edge.', 'bot'); return; }

    recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isListening = true;
      mic.classList.add('listening');
      mic.innerHTML = '⏹';
      wave.classList.add('active');
      input.placeholder = 'Listening...';
    };

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      input.value = transcript;
      if (e.results[e.resultIndex].isFinal) { stopListening(); doSend(transcript); }
    };

    recognition.onerror = (e) => {
      stopListening();
      if (e.error === 'not-allowed') addMsg('⚠️ Microphone access denied.', 'bot');
    };

    recognition.onend = () => stopListening();
    try { recognition.start(); } catch(e) { stopListening(); }
  }

  function stopListening() {
    isListening = false;
    if (mic) { mic.classList.remove('listening'); mic.innerHTML = '🎤'; }
    wave.classList.remove('active');
    input.placeholder = 'Type a message...';
    if (recognition) { try { recognition.stop(); } catch(e) {} recognition = null; }
  }

  // Preload voices
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
})();
