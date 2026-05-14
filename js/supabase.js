/* ============================================
   EVALIS AI — SUPABASE + WORKER CLIENT v2.1
   ============================================ */

// Configuration
const SUPABASE_URL = 'https://mdbgdlawjuoyuvqxthar.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kYmdkbGF3anVveXV2cXh0aGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDA1NDcsImV4cCI6MjA5NDExNjU0N30.IvVXnMXDiNIZHOrCrjsi84YT0IK11TikgPOxieyGUNE';
const WORKER_API = 'https://evalis-api.evalisglobal.workers.dev';

// Lightweight Supabase REST client (no SDK needed)
const supabase = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,

    headers() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Prefer': 'return=minimal'
        };
    },

    async insert(table, data) {
        const res = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Insert failed: ${res.status}`);
        }
        return { success: true };
    },

    async select(table, query = '') {
        const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
            headers: { ...this.headers(), 'Prefer': 'return=representation' }
        });
        if (!res.ok) throw new Error(`Select failed: ${res.status}`);
        return await res.json();
    }
};

// Worker API client (primary, with Supabase direct as fallback)
const workerAPI = {
    async post(endpoint, data) {
        try {
            const res = await fetch(`${WORKER_API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || `API error: ${res.status}`);
            return result;
        } catch (err) {
            console.warn('Worker API failed, falling back to direct Supabase:', err.message);
            throw err;
        }
    },

    async get(endpoint) {
        const res = await fetch(`${WORKER_API}${endpoint}`);
        if (!res.ok) throw new Error(`GET failed: ${res.status}`);
        return await res.json();
    }
};

// ============================================
// FORM HANDLERS
// ============================================

// Contact / Enquiry Form
async function submitEnquiry(form) {
    const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        company: form.company?.value?.trim() || '',
        service: form.service?.value || '',
        budget: form.budget?.value || '',
        message: form.message.value.trim()
    };

    try {
        // Try Worker API first (has rate limiting + validation)
        await workerAPI.post('/api/enquiry', data);
        showToast('✅ Enquiry submitted! We\'ll get back within 24 hours.');
        form.reset();
        return true;
    } catch (workerErr) {
        // Fallback to direct Supabase
        try {
            await supabase.insert('enquiries', data);
            showToast('✅ Enquiry submitted! We\'ll get back within 24 hours.');
            form.reset();
            return true;
        } catch (err) {
            console.error('Enquiry error:', err);
            showToast('❌ Something went wrong. Please try WhatsApp instead.');
            return false;
        }
    }
}

// Contributor Registration
async function submitContributor(form) {
    const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        primary_skill: form.primary_skill?.value || '',
        experience: form.experience?.value || '',
        languages: form.languages?.value?.trim() || '',
        about: form.about?.value?.trim() || ''
    };

    try {
        await workerAPI.post('/api/contributor', data);
        showToast('✅ Registration submitted! We\'ll contact you for matching projects.');
        form.reset();
        return true;
    } catch (workerErr) {
        try {
            await supabase.insert('contributors', data);
            showToast('✅ Registration submitted! We\'ll contact you for matching projects.');
            form.reset();
            return true;
        } catch (err) {
            if (err.message.includes('duplicate') || err.message.includes('unique')) {
                showToast('ℹ️ This email is already registered. We\'ll reach out when projects match.');
            } else {
                console.error('Contributor error:', err);
                showToast('❌ Something went wrong. Please try again.');
            }
            return false;
        }
    }
}

// Waitlist / Notify Me
async function submitWaitlist(email, projectInterest = '') {
    try {
        await workerAPI.post('/api/waitlist', {
            email: email.trim(),
            project_interest: projectInterest
        });
        showToast('✅ You\'re on the list! We\'ll notify you when this project opens.');
        return true;
    } catch (workerErr) {
        try {
            await supabase.insert('waitlist', {
                email: email.trim(),
                source: 'website',
                project_interest: projectInterest
            });
            showToast('✅ You\'re on the list! We\'ll notify you when this project opens.');
            return true;
        } catch (err) {
            if (err.message.includes('duplicate')) {
                showToast('ℹ️ You\'re already on the waitlist!');
            } else {
                showToast('❌ Something went wrong. Please try again.');
            }
            return false;
        }
    }
}

