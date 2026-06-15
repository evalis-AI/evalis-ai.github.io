/**
 * EVALIS AI — Cloudflare Worker API v3.0
 * Handles: AI Chat, WhatsApp Bot, Document Intelligence,
 * White-Label Agent Config, Lead Gen, Contact forms,
 * Contributor registration, Waitlist, User tracking
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin, env) {
  const allowed = [env.ALLOWED_ORIGIN, 'http://localhost', 'http://127.0.0.1'];
  const isAllowed = allowed.some(a => origin?.startsWith(a));
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': isAllowed ? origin : env.ALLOWED_ORIGIN,
  };
}

function json(data, status = 200, origin, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
  });
}

async function supabaseInsert(table, data, env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Supabase error: ${res.status}`);
  }
  return await res.json();
}

async function supabaseSelect(table, query, env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Select failed: ${res.status}`);
  return await res.json();
}

// Simple in-memory rate limiter (resets on worker restart)
const rateLimits = new Map();
function checkRateLimit(key, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimits.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  rateLimits.set(key, entry);
  return entry.count <= limit;
}

// Per-client rate limiter (agent_id based, higher limits for paying clients)
function checkClientRateLimit(agentId, ip) {
  const clientKey = `client:${agentId || 'default'}:${ip}`;
  return checkRateLimit(clientKey, agentId ? 30 : 10, 60000);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── API Key validation for multi-tenant clients ──
async function validateApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key') || new URL(request.url).searchParams.get('api_key');
  if (!apiKey) return null;

  try {
    const results = await supabaseSelect('api_keys',
      `key=eq.${encodeURIComponent(apiKey)}&is_active=eq.true&limit=1`, env);
    if (results.length > 0) {
      // Track usage (non-blocking)
      try {
        await supabaseInsert('usage_logs', {
          agent_id: results[0].agent_id,
          endpoint: new URL(request.url).pathname,
          tokens_used: 1,
        }, env);
      } catch(e) { /* silent */ }
      return results[0]; // { agent_id, plan, monthly_limit, ... }
    }
  } catch(e) { /* silent */ }
  return null;
}


// ─── AI System Prompt (Updated with all 13 services) ───
const SYSTEM_PROMPT = `You are Eva, the friendly AI assistant for Evalis AI — a cutting-edge AI software company based in Perinthalmanna, Kerala, India.

About Evalis AI:
- Full-service AI & software company delivering global AI data services, web & app development, SaaS platforms, and next-gen AI solutions
- Founded and headquartered in Perinthalmanna, Malappuram District, Kerala, India
- Serving clients across all 14 districts of Kerala, pan-India, and worldwide
- Contact: info@evalisai.com | WhatsApp: +91 9544842260
- Website: https://evalisai.com

Core Services:
1. AI Data Services — Data labeling, LLM safety testing, search relevance evaluation, RLHF training data
2. Web Development — React, Next.js, full-stack websites and web applications
3. App Development — React Native, Flutter, cross-platform mobile apps
4. SaaS Platform Development — Multi-tenant platforms with auth, billing, analytics
5. AI Integration — Custom chatbots, workflow automation, AI agents, predictive analytics
6. Search & Content Evaluation — Human-powered search quality auditing, content moderation

Next-Gen AI Services (Trending 2026):
7. WhatsApp AI Chatbot (RAG) — Intelligent WhatsApp bots trained on business data, multilingual (English, Malayalam, Hindi), 24/7 auto-reply, order booking, lead capture. Starting at ₹25,000
8. Custom AI Agent Builder — White-label AI assistant for any website in 48 hours, trained on client docs, with analytics dashboard. Starting at ₹50,000
9. AI Workflow Automation — Autonomous workflows using n8n/Make: invoice processing, email routing, CRM integration, social media automation. Starting at ₹30,000
10. AI Document Intelligence — OCR + NLP for GST invoices, contracts, medical records. Tally/Zoho integration. Starting at ₹1,00,000
11. AI Lead Generation Agent — Autonomous prospect research, lead scoring, auto-outreach via email & WhatsApp. Starting at ₹20,000/month
12. AI Voice Agent & Virtual Receptionist — 24/7 AI phone receptionist, appointment booking, multilingual voice. Starting at ₹15,000/month
13. Generative Engine Optimization (GEO) — SEO for AI search engines (ChatGPT, Perplexity, Gemini). Schema markup, citation optimization. Starting at ₹50,000/month

Key Products:
- TrustScore: AI model evaluation framework
- AI Arena: Side-by-side model comparison tool
- AI Assessment: Organization AI readiness evaluation

Instructions:
- Be warm, professional, and concise
- Keep responses under 100 words
- Actively promote the new Next-Gen AI services when relevant
- Recommend contacting the team for custom quotes
- If asked about competitors, stay positive about Evalis
- Always offer to connect with the team for detailed discussions
- When asked about WhatsApp bots, AI agents, automation, or document processing, highlight our expertise and quick deployment times`;

