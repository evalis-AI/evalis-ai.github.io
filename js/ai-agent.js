/* ============================================
   EVALIS AI — VOICE AI AGENT v2.0
   Real-time streaming voice assistant with
   VAD, hands-free mode & Cloudflare Workers AI
   ============================================ */

(function() {
  'use strict';

  const API_BASE = 'https://evalis-api.evalisglobal.workers.dev';
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
  let isHandsFree = false;
  let recognition = null;
  let conversationHistory = [];
  let mediaRecorder = null;
  let audioChunks = [];

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
    sendBtn.disabled = true;

    // Try streaming first, fallback to regular
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: conversationHistory.slice(-6) })
      });

      if (!res.ok) throw new Error('Stream failed');

      // Create bot message element for streaming
      const botDiv = document.createElement('div');
      botDiv.className = 'eva-msg bot';
      botDiv.textContent = '';
      messagesEl.appendChild(botDiv);

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
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      if (!fullReply) fullReply = "I'm here to help!";
      botDiv.innerHTML = fullReply;
      conversationHistory.push({ role: 'assistant', content: fullReply });
      speak(fullReply);

    } catch (err) {
      // Fallback: non-streaming request
      try {
        const res2 = await fetch(`${API_BASE}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: conversationHistory.slice(-6) })
        });
        const data = await res2.json();
        const reply = data.reply || getLocalResponse(text);
        addMessage(reply, 'bot');
        conversationHistory.push({ role: 'assistant', content: reply });
        speak(reply);
      } catch(e2) {
        const reply = getLocalResponse(text);
        addMessage(reply, 'bot');
        conversationHistory.push({ role: 'assistant', content: reply });
        speak(reply);
      }
    }
    sendBtn.disabled = false;
  }

  // ── Local Fallback Responses ──
  function getLocalResponse(input) {
    const l = input.toLowerCase();
    const responses = {
      'service': 'We offer 13 services: AI Data Services, Web & App Dev, SaaS Platforms, WhatsApp AI Chatbots, Custom AI Agent Builder, Workflow Automation, Document Intelligence, AI Lead Generation, Voice Agents, and GEO. Visit our <a href="services.html" style="color:#a5b4fc">Services page</a> for details!',
      'price': 'Our pricing is custom — tailored to your project scope, volume, and requirements. We offer competitive global rates with no hidden fees. <a href="contact.html" style="color:#a5b4fc">Contact us</a> for a free consultation and quote!',
      'cost': 'We provide custom pricing based on project scope and requirements. <a href="contact.html" style="color:#a5b4fc">Get a free quote</a> — no obligation!',
      'contact': 'Reach us at info@evalisai.com or WhatsApp <a href="https://wa.me/919544842260" style="color:#a5b4fc" target="_blank">+91 9544842260</a>. We reply within 24 hours!',
      'whatsapp': 'Our WhatsApp AI Chatbot service builds RAG-powered bots trained on your product catalog. Auto-reply 24/7 in multiple languages. Contact us for a custom quote! 💬',
      'chatbot': 'We build intelligent chatbots for WhatsApp and websites — trained on YOUR data with RAG technology. They answer accurately, capture leads, and book appointments automatically!',
      'agent': 'Our Custom AI Agent Builder creates a white-label AI assistant for your website in 48 hours! Trained on your docs, branded to you, with built-in analytics and lead capture. 🧠',
      'automation': 'AI Workflow Automation eliminates repetitive tasks — auto-classify emails, process invoices, qualify leads, and more. Custom-built for your business needs. ⚙️',
      'workflow': 'We automate business workflows with AI: invoice processing, email routing, lead qualification, social media scheduling, and CRM integration using n8n & custom APIs.',
      'document': 'Our AI Document Intelligence extracts data from invoices, contracts, medical records using OCR + NLP. Integrates with your existing systems. 📄',
      'invoice': 'We automate invoice processing with AI — extract vendor details, line items, tax amounts automatically and sync with your accounting systems.',
      'lead': 'Our AI Lead Generation Agent researches prospects, qualifies leads, scores intent, and auto-sends personalized outreach via email & WhatsApp. 🎯',
      'voice': 'AI Voice Agent & Virtual Receptionist answers phone calls 24/7, books appointments, handles FAQs in multiple languages. 🎙️',
      'geo': 'Generative Engine Optimization (GEO) gets your brand into AI search results — ChatGPT, Perplexity, Gemini. The future of SEO! 🔮',
      'seo': 'Beyond traditional SEO, we offer GEO — Generative Engine Optimization to make your brand visible in AI-powered search engines like ChatGPT and Perplexity.',
      'web': 'We build stunning websites with React, Next.js, and modern tech stacks — from landing pages to enterprise platforms!',
      'app': 'We develop cross-platform mobile and desktop apps using React Native, Flutter, and PWA technologies.',
      'saas': 'We architect complete SaaS platforms with multi-tenancy, auth, billing, and analytics — from MVP to enterprise.',
      'ai': 'We integrate AI into businesses: custom chatbots, WhatsApp bots, workflow automation, document processing, lead gen agents, voice AI, and more!',
      'hello': 'Hello! 👋 Welcome to Evalis AI. How can I help you today? Ask me about our 13 services!',
      'hi': 'Hi there! 👋 Looking for WhatsApp AI bots, custom agents, workflow automation, or web development?',
      'kerala': 'We\'re based in Perinthalmanna, Kerala 🌴 — serving clients across India and worldwide!',
      'location': 'Our headquarters are in Perinthalmanna, Malappuram, Kerala, India. We serve clients globally!',
    };
    for (const [key, val] of Object.entries(responses)) {
      if (l.includes(key)) return val;
    }
    return "Thanks for reaching out! I can help with <strong>WhatsApp AI Chatbots</strong>, <strong>Custom AI Agents</strong>, <strong>Workflow Automation</strong>, <strong>Document Intelligence</strong>, <strong>Web/App Development</strong>, and more. What interests you?";
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

  // ── Voice Output (Cloud TTS → Browser Fallback) ──
  const audioEl = document.createElement('audio');
  audioEl.style.display = 'none';
  document.body.appendChild(audioEl);

  async function speak(text) {
    // Strip HTML tags for speech
    const clean = text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
    if (!clean) return;

    // Try cloud TTS first (human-like voice)
    try {
      const res = await fetch(`${API_BASE}/api/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean.substring(0, 300), language: 'en' })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioEl.src = url;
        audioEl.onplay = () => { isSpeaking = true; waveEl.classList.add('active'); };
        audioEl.onended = () => { isSpeaking = false; waveEl.classList.remove('active'); URL.revokeObjectURL(url); if (isHandsFree) setTimeout(startListening, 600); };
        audioEl.onerror = () => { isSpeaking = false; waveEl.classList.remove('active'); speakBrowserFallback(clean); };
        await audioEl.play();
        return;
      }
    } catch(e) { /* fall through to browser TTS */ }

    // Fallback: browser speech synthesis
    speakBrowserFallback(clean);
  }

  function speakBrowserFallback(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-IN';
    utter.rate = 1.0;
    utter.pitch = 1.1;
    utter.volume = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Zira') || v.name.includes('Female') || v.name.includes('Google UK English Female'));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => { isSpeaking = true; waveEl.classList.add('active'); };
    utter.onend = () => { isSpeaking = false; waveEl.classList.remove('active'); if (isHandsFree) setTimeout(startListening, 600); };
    utter.onerror = () => { isSpeaking = false; waveEl.classList.remove('active'); };

    window.speechSynthesis.speak(utter);
  }

  // ── Hands-Free Toggle ──
  const hfBtn = document.createElement('button');
  hfBtn.className = 'eva-action-btn';
  hfBtn.id = 'eva-handsfree';
  hfBtn.textContent = '🎙️ Hands-Free';
  hfBtn.title = 'Toggle hands-free conversation mode';
  hfBtn.style.cssText = 'margin-left:auto;transition:all .2s';
  const actionsRow = panel.querySelector('.eva-actions');
  if (actionsRow) actionsRow.appendChild(hfBtn);

  hfBtn.addEventListener('click', () => {
    isHandsFree = !isHandsFree;
    hfBtn.style.background = isHandsFree ? 'rgba(16,185,129,.2)' : '';
    hfBtn.style.borderColor = isHandsFree ? 'rgba(16,185,129,.5)' : '';
    hfBtn.style.color = isHandsFree ? '#10b981' : '';
    hfBtn.textContent = isHandsFree ? '🟢 Hands-Free ON' : '🎙️ Hands-Free';
    if (isHandsFree && !isListening && !isSpeaking) startListening();
  });

  // Preload voices
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

})();