// Load projects from Supabase (dynamic)
async function loadProjects() {
    try {
        const projects = await workerAPI.get('/api/projects');
        return projects;
    } catch (err) {
        try {
            return await supabase.select('projects', 'order=sort_order.asc');
        } catch (e) {
            console.error('Failed to load projects:', e);
            return null; // Fall back to static HTML
        }
    }
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, duration = 4000) {
    let toast = document.getElementById('evalis-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'evalis-toast';
        toast.style.cssText = `
            position:fixed;bottom:90px;right:24px;z-index:10000;
            padding:14px 24px;border-radius:12px;font-size:0.9rem;font-weight:500;
            background:rgba(10,15,30,0.95);backdrop-filter:blur(20px);
            border:1px solid rgba(99,102,241,0.3);color:#e2e8f0;
            box-shadow:0 8px 30px rgba(0,0,0,0.3);
            transform:translateY(20px);opacity:0;
            transition:all 0.4s cubic-bezier(0.4,0,0.2,1);
            max-width:400px;line-height:1.5;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
    }, duration);
}

// ============================================
// NOTIFY ME MODAL
// ============================================
function showNotifyModal(projectName) {
    let modal = document.getElementById('notify-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'notify-modal';
    modal.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;z-index:10001;
        display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);
        animation:fadeIn 0.3s ease;
    `;
    modal.innerHTML = `
        <div style="background:rgba(10,15,30,0.95);border:1px solid rgba(99,102,241,0.3);
            border-radius:16px;padding:2rem;max-width:420px;width:90%;text-align:center;
            box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="font-size:2.5rem;margin-bottom:1rem;">🔔</div>
            <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;margin-bottom:0.5rem;color:#fff;">
                Get Notified
            </h3>
            <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:1.5rem;line-height:1.6;">
                Enter your email to get notified when <strong style="color:#a5b4fc;">${projectName}</strong> opens for contributors.
            </p>
            <input type="email" id="notify-email" placeholder="your@email.com" style="
                width:100%;padding:12px 16px;border-radius:10px;border:1px solid rgba(99,102,241,0.3);
                background:rgba(255,255,255,0.05);color:#fff;font-size:0.95rem;
                margin-bottom:1rem;outline:none;box-sizing:border-box;
            " />
            <div style="display:flex;gap:0.8rem;">
                <button onclick="document.getElementById('notify-modal').remove()" style="
                    flex:1;padding:12px;border-radius:10px;background:transparent;
                    border:1px solid rgba(255,255,255,0.1);color:#94a3b8;cursor:pointer;font-weight:600;
                ">Cancel</button>
                <button onclick="handleNotify('${projectName}')" style="
                    flex:1;padding:12px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#a855f7);
                    border:none;color:#fff;cursor:pointer;font-weight:600;
                ">Notify Me</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    document.getElementById('notify-email').focus();
}

async function handleNotify(projectName) {
    const emailInput = document.getElementById('notify-email');
    const email = emailInput?.value?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.style.borderColor = '#ef4444';
        return;
    }
    await submitWaitlist(email, projectName);
    document.getElementById('notify-modal')?.remove();
}

// ============================================
// AUTO-WIRE FORMS ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Wire contact form
    const contactForm = document.querySelector('form[action*="formspree"]');
    if (contactForm && window.location.pathname.includes('contact')) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.textContent = 'Submitting...';
            btn.disabled = true;
            const success = await submitEnquiry(contactForm);
            if (success) {
                setTimeout(() => window.location.href = 'thank-you.html', 1500);
            } else {
                btn.textContent = origText;
                btn.disabled = false;
            }
        });
    }

    // Wire careers form
    const careersForm = document.querySelector('form[action*="formspree"]');
    if (careersForm && window.location.pathname.includes('careers')) {
        careersForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = careersForm.querySelector('button[type="submit"]');
            const origText = btn.textContent;
            btn.textContent = 'Submitting...';
            btn.disabled = true;
            const success = await submitContributor(careersForm);
            if (success) {
                setTimeout(() => window.location.href = 'thank-you.html', 1500);
            } else {
                btn.textContent = origText;
                btn.disabled = false;
            }
        });
    }

    // Wire "Notify Me" buttons on projects page
    document.querySelectorAll('.join-btn.outline').forEach(btn => {
        if (btn.textContent.trim() === 'Notify Me') {
            const projectName = btn.closest('.project-card')?.querySelector('h3')?.textContent || 'this project';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showNotifyModal(projectName);
            });
        }
    });
});
