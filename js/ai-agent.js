/* ============================================
   EVALIS AI — VOICE AI AGENT v1.0
   Stunning floating voice assistant with
   Cloudflare Workers AI backend
   ============================================ */

(function() {
  'use strict';

  const API_BASE = 'https://evalis-api.simpaticohrconsultancy.workers.dev';
  const AGENT_NAME = 'Eva';

  // ── Inject Styles ──
  const style = document.createElement('style');
  style.textContent = `
    @keyframes eva-pulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.4)}70%{box-shadow:0 0 0 18px rgba(99,102,241,0)}}
    @keyframes eva-ripple{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.5);opacity:0}}
    @keyframes eva-fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes eva-spin{to{transform:rotate(360deg)}}
    @keyframes eva-wave-bar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
    @keyframes eva-glow{0%,100%{opacity:.5}50%{opacity:1}}
    @keyframes eva-orb-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.05)}}

    #eva-agent-btn{
      position:fixed;bottom:28px;right:28px;z-index:99999;
      width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;
      background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);
      color:#fff;font-size:1.6rem;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 8px 32px rgba(99,102,241,.4),0 0 0 0 rgba(99,102,241,.3);
      animation:eva-pulse 2.5s infinite,eva-orb-float 3s ease-in-out infinite;
      transition:all .3s cubic-bezier(.4,0,.2,1);
    }
    #eva-agent-btn:hover{transform:scale(1.1);box-shadow:0 12px 40px rgba(99,102,241,.6)}
    #eva-agent-btn .eva-ripple{
      position:absolute;width:100%;height:100%;border-radius:50%;
      border:2px solid rgba(99,102,241,.5);animation:eva-ripple 2s infinite;pointer-events:none;
    }
    #eva-agent-btn.active{animation:none;background:linear-gradient(135deg,#ef4444,#f97316)}

    #eva-panel{
      position:fixed;bottom:104px;right:28px;z-index:99998;
      width:380px;max-height:560px;
      background:rgba(8,10,25,.92);
      backdrop-filter:blur(24px) saturate(1.8);
      -webkit-backdrop-filter:blur(24px) saturate(1.8);
      border:1px solid rgba(99,102,241,.2);
      border-radius:20px;
      box-shadow:0 24px 80px rgba(0,0,0,.6),0 0 60px rgba(99,102,241,.08);
      display:none;flex-direction:column;overflow:hidden;
      animation:eva-fade-up .4s ease;
    }
    #eva-panel.open{display:flex}

    .eva-header{
      padding:16px 20px;display:flex;align-items:center;justify-content:space-between;
      border-bottom:1px solid rgba(255,255,255,.06);
      background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(168,85,247,.05));
    }
    .eva-header-left{display:flex;align-items:center;gap:10px}
    .eva-avatar{
      width:36px;height:36px;border-radius:50%;
      background:linear-gradient(135deg,#6366f1,#a855f7);
      display:flex;align-items:center;justify-content:center;font-size:1rem;
      box-shadow:0 0 16px rgba(99,102,241,.4);
    }
    .eva-title{font-size:.92rem;font-weight:700;color:#fff;font-family:'Space Grotesk',sans-serif}
    .eva-status{font-size:.7rem;color:#10b981;display:flex;align-items:center;gap:4px}
    .eva-status::before{content:'';width:6px;height:6px;border-radius:50%;background:#10b981}
    .eva-close{background:none;border:none;color:rgba(255,255,255,.4);font-size:1.3rem;cursor:pointer;padding:4px;transition:color .2s}
    .eva-close:hover{color:#fff}

    .eva-actions{display:flex;gap:6px;padding:0 20px 10px;margin-top:-2px}
    .eva-action-btn{
      padding:5px 12px;border-radius:20px;font-size:.7rem;font-weight:600;
      border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);
      color:rgba(255,255,255,.5);cursor:pointer;transition:all .2s;
    }
    .eva-action-btn:hover{border-color:rgba(99,102,241,.4);color:#a5b4fc;background:rgba(99,102,241,.08)}

    .eva-messages{
      flex:1;overflow-y:auto;padding:16px 20px;
      display:flex;flex-direction:column;gap:12px;
      min-height:240px;max-height:340px;
      scrollbar-width:thin;scrollbar-color:rgba(99,102,241,.2) transparent;
    }
    .eva-messages::-webkit-scrollbar{width:4px}
    .eva-messages::-webkit-scrollbar-thumb{background:rgba(99,102,241,.2);border-radius:4px}

    .eva-msg{
      max-width:88%;padding:12px 16px;border-radius:16px;font-size:.85rem;line-height:1.65;
      animation:eva-fade-up .3s ease;word-wrap:break-word;
    }
    .eva-msg.bot{
      align-self:flex-start;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.15);
      color:#c7d2fe;border-bottom-left-radius:4px;
    }
    .eva-msg.user{
      align-self:flex-end;background:linear-gradient(135deg,rgba(99,102,241,.25),rgba(168,85,247,.2));
      border:1px solid rgba(139,92,246,.3);color:#e0e7ff;border-bottom-right-radius:4px;
    }
    .eva-msg.typing{color:rgba(255,255,255,.4);font-style:italic}

    .eva-wave{
      display:flex;align-items:center;justify-content:center;gap:3px;
      height:32px;padding:8px 20px;display:none;
    }
    .eva-wave.active{display:flex}
    .eva-wave-bar{
      width:3px;height:20px;border-radius:3px;
      background:linear-gradient(180deg,#6366f1,#a855f7);
      animation:eva-wave-bar .6s ease-in-out infinite;
    }
    .eva-wave-bar:nth-child(1){animation-delay:0s}
    .eva-wave-bar:nth-child(2){animation-delay:.1s}
    .eva-wave-bar:nth-child(3){animation-delay:.2s}
    .eva-wave-bar:nth-child(4){animation-delay:.3s}
    .eva-wave-bar:nth-child(5){animation-delay:.4s}
    .eva-wave-bar:nth-child(6){animation-delay:.3s}
    .eva-wave-bar:nth-child(7){animation-delay:.2s}

    .eva-input-area{
      display:flex;align-items:center;gap:8px;
      padding:12px 16px;border-top:1px solid rgba(255,255,255,.06);
      background:rgba(255,255,255,.02);
    }
    .eva-input{
      flex:1;padding:10px 16px;border-radius:12px;
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
      color:#fff;font-size:.85rem;outline:none;font-family:inherit;
      transition:border-color .2s;
    }
    .eva-input::placeholder{color:rgba(255,255,255,.25)}
    .eva-input:focus{border-color:rgba(99,102,241,.4)}
    .eva-mic-btn{
      width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;
      background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);
      font-size:1.1rem;display:flex;align-items:center;justify-content:center;
      transition:all .2s;flex-shrink:0;
    }
    .eva-mic-btn:hover{background:rgba(99,102,241,.15);color:#a5b4fc}
    .eva-mic-btn.listening{background:rgba(239,68,68,.2);color:#ef4444;animation:eva-pulse 1.5s infinite}
    .eva-send-btn{
      width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;
      background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;
      font-size:1rem;display:flex;align-items:center;justify-content:center;
      transition:all .2s;flex-shrink:0;
    }
    .eva-send-btn:hover{transform:scale(1.08);box-shadow:0 4px 16px rgba(99,102,241,.4)}
    .eva-send-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}

    .eva-footer{
      padding:8px 20px;text-align:center;font-size:.65rem;color:rgba(255,255,255,.2);
      border-top:1px solid rgba(255,255,255,.04);
    }

    @media(max-width:480px){
      #eva-panel{width:calc(100vw - 24px);right:12px;bottom:96px;max-height:70vh}
      #eva-agent-btn{width:56px;height:56px;right:16px;bottom:16px}
    }
  `;
  document.head.appendChild(style);

  // ── Build DOM ──
  const btn = document.createElement('button');
  btn.id = 'eva-agent-btn';
  btn.setAttribute('aria-label', 'Talk to Eva AI Assistant');
  btn.innerHTML = '<span class="eva-ripple"></span>🤖';

  const panel = document.createElement('div');
  panel.id = 'eva-panel';
  panel.innerHTML = `
    <div class="eva-header">
      <div class="eva-header-left">
        <div class="eva-avatar">🤖</div>
        <div>
          <div class="eva-title">Eva — AI Assistant</div>
          <div class="eva-status">Online</div>
        </div>
      </div>
      <button class="eva-close" id="eva-close">&times;</button>
    </div>
    <div class="eva-actions">
      <button class="eva-action-btn" data-q="What services do you offer?">Services</button>
      <button class="eva-action-btn" data-q="Tell me about pricing">Pricing</button>
      <button class="eva-action-btn" data-q="How can I contact you?">Contact</button>
      <button class="eva-action-btn" data-q="Tell me about web development">Web Dev</button>
    </div>
    <div class="eva-messages" id="eva-messages">
      <div class="eva-msg bot">
        👋 Hi! I'm <strong>Eva</strong>, your AI assistant from Evalis AI. Ask me anything about our services, or tap the mic to talk to me!
      </div>
    </div>
    <div class="eva-wave" id="eva-wave">
      <div class="eva-wave-bar"></div><div class="eva-wave-bar"></div><div class="eva-wave-bar"></div>
      <div class="eva-wave-bar"></div><div class="eva-wave-bar"></div><div class="eva-wave-bar"></div>
      <div class="eva-wave-bar"></div>
    </div>
    <div class="eva-input-area">
      <input class="eva-input" id="eva-input" placeholder="Ask Eva anything..." autocomplete="off" />
      <button class="eva-mic-btn" id="eva-mic" title="Voice input">🎤</button>
      <button class="eva-send-btn" id="eva-send" title="Send">➤</button>
    </div>
    <div class="eva-footer">Powered by Evalis AI · Cloudflare Workers AI</div>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(btn);

  // ── References ──
  const messagesEl = document.getElementById('eva-messages');
  const inputEl = document.getElementById('eva-input');
  const sendBtn = document.getElementById('eva-send');
  const micBtn = document.getElementById('eva-mic');
  const waveEl = document.getElementById('eva-wave');
  const closeBtn = document.getElementById('eva-close');

  let isOpen = false;
  let isListening = false;
  let isSpeaking = false;
  let recognition = null;
  let conversationHistory = [];

  // ── Toggle Panel ──
  btn.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) inputEl.focus();
  });
  closeBtn.addEventListener('click', () => {
    isOpen = false;
    panel.classList.remove('open');
  });

  // ── Quick Action Buttons ──
  panel.querySelectorAll('.eva-action-btn').forEach(b => {
    b.addEventListener('click', () => sendMessage(b.dataset.q));
  });

  // ── Send Message ──
  sendBtn.addEventListener('click', () => sendMessage(inputEl.value));
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(inputEl.value); });

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `eva-msg ${role}`;
    div.innerHTML = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'eva-msg bot typing';
    div.id = 'eva-typing';
    div.textContent = 'Eva is thinking...';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('eva-typing');
    if (t) t.remove();
  }

  async function sendMessage(text) {
    text = (text || '').trim();
    if (!text) return;
    inputEl.value = '';
    addMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });
    showTyping();
    sendBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: conversationHistory.slice(-6)
        })
      });

      removeTyping();

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const reply = data.reply || data.response || "I'm sorry, I couldn't process that. Please try again.";
      addMessage(reply, 'bot');
      conversationHistory.push({ role: 'assistant', content: reply });

      // Speak the response
      speak(reply);

    } catch (err) {
      removeTyping();
      // Fallback to local responses
      const reply = getLocalResponse(text);
      addMessage(reply, 'bot');
      conversationHistory.push({ role: 'assistant', content: reply });
      speak(reply);
    }
    sendBtn.disabled = false;
  }

  // ── Local Fallback Responses ──
  function getLocalResponse(input) {
    const l = input.toLowerCase();
    const responses = {
      'service': 'We offer AI Data Services, Web & App Development, SaaS Platform Development, AI Integration, and Search Quality Evaluation. Visit our <a href="services.html" style="color:#a5b4fc">Services page</a> for details!',
      'price': 'Our pricing is project-based and competitive. Contact us at <a href="contact.html" style="color:#a5b4fc">our contact page</a> for a custom quote!',
      'contact': 'Reach us at evalisglobal@gmail.com or WhatsApp <a href="https://wa.me/919544842260" style="color:#a5b4fc" target="_blank">+91 9544842260</a>. We reply within 24 hours!',
      'web': 'We build stunning websites with React, Next.js, and modern tech stacks — from landing pages to enterprise platforms!',
      'app': 'We develop cross-platform mobile and desktop apps using React Native, Flutter, and PWA technologies.',
      'saas': 'We architect complete SaaS platforms with multi-tenancy, auth, billing, and analytics — from MVP to enterprise.',
      'ai': 'We integrate AI into businesses: custom chatbots, automation, LLM integration, and intelligent workflows.',
      'hello': 'Hello! 👋 Welcome to Evalis AI. How can I help you today?',
      'hi': 'Hi there! Looking for AI services, web development, or SaaS solutions?',
      'kerala': 'We\'re based in Perinthalmanna, Kerala 🌴 — serving clients across India and worldwide!',
      'location': 'Our headquarters are in Perinthalmanna, Malappuram, Kerala, India. We serve clients globally!',
    };
    for (const [key, val] of Object.entries(responses)) {
      if (l.includes(key)) return val;
    }
    return "Thanks for reaching out! I can help with info about our <strong>services</strong>, <strong>pricing</strong>, <strong>web development</strong>, <strong>AI solutions</strong>, or connect you with our team. What would you like to know?";
  }

  // ── Voice Input (Speech Recognition) ──
  micBtn.addEventListener('click', toggleVoice);

  function toggleVoice() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage('⚠️ Voice input is not supported in this browser. Try Chrome or Edge.', 'bot');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micBtn.innerHTML = '⏹';
      waveEl.classList.add('active');
      inputEl.placeholder = 'Listening...';
    };

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      inputEl.value = transcript;
      if (e.results[e.resultIndex].isFinal) {
        stopListening();
        sendMessage(transcript);
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      stopListening();
      if (e.error === 'not-allowed') {
        addMessage('⚠️ Microphone access denied. Please allow microphone access and try again.', 'bot');
      }
    };

    recognition.onend = () => { stopListening(); };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Recognition start failed:', e);
      stopListening();
    }
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    micBtn.innerHTML = '🎤';
    waveEl.classList.remove('active');
    inputEl.placeholder = 'Ask Eva anything...';
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
      recognition = null;
    }
  }

  // ── Voice Output (Text-to-Speech) ──
  function speak(text) {
    if (!window.speechSynthesis) return;
    // Strip HTML tags for speech
    const clean = text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
    if (!clean.trim()) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'en-IN';
    utter.rate = 1.0;
    utter.pitch = 1.1;
    utter.volume = 0.8;

    // Try to use a female voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Zira') || v.name.includes('Female') || v.name.includes('Google UK English Female'));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => { isSpeaking = true; waveEl.classList.add('active'); };
    utter.onend = () => { isSpeaking = false; waveEl.classList.remove('active'); };
    utter.onerror = () => { isSpeaking = false; waveEl.classList.remove('active'); };

    window.speechSynthesis.speak(utter);
  }

  // Preload voices
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

})();