// ─── White-label agent prompt generator ───
function buildAgentPrompt(config) {
  return `You are ${config.agent_name || 'AI Assistant'}, the AI assistant for ${config.company_name || 'our company'}.

About the company:
${config.company_description || 'A modern business leveraging AI technology.'}

${config.custom_knowledge || ''}

Contact: ${config.contact_email || ''} ${config.contact_phone ? '| Phone: ' + config.contact_phone : ''}
${config.website ? 'Website: ' + config.website : ''}

Instructions:
- Be warm, professional, and concise
- Keep responses under 100 words
- Answer only about this company and its products/services
- For complex queries, recommend contacting the team directly
- Stay on-brand and helpful`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    try {
      // ── Validate API key for B2B clients (optional — enhances limits) ──
      const apiClient = await validateApiKey(request, env);

      // ─── POST /api/ai/chat ───
      if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
        const body = await request.json();
        const agentId = body.agent_id || apiClient?.agent_id;

        if (!checkClientRateLimit(agentId, ip)) {
          return json({ error: 'Too many requests. Please wait a moment.' }, 429, origin, env);
        }


        const userMessage = body.message?.trim();
        if (!userMessage) {
          return json({ error: 'Message is required.' }, 400, origin, env);
        }

        // Support white-label: use custom prompt if agent_id provided
        let systemPrompt = SYSTEM_PROMPT;
        if (body.agent_id) {
          try {
            const configs = await supabaseSelect('agent_configs',
              `agent_id=eq.${encodeURIComponent(body.agent_id)}&is_active=eq.true&limit=1`, env);
            if (configs.length > 0) {
              systemPrompt = buildAgentPrompt(configs[0]);
            }
          } catch(e) { /* fallback to default */ }
        }

        const messages = [
          { role: 'system', content: systemPrompt },
          ...(body.history || []).slice(-6),
          { role: 'user', content: userMessage }
        ];

        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages,
            max_tokens: 256,
            temperature: 0.7,
          });

          const reply = aiResponse.response || aiResponse.result?.response || "I'm here to help! Could you rephrase your question?";

          // Log to Supabase (non-blocking)
          try {
            await supabaseInsert('ai_chats', {
              visitor_ip: ip.substring(0, 10) + '***',
              user_message: userMessage.substring(0, 500),
              ai_response: reply.substring(0, 1000),
              page: body.page || '/',
              agent_id: body.agent_id || 'eva-default',
            }, env);
          } catch(e) { /* silent */ }

          return json({ reply }, 200, origin, env);

        } catch (aiErr) {
          console.error('AI error:', aiErr);
          return json({
            reply: "I'm currently experiencing high demand. Please try again in a moment, or contact us directly at info@evalisai.com!"
          }, 200, origin, env);
        }
      }

      // ─── POST /api/ai/document — Document Intelligence ───
      if (url.pathname === '/api/ai/document' && request.method === 'POST') {
        if (!checkRateLimit(ip, 5, 60000)) {
          return json({ error: 'Rate limit exceeded.' }, 429, origin, env);
        }

        const body = await request.json();
        const { text, doc_type } = body;
        if (!text) {
          return json({ error: 'Document text is required.' }, 400, origin, env);
        }

        const docPrompts = {
          invoice: 'Extract the following from this invoice: vendor name, invoice number, date, line items (description, quantity, amount), subtotal, tax (GST/CGST/SGST), total amount. Return as JSON.',
          contract: 'Extract key terms from this contract: parties involved, effective date, termination date, key obligations, payment terms, penalties. Return as JSON.',
          receipt: 'Extract from this receipt: store name, date, items purchased, amounts, total, payment method. Return as JSON.',
          general: 'Analyze this document and extract all key information, entities, dates, and amounts. Return as structured JSON.',
        };

        const prompt = docPrompts[doc_type] || docPrompts.general;

        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              { role: 'system', content: `You are a document analysis AI. ${prompt} Be precise and only return valid JSON.` },
              { role: 'user', content: text.substring(0, 4000) }
            ],
            max_tokens: 1024,
            temperature: 0.1,
          });

          const result = aiResponse.response || '{}';

          // Log processing
          try {
            await supabaseInsert('document_jobs', {
              doc_type: doc_type || 'general',
              input_length: text.length,
              status: 'completed',
              client_ip: ip.substring(0, 10) + '***',
            }, env);
          } catch(e) { /* silent */ }

          return json({ result, doc_type: doc_type || 'general' }, 200, origin, env);
        } catch(aiErr) {
          return json({ error: 'Document processing failed. Try again.' }, 500, origin, env);
        }
      }

      // ─── POST /api/leads/qualify — AI Lead Qualification ───
      if (url.pathname === '/api/leads/qualify' && request.method === 'POST') {
        if (!checkRateLimit(ip, 10, 60000)) {
          return json({ error: 'Rate limit exceeded.' }, 429, origin, env);
        }

        const body = await request.json();
        const { company_name, industry, website, notes } = body;
        if (!company_name) {
          return json({ error: 'Company name is required.' }, 400, origin, env);
        }

        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              { role: 'system', content: `You are a B2B lead qualification AI for Evalis AI. Analyze the prospect and return JSON with: score (1-100), qualification (hot/warm/cold), recommended_services (array from: WhatsApp AI Chatbot, AI Agent Builder, Workflow Automation, Document Intelligence, Lead Generation, Voice Agent, GEO, Web Dev, App Dev, SaaS, AI Data Services), suggested_pitch (2-3 sentences), estimated_deal_value_inr (number).` },
              { role: 'user', content: `Company: ${company_name}\nIndustry: ${industry || 'Unknown'}\nWebsite: ${website || 'N/A'}\nNotes: ${notes || 'None'}` }
            ],
            max_tokens: 512,
            temperature: 0.3,
          });

          const result = aiResponse.response || '{}';

          // Store lead
          try {
            await supabaseInsert('leads', {
              company_name: company_name.trim(),
              industry: industry || '',
              website: website || '',
              notes: notes || '',
              ai_score: result,
              status: 'new',
              source: 'api',
            }, env);
          } catch(e) { /* silent */ }

          return json({ qualification: result }, 200, origin, env);
        } catch(aiErr) {
          return json({ error: 'Lead qualification failed.' }, 500, origin, env);
        }
      }

      // ─── POST /api/agent/config — Create/Update White-Label Agent ───
      if (url.pathname === '/api/agent/config' && request.method === 'POST') {
        if (!checkRateLimit(ip, 5, 60000)) {
          return json({ error: 'Rate limit exceeded.' }, 429, origin, env);
        }

        const body = await request.json();
        if (!body.company_name || !body.contact_email) {
          return json({ error: 'Company name and contact email required.' }, 400, origin, env);
        }

        const agentId = 'agent_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        const config = await supabaseInsert('agent_configs', {
          agent_id: agentId,
          company_name: body.company_name.trim(),
          agent_name: body.agent_name?.trim() || 'AI Assistant',
          company_description: body.company_description || '',
          custom_knowledge: body.custom_knowledge || '',
          contact_email: body.contact_email.trim(),
          contact_phone: body.contact_phone || '',
          website: body.website || '',
          brand_color: body.brand_color || '#6366f1',
          is_active: true,
        }, env);

        // Generate embed script
        const embedScript = `<!-- ${body.company_name} AI Agent - Powered by Evalis AI -->
<script>
window.EVALIS_AGENT_CONFIG = {
  agentId: "${agentId}",
  agentName: "${body.agent_name || 'AI Assistant'}",
  brandColor: "${body.brand_color || '#6366f1'}",
  apiBase: "https://evalis-api.evalisglobal.workers.dev"
};
</script>
<script src="https://evalisai.com/js/agent-embed.js" defer></script>`;

        return json({
          success: true,
          agent_id: agentId,
          embed_code: embedScript,
          message: 'Agent created! Add the embed code to your website.'
        }, 201, origin, env);
      }

      // ─── GET /api/agent/config/:id — Get Agent Config ───
      if (url.pathname.startsWith('/api/agent/config/') && request.method === 'GET') {
        const agentId = url.pathname.split('/').pop();
        const configs = await supabaseSelect('agent_configs',
          `agent_id=eq.${encodeURIComponent(agentId)}&is_active=eq.true&limit=1`, env);

        if (configs.length === 0) {
          return json({ error: 'Agent not found' }, 404, origin, env);
        }

        const c = configs[0];
        return json({
          agent_id: c.agent_id,
          agent_name: c.agent_name,
          company_name: c.company_name,
          brand_color: c.brand_color,
        }, 200, origin, env);
      }

      // ─── WhatsApp Webhook Verification (GET) ───
      if (url.pathname === '/api/whatsapp/webhook' && request.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode === 'subscribe' && token === (env.WA_VERIFY_TOKEN || 'evalis_wa_2026')) {
          return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
        return new Response('Forbidden', { status: 403 });
      }

      // ─── WhatsApp Webhook (POST) — Receive & Reply ───
      if (url.pathname === '/api/whatsapp/webhook' && request.method === 'POST') {
        const body = await request.json();

        // Extract message from WhatsApp payload
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];

        if (!message || message.type !== 'text') {
          return new Response('ok', { status: 200 });
        }

        const from = message.from;
        const text = message.text?.body || '';
        const phoneId = changes?.value?.metadata?.phone_number_id;

        // Determine which client's bot this is
        let systemPrompt = SYSTEM_PROMPT;
        const clientId = url.searchParams.get('client');
        if (clientId) {
          try {
            const configs = await supabaseSelect('agent_configs',
              `agent_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&limit=1`, env);
            if (configs.length > 0) {
              systemPrompt = buildAgentPrompt(configs[0]);
            }
          } catch(e) { /* fallback */ }
        }

        // Generate AI reply
        let reply = "Thanks for reaching out! Our team will get back to you shortly.";
        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              { role: 'system', content: systemPrompt + '\nYou are replying on WhatsApp. Keep responses under 50 words. Use emojis sparingly.' },
              { role: 'user', content: text.substring(0, 500) }
            ],
            max_tokens: 128,
            temperature: 0.7,
          });
          reply = aiResponse.response || reply;
        } catch(e) { /* use fallback */ }

        // Send reply via WhatsApp API
        if (env.WA_ACCESS_TOKEN && phoneId) {
          try {
            await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.WA_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: from,
                type: 'text',
                text: { body: reply },
              }),
            });
          } catch(e) { console.error('WA send error:', e); }
        }

        // Log conversation
        try {
          await supabaseInsert('wa_chats', {
            phone_from: from.substring(0, 6) + '****',
            user_message: text.substring(0, 500),
            ai_response: reply.substring(0, 1000),
            client_id: clientId || 'evalis',
          }, env);
        } catch(e) { /* silent */ }

        return new Response('ok', { status: 200 });
      }

      // ─── POST /api/track ───
      if (url.pathname === '/api/track' && request.method === 'POST') {
        const body = await request.json();
        try {
          await supabaseInsert('analytics', {
            event: body.event || 'unknown',
            visitor_id: body.visitor_id || 'anon',
            session_id: body.session_id || '',
            page: body.page || '/',
            referrer: (body.referrer || '').substring(0, 500),
            device: body.device || '',
            browser: body.browser || '',
            screen_w: body.screenW || 0,
            screen_h: body.screenH || 0,
            lang: body.lang || '',
            duration_seconds: body.duration_seconds || 0,
            scroll_depth: body.scroll_depth || 0,
            cta_text: (body.cta_text || '').substring(0, 100),
            cta_href: (body.cta_href || '').substring(0, 300),
            title: (body.title || '').substring(0, 200),
          }, env);
        } catch(e) { /* silent */ }
        return json({ ok: true }, 200, origin, env);
      }

      // ─── POST /api/notify — Visitor Notification (Email + WhatsApp) ───
      if (url.pathname === '/api/notify' && request.method === 'POST') {
        // Rate limit: max 30 notifications per minute to prevent spam
        if (!checkRateLimit('notify:' + ip, 2, 300000)) {
          return json({ ok: true, throttled: true }, 200, origin, env);
        }

        const body = await request.json();
        const visitorPage = body.page || '/';
        const visitorRef = body.referrer || 'direct';
        const visitorDevice = body.device || 'unknown';
        const visitorBrowser = body.browser || 'unknown';
        const visitorLang = body.lang || 'en';
        const visitorCountry = body.country || '';
        const visitorCity = body.city || '';
        const visitorRegion = body.region || '';
        const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        const locationStr = [visitorCity, visitorRegion, visitorCountry].filter(Boolean).join(', ') || 'Unknown location';

        const notifMessage = `🔔 *New Visitor on Evalis AI*\n\n` +
          `📍 Location: ${locationStr}\n` +
          `📄 Page: ${visitorPage}\n` +
          `🔗 Referrer: ${visitorRef}\n` +
          `💻 Device: ${visitorDevice} / ${visitorBrowser}\n` +
          `🌐 Language: ${visitorLang}\n` +
          `🕐 Time: ${now} IST`;

        // 1. Send WhatsApp notification (if WA_ACCESS_TOKEN is configured)
        if (env.WA_ACCESS_TOKEN && env.WA_NOTIFY_PHONE_ID && env.WA_OWNER_NUMBER) {
          try {
            await fetch(`https://graph.facebook.com/v18.0/${env.WA_NOTIFY_PHONE_ID}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.WA_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: env.WA_OWNER_NUMBER,
                type: 'text',
                text: { body: notifMessage },
              }),
            });
          } catch(e) { console.error('WA notify error:', e); }
        }

        // 2. Send Email notification via MailChannels (free on Cloudflare Workers)
        try {
          await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{
                to: [{ email: env.NOTIFY_EMAIL || 'info@evalisai.com', name: 'Evalis AI' }],
              }],
              from: { email: 'noreply@evalisai.com', name: 'Evalis AI Tracker' },
              subject: `🔔 New Visitor: ${locationStr} — ${visitorPage}`,
              content: [{
                type: 'text/plain',
                value: notifMessage.replace(/\*/g, ''),
              }, {
                type: 'text/html',
                value: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0a0a0f;color:#e2e8f0;border-radius:12px;border:1px solid #1e293b;">
                  <h2 style="color:#a5b4fc;margin:0 0 16px;">🔔 New Visitor on Evalis AI</h2>
                  <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:8px 0;color:#94a3b8;">📍 Location</td><td style="padding:8px 0;font-weight:600;">${locationStr}</td></tr>
                    <tr><td style="padding:8px 0;color:#94a3b8;">📄 Page</td><td style="padding:8px 0;"><a href="https://evalisai.com${visitorPage}" style="color:#818cf8;">${visitorPage}</a></td></tr>
                    <tr><td style="padding:8px 0;color:#94a3b8;">🔗 Referrer</td><td style="padding:8px 0;">${visitorRef}</td></tr>
                    <tr><td style="padding:8px 0;color:#94a3b8;">💻 Device</td><td style="padding:8px 0;">${visitorDevice} / ${visitorBrowser}</td></tr>
                    <tr><td style="padding:8px 0;color:#94a3b8;">🌐 Language</td><td style="padding:8px 0;">${visitorLang}</td></tr>
                    <tr><td style="padding:8px 0;color:#94a3b8;">🕐 Time</td><td style="padding:8px 0;">${now} IST</td></tr>
                  </table>
                  <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Evalis AI Visitor Tracker — evalisai.com</p>
                </div>`,
              }],
            }),
          });
        } catch(e) { console.error('Email notify error:', e); }

        // 3. Log notification to Supabase
        try {
          await supabaseInsert('visitor_notifications', {
            ip_hash: ip.substring(0, 8) + '****',
            location: locationStr.substring(0, 200),
            page: visitorPage,
            referrer: visitorRef.substring(0, 300),
            device: visitorDevice,
            browser: visitorBrowser,
            language: visitorLang,
          }, env);
        } catch(e) { /* silent — table may not exist yet */ }

        return json({ ok: true, notified: true }, 200, origin, env);
      }

      // ─── POST /api/enquiry ───
      if (url.pathname === '/api/enquiry' && request.method === 'POST') {
        if (!checkRateLimit(ip, 3)) {
          return json({ error: 'Too many requests. Try again later.' }, 429, origin, env);
        }
        const body = await request.json();
        if (!body.name || !body.email || !body.message) {
          return json({ error: 'Name, email, and message are required.' }, 400, origin, env);
        }
        if (!validateEmail(body.email)) {
          return json({ error: 'Invalid email address.' }, 400, origin, env);
        }
        const result = await supabaseInsert('enquiries', {
          name: body.name.trim(),
          email: body.email.trim(),
          company: body.company?.trim() || '',
          service: body.service || '',
          budget: body.budget || '',
          message: body.message.trim(),
        }, env);
        return json({ success: true, message: 'Enquiry received!' }, 201, origin, env);
      }

      // ─── POST /api/contributor ───
      if (url.pathname === '/api/contributor' && request.method === 'POST') {
        if (!checkRateLimit(ip, 3)) {
          return json({ error: 'Too many requests.' }, 429, origin, env);
        }
        const body = await request.json();
        if (!body.name || !body.email || !body.primary_skill) {
          return json({ error: 'Name, email, and skill are required.' }, 400, origin, env);
        }
        if (!validateEmail(body.email)) {
          return json({ error: 'Invalid email.' }, 400, origin, env);
        }
        const result = await supabaseInsert('contributors', {
          name: body.name.trim(),
          email: body.email.trim(),
          primary_skill: body.primary_skill,
          experience: body.experience || '',
          languages: body.languages?.trim() || '',
          about: body.about?.trim() || '',
        }, env);
        return json({ success: true, message: 'Registration received!' }, 201, origin, env);
      }

      // ─── POST /api/waitlist ───
      if (url.pathname === '/api/waitlist' && request.method === 'POST') {
        if (!checkRateLimit(ip, 5)) {
          return json({ error: 'Too many requests.' }, 429, origin, env);
        }
        const body = await request.json();
        if (!body.email || !validateEmail(body.email)) {
          return json({ error: 'Valid email is required.' }, 400, origin, env);
        }
        await supabaseInsert('waitlist', {
          email: body.email.trim(),
          source: 'website',
          project_interest: body.project_interest || '',
        }, env);
        return json({ success: true, message: 'Added to waitlist!' }, 201, origin, env);
      }

      // ─── GET /api/projects ───
      if (url.pathname === '/api/projects' && request.method === 'GET') {
        const projects = await supabaseSelect('projects', 'order=sort_order.asc', env);
        return json(projects, 200, origin, env);
      }

      // ─── POST /api/ai/tts — Cloud Text-to-Speech (multi-model fallback) ───
      if (url.pathname === '/api/ai/tts' && request.method === 'POST') {
        if (!checkRateLimit(ip, 20, 60000)) {
          return new Response('Rate limited', { status: 429, headers: corsHeaders(origin, env) });
        }

        const body = await request.json();
        const text = (body.text || '').trim().substring(0, 500);
        if (!text) {
          return new Response('Text required', { status: 400, headers: corsHeaders(origin, env) });
        }

        // Try TTS models in order of quality
        const ttsModels = [
          { id: '@cf/deepgram/aura-2-en', params: { text } },
          { id: '@cf/myshell-ai/melotts', params: { text, language: body.language || 'en' } },
        ];

        for (const model of ttsModels) {
          try {
            const audio = await env.AI.run(model.id, model.params);
            if (audio && (audio.byteLength > 0 || audio instanceof ReadableStream)) {
              return new Response(audio, {
                status: 200,
                headers: {
                  'Content-Type': 'audio/wav',
                  'X-TTS-Model': model.id,
                  ...corsHeaders(origin, env),
                },
              });
            }
          } catch(e) {
            console.error(`TTS model ${model.id} failed:`, e.message);
          }
        }

        return new Response('All TTS models failed', { status: 500, headers: corsHeaders(origin, env) });
      }

      // ─── POST /api/ai/chat/stream — Streaming AI Chat (SSE) ───
      if (url.pathname === '/api/ai/chat/stream' && request.method === 'POST') {
        const body = await request.json();
        const agentId = body.agent_id || apiClient?.agent_id;

        if (!checkClientRateLimit(agentId, ip)) {
          return new Response('data: {"error":"Rate limited"}\n\n', {
            status: 429,
            headers: { 'Content-Type': 'text/event-stream', ...corsHeaders(origin, env) },
          });
        }

        const userMessage = body.message?.trim();
        if (!userMessage) {
          return new Response('data: {"error":"Message required"}\n\n', {
            status: 400,
            headers: { 'Content-Type': 'text/event-stream', ...corsHeaders(origin, env) },
          });
        }

        // Resolve system prompt (white-label support)
        let systemPrompt = SYSTEM_PROMPT;
        if (body.agent_id) {
          try {
            const configs = await supabaseSelect('agent_configs',
              `agent_id=eq.${encodeURIComponent(body.agent_id)}&is_active=eq.true&limit=1`, env);
            if (configs.length > 0) systemPrompt = buildAgentPrompt(configs[0]);
          } catch(e) { /* fallback */ }
        }

        const messages = [
          { role: 'system', content: systemPrompt },
          ...(body.history || []).slice(-6),
          { role: 'user', content: userMessage }
        ];

        // Use streaming AI response
        try {
          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages,
            max_tokens: 256,
            temperature: 0.7,
            stream: true,
          });

          // If the AI returns a ReadableStream, pipe it as SSE
          if (aiResponse instanceof ReadableStream) {
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            // Process the AI stream in background
            (async () => {
              const reader = aiResponse.getReader();
              const decoder = new TextDecoder();
              let fullResponse = '';

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });
                  // Parse SSE data lines from Workers AI
                  const lines = chunk.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6).trim();
                      if (data === '[DONE]') {
                        await writer.write(encoder.encode(`data: {"done":true,"full":"${fullResponse.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"}\n\n`));
                        continue;
                      }
                      try {
                        const parsed = JSON.parse(data);
                        const token = parsed.response || '';
                        fullResponse += token;
                        await writer.write(encoder.encode(`data: ${JSON.stringify({ token, partial: fullResponse })}\n\n`));
                      } catch(e) { /* skip unparseable chunks */ }
                    }
                  }
                }
              } catch(e) {
                await writer.write(encoder.encode(`data: {"error":"Stream interrupted"}\n\n`));
              } finally {
                // Log the chat (non-blocking)
                if (fullResponse) {
                  try {
                    await supabaseInsert('ai_chats', {
                      visitor_ip: ip.substring(0, 10) + '***',
                      user_message: userMessage.substring(0, 500),
                      ai_response: fullResponse.substring(0, 1000),
                      page: body.page || '/',
                      agent_id: body.agent_id || 'eva-default',
                    }, env);
                  } catch(e) { /* silent */ }
                }
                await writer.close();
              }
            })();

            return new Response(readable, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                ...corsHeaders(origin, env),
              },
            });
          }

          // Fallback: non-streaming response (wrap as SSE)
          const reply = aiResponse.response || "I'm here to help!";
          const sseData = `data: ${JSON.stringify({ token: reply, partial: reply })}\n\ndata: {"done":true,"full":"${reply.replace(/"/g, '\\"')}"}\n\n`;
          return new Response(sseData, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              ...corsHeaders(origin, env),
            },
          });

        } catch(aiErr) {
          console.error('Streaming AI error:', aiErr);
          return new Response(`data: {"error":"AI unavailable"}\n\n`, {
            status: 500,
            headers: { 'Content-Type': 'text/event-stream', ...corsHeaders(origin, env) },
          });
        }
      }

      // ─── POST /api/ai/stt — Speech-to-Text (Whisper) ───
      if (url.pathname === '/api/ai/stt' && request.method === 'POST') {
        if (!checkRateLimit(ip, 20, 60000)) {
          return new Response('Rate limited', { status: 429, headers: corsHeaders(origin, env) });
        }

        try {
          const audioData = await request.arrayBuffer();
          if (audioData.byteLength < 100) {
            return json({ error: 'Audio data too small' }, 400, origin, env);
          }

          const result = await env.AI.run('@cf/openai/whisper', {
            audio: [...new Uint8Array(audioData)],
          });

          return json({
            text: result.text || '',
            language: result.vtt ? 'detected' : 'en',
          }, 200, origin, env);

        } catch(sttErr) {
          console.error('STT error:', sttErr);
          return json({ error: 'Speech recognition failed' }, 500, origin, env);
        }
      }

      // ─── POST /api/ai/voice — Full Voice Pipeline (Audio In → Audio Out) ───
      if (url.pathname === '/api/ai/voice' && request.method === 'POST') {
        if (!checkRateLimit(ip, 15, 60000)) {
          return new Response('Rate limited', { status: 429, headers: corsHeaders(origin, env) });
        }

        try {
          // Step 1: Read the audio from the request
          const formData = await request.formData();
          const audioFile = formData.get('audio');
          const agentId = formData.get('agent_id') || null;
          const historyStr = formData.get('history') || '[]';
          let history = [];
          try { history = JSON.parse(historyStr); } catch(e) {}

          if (!audioFile) {
            return json({ error: 'Audio file required' }, 400, origin, env);
          }

          const audioBuffer = await audioFile.arrayBuffer();

          // Step 2: Speech-to-Text (Whisper)
          const sttResult = await env.AI.run('@cf/openai/whisper', {
            audio: [...new Uint8Array(audioBuffer)],
          });

          const userText = (sttResult.text || '').trim();
          if (!userText) {
            return json({ error: 'Could not understand audio', text: '' }, 200, origin, env);
          }

          // Step 3: AI Chat
          let systemPrompt = SYSTEM_PROMPT;
          if (agentId) {
            try {
              const configs = await supabaseSelect('agent_configs',
                `agent_id=eq.${encodeURIComponent(agentId)}&is_active=eq.true&limit=1`, env);
              if (configs.length > 0) systemPrompt = buildAgentPrompt(configs[0]);
            } catch(e) { /* fallback */ }
          }

          const messages = [
            { role: 'system', content: systemPrompt + '\nKeep responses under 60 words for voice conversations. Be concise and conversational.' },
            ...history.slice(-4),
            { role: 'user', content: userText }
          ];

          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages,
            max_tokens: 150,
            temperature: 0.7,
          });

          const reply = aiResponse.response || "I'm here to help!";

          // Step 4: Text-to-Speech (multi-model fallback)
          const cleanReply = reply.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
          let audioOut = null;
          const voiceModels = [
            { id: '@cf/deepgram/aura-2-en', params: { text: cleanReply.substring(0, 300) } },
            { id: '@cf/myshell-ai/melotts', params: { text: cleanReply.substring(0, 300), language: 'en' } },
          ];
          for (const m of voiceModels) {
            try {
              audioOut = await env.AI.run(m.id, m.params);
              if (audioOut) break;
            } catch(e) { /* try next */ }
          }

          // Log conversation
          try {
            await supabaseInsert('ai_chats', {
              visitor_ip: ip.substring(0, 10) + '***',
              user_message: userText.substring(0, 500),
              ai_response: reply.substring(0, 1000),
              page: '/voice',
              agent_id: agentId || 'eva-voice',
            }, env);
          } catch(e) { /* silent */ }

          // Return audio if TTS succeeded, otherwise JSON
          if (audioOut) {
            return new Response(audioOut, {
              status: 200,
              headers: {
                'Content-Type': 'audio/wav',
                'X-User-Text': encodeURIComponent(userText),
                'X-AI-Reply': encodeURIComponent(cleanReply.substring(0, 200)),
                ...corsHeaders(origin, env),
              },
            });
          }

          return json({ text: userText, reply, audio: null }, 200, origin, env);

        } catch(voiceErr) {
          console.error('Voice pipeline error:', voiceErr);
          return json({ error: 'Voice processing failed' }, 500, origin, env);
        }
      }

      // ─── Health check ───
      if (url.pathname === '/api/health') {
        return json({
          status: 'ok',
          service: 'Evalis AI API v3.1',
          features: ['ai-chat', 'ai-chat-stream', 'cloud-tts', 'cloud-stt', 'voice-pipeline', 'whatsapp-bot', 'document-ai', 'lead-qualify', 'agent-builder', 'tracking', 'forms', 'projects'],
          timestamp: new Date().toISOString()
        }, 200, origin, env);
      }

      return json({ error: 'Not found' }, 404, origin, env);

    } catch (err) {
      console.error('Worker error:', err);
      const isDuplicate = err.message?.includes('duplicate') || err.message?.includes('unique');
      if (isDuplicate) {
        return json({ error: 'This email is already registered.' }, 409, origin, env);
      }
      return json({ error: 'Internal server error' }, 500, origin, env);
    }
  },
};
