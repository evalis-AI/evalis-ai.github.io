/**
 * EVALIS AI — Cloudflare Worker API v2.0
 * Handles: AI Chat, Contact forms, Contributor registration,
 * Waitlist, User tracking, Rate limiting
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
function checkRateLimit(ip, limit = 5, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  rateLimits.set(ip, entry);
  return entry.count <= limit;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── AI System Prompt ───
const SYSTEM_PROMPT = `You are Eva, the friendly AI assistant for Evalis AI — a cutting-edge AI software company based in Perinthalmanna, Kerala, India.

About Evalis AI:
- Full-service AI & software company delivering global AI data services, web & app development, and SaaS platforms
- Founded and headquartered in Perinthalmanna, Malappuram District, Kerala, India
- Serving clients across all 14 districts of Kerala, pan-India, and worldwide
- Contact: evalisglobal@gmail.com | WhatsApp: +91 9544842260
- Website: https://evalis-ai.github.io

Core Services:
1. AI Data Services — Data labeling, LLM safety testing, search relevance evaluation, RLHF training data
2. Web Development — React, Next.js, full-stack websites and web applications
3. App Development — React Native, Flutter, cross-platform mobile apps
4. SaaS Platform Development — Multi-tenant platforms with auth, billing, analytics
5. AI Integration — Custom chatbots, workflow automation, AI agents, predictive analytics
6. Search & Content Evaluation — Human-powered search quality auditing, content moderation

Key Products:
- TrustScore: AI model evaluation framework
- AI Arena: Side-by-side model comparison tool
- AI Assessment: Organization AI readiness evaluation
- AI Marketplace: Connect businesses with AI talent

Why Evalis AI:
- Human-led intelligence with expert judgment
- Enterprise-grade security with NDA protection
- Rapid agile delivery
- Cost-effective premium quality
- Serving 50+ global clients with 150+ projects delivered

Instructions:
- Be warm, professional, and concise
- Keep responses under 100 words
- Recommend contacting the team for custom quotes
- If asked about competitors, stay positive about Evalis
- Always offer to connect with the team for detailed discussions`;

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
      // ─── POST /api/ai/chat ───
      if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
        if (!checkRateLimit(ip, 10, 60000)) {
          return json({ error: 'Too many requests. Please wait a moment.' }, 429, origin, env);
        }

        const body = await request.json();
        const userMessage = body.message?.trim();
        if (!userMessage) {
          return json({ error: 'Message is required.' }, 400, origin, env);
        }

        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
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
            }, env);
          } catch(e) { /* silent */ }

          return json({ reply }, 200, origin, env);

        } catch (aiErr) {
          console.error('AI error:', aiErr);
          return json({
            reply: "I'm currently experiencing high demand. Please try again in a moment, or contact us directly at evalisglobal@gmail.com!"
          }, 200, origin, env);
        }
      }

      // ─── POST /api/track ───
      if (url.pathname === '/api/track' && request.method === 'POST') {
        // Lightweight — no rate limiting on tracking
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

      // ─── Health check ───
      if (url.pathname === '/api/health') {
        return json({
          status: 'ok',
          service: 'Evalis AI API v2.0',
          features: ['ai-chat', 'tracking', 'forms', 'projects'],
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
