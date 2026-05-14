/**
 * EVALIS AI — Cloudflare Worker API
 * Handles: Contact forms, contributor registration, waitlist, rate limiting
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
        return json({ status: 'ok', service: 'Evalis AI API', timestamp: new Date().toISOString() }, 200, origin, env);
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
