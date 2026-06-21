/* ============================================
   EVALIS AI — VIDEO GENERATION TOOL — LOGIC
   ============================================ */

(function () {
    'use strict';

    // ─── Configuration ───
    const CONFIG = {
        API_BASE: 'https://evalis-api.evalisglobal.workers.dev',
        API_PATH: '/api/nim/video',
        MODEL: 'nvidia/cosmos-predict1-7b',
        STORAGE_KEY: 'evalis_vg_history',
        SESSION_KEY: 'evalis_vg_api_key',
        MAX_HISTORY: 20,
        MAX_PROMPT_LENGTH: 2000,
        DEFAULTS: {
            width: 1280,
            height: 704,
            framesCount: 121,
            fps: 24,
            guidanceScale: 7.5,
            steps: 50,
            seed: -1,
            promptUpsampling: true
        }
    };

    // ─── State ───
    let state = {
        apiKey: '',
        isAuthenticated: false,
        isGenerating: false,
        currentVideo: null,
        history: []
    };

    // ─── DOM Elements Cache ───
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ─── Initialize ───
    function init() {
        loadHistory();
        loadApiKey();
        bindEvents();
        renderHistory();
        updateCharCount();
    }

    // ─── API Key Management ───
    function loadApiKey() {
        const saved = sessionStorage.getItem(CONFIG.SESSION_KEY);
        if (saved) {
            state.apiKey = saved;
            state.isAuthenticated = true;
            updateApiKeyUI(true);
            const input = $('#vg-api-key');
            if (input) input.value = saved;
        }
    }

    function saveApiKey() {
        const input = $('#vg-api-key');
        const key = input.value.trim();
        if (!key) {
            showStatus('Please enter a valid NVIDIA NIM API key.', 'error');
            return;
        }
        state.apiKey = key;
        state.isAuthenticated = true;
        sessionStorage.setItem(CONFIG.SESSION_KEY, key);
        updateApiKeyUI(true);
        showStatus('API key saved for this session.', 'success');
    }

    function clearApiKey() {
        state.apiKey = '';
        state.isAuthenticated = false;
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
        updateApiKeyUI(false);
        const input = $('#vg-api-key');
        if (input) input.value = '';
    }

    function updateApiKeyUI(authenticated) {
        const section = $('.vg-api-key-section');
        const status = $('.vg-api-status');
        const saveBtn = $('.btn-key-save');

        if (authenticated) {
            section.classList.add('authenticated');
            status.className = 'vg-api-status connected';
            status.innerHTML = '● Connected';
            saveBtn.textContent = 'Disconnect';
            saveBtn.onclick = clearApiKey;
        } else {
            section.classList.remove('authenticated');
            status.className = 'vg-api-status disconnected';
            status.innerHTML = '○ Not Connected';
            saveBtn.textContent = 'Connect';
            saveBtn.onclick = saveApiKey;
        }
    }

    function toggleKeyVisibility() {
        const input = $('#vg-api-key');
        const btn = $('.btn-key-toggle');
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    }

    // ─── Settings Panel ───
    function toggleSettings() {
        const panel = $('.vg-settings');
        panel.classList.toggle('open');
    }

    // ─── Character Count ───
    function updateCharCount() {
        const textarea = $('#vg-prompt');
        const counter = $('.vg-char-count');
        if (textarea && counter) {
            const len = textarea.value.length;
            counter.textContent = `${len} / ${CONFIG.MAX_PROMPT_LENGTH}`;
            if (len > CONFIG.MAX_PROMPT_LENGTH) {
                counter.style.color = '#f43f5e';
            } else {
                counter.style.color = '';
            }
        }
    }

    // ─── Preset Prompts ───
    function usePreset(text) {
        const textarea = $('#vg-prompt');
        textarea.value = text;
        updateCharCount();
        textarea.focus();
    }

    // ─── Status Messages ───
    function showStatus(message, type = 'info') {
        const statusEl = $('.vg-status');
        statusEl.className = `vg-status visible ${type === 'generating' ? 'generating-status' : type}`;
        const icons = { info: 'ℹ️', success: '✅', error: '❌', generating: '⚡' };
        statusEl.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
    }

    function hideStatus() {
        const statusEl = $('.vg-status');
        statusEl.className = 'vg-status';
    }

    // ─── Progress Bar ───
    function showProgress() {
        const progress = $('.vg-progress');
        const bar = $('.vg-progress-bar');
        progress.classList.add('visible');
        bar.style.width = '0%';
    }

    function updateProgress(percent) {
        const bar = $('.vg-progress-bar');
        bar.style.width = `${Math.min(percent, 100)}%`;
    }

    function hideProgress() {
        const progress = $('.vg-progress');
        progress.classList.remove('visible');
    }

    // ─── Gather Parameters ───
    function getParams() {
        return {
            prompt: ($('#vg-prompt')?.value || '').trim(),
            negativePrompt: ($('#vg-negative-prompt')?.value || '').trim(),
            width: parseInt($('#vg-width')?.value || CONFIG.DEFAULTS.width),
            height: parseInt($('#vg-height')?.value || CONFIG.DEFAULTS.height),
            framesCount: parseInt($('#vg-frames')?.value || CONFIG.DEFAULTS.framesCount),
            fps: parseInt($('#vg-fps')?.value || CONFIG.DEFAULTS.fps),
            guidanceScale: parseFloat($('#vg-guidance')?.value || CONFIG.DEFAULTS.guidanceScale),
            steps: parseInt($('#vg-steps')?.value || CONFIG.DEFAULTS.steps),
            seed: parseInt($('#vg-seed')?.value || CONFIG.DEFAULTS.seed),
            promptUpsampling: $('.vg-toggle-upsample')?.classList.contains('active') ?? CONFIG.DEFAULTS.promptUpsampling
        };
    }

    // ─── Generate Video ───
    async function generateVideo() {
        if (state.isGenerating) return;

        // Validate
        if (!state.isAuthenticated) {
            showStatus('Please connect your NVIDIA NIM API key first.', 'error');
            return;
        }

        const params = getParams();
        if (!params.prompt) {
            showStatus('Please enter a video description prompt.', 'error');
            return;
        }

        if (params.prompt.length > CONFIG.MAX_PROMPT_LENGTH) {
            showStatus(`Prompt too long. Max ${CONFIG.MAX_PROMPT_LENGTH} characters.`, 'error');
            return;
        }

        state.isGenerating = true;
        updateGenerateButtonUI(true);
        showStatus('Initializing video generation pipeline...', 'generating');
        showProgress();

        // Simulate progress (actual API doesn't stream progress)
        const progressInterval = simulateProgress();

        try {
            const requestBody = {
                prompt: params.prompt,
                negative_prompt: params.negativePrompt || undefined,
                prompt_upsampling: params.promptUpsampling,
                guidance_scale: params.guidanceScale,
                steps: params.steps,
                video_params: {
                    height: params.height,
                    width: params.width,
                    frames_count: params.framesCount,
                    frames_per_sec: params.fps
                }
            };

            if (params.seed >= 0) {
                requestBody.seed = params.seed;
            }

            // Clean undefined values
            Object.keys(requestBody).forEach(key => {
                if (requestBody[key] === undefined) delete requestBody[key];
            });

            showStatus('Sending request to AI video generation model...', 'generating');
            updateProgress(15);

            const response = await fetch(`${CONFIG.API_BASE}${CONFIG.API_PATH}`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-NIM-API-Key': state.apiKey
                },
                body: JSON.stringify(requestBody)
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.detail || errData.message || errData.error || `API Error: ${response.status} ${response.statusText}`;
                throw new Error(errMsg);
            }

            updateProgress(80);
            showStatus('Processing video data...', 'generating');

            const data = await response.json();

            if (!data.b64_video) {
                throw new Error('No video data in response. The model may not support this configuration.');
            }

            updateProgress(95);

            // Decode base64 video
            const videoBlob = b64ToBlob(data.b64_video, 'video/mp4');
            const videoUrl = URL.createObjectURL(videoBlob);

            state.currentVideo = {
                url: videoUrl,
                blob: videoBlob,
                prompt: params.prompt,
                negativePrompt: params.negativePrompt,
                resolution: `${params.width}×${params.height}`,
                frames: params.framesCount,
                fps: params.fps,
                timestamp: new Date().toISOString()
            };

            updateProgress(100);
            displayVideo(videoUrl);
            addToHistory(state.currentVideo);
            showStatus('Video generated successfully!', 'success');

        } catch (err) {
            clearInterval(progressInterval);
            console.error('Video generation error:', err);

            let errorMsg = err.message;
            if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                errorMsg = 'Network error. This may be a CORS issue — the API may need a server-side proxy. Check the console for details.';
            } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                errorMsg = 'Invalid API key. Please check your NVIDIA NIM API key and try again.';
            } else if (err.message.includes('429')) {
                errorMsg = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (err.message.includes('402') || err.message.includes('insufficient')) {
                errorMsg = 'Insufficient credits. Please check your NVIDIA NIM account.';
            }

            showStatus(errorMsg, 'error');
        } finally {
            state.isGenerating = false;
            updateGenerateButtonUI(false);
            setTimeout(hideProgress, 1500);
        }
    }

    // ─── Simulate Progress ───
    function simulateProgress() {
        let progress = 5;
        return setInterval(() => {
            if (progress < 75) {
                progress += Math.random() * 3;
                updateProgress(progress);
            }
        }, 1000);
    }

    // ─── Base64 to Blob ───
    function b64ToBlob(b64Data, contentType = 'video/mp4') {
        const byteChars = atob(b64Data);
        const byteArrays = [];
        const sliceSize = 512;

        for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
            const slice = byteChars.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }

        return new Blob(byteArrays, { type: contentType });
    }

    // ─── Display Video ───
    function displayVideo(url) {
        const previewBody = $('.vg-preview-body');
        const previewContainer = $('.vg-preview');

        previewBody.innerHTML = `
            <video controls autoplay loop id="vg-video-player">
                <source src="${url}" type="video/mp4">
                Your browser does not support video playback.
            </video>
        `;
        previewContainer.classList.add('has-video');
    }

    // ─── Download Video ───
    function downloadVideo() {
        if (!state.currentVideo) {
            showStatus('No video to download.', 'error');
            return;
        }

        const a = document.createElement('a');
        a.href = state.currentVideo.url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `evalis-ai-video-${timestamp}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showStatus('Video download started.', 'success');
    }

    // ─── Copy Prompt ───
    function copyCurrentPrompt() {
        if (state.currentVideo?.prompt) {
            navigator.clipboard.writeText(state.currentVideo.prompt).then(() => {
                showStatus('Prompt copied to clipboard.', 'success');
            });
        }
    }

    // ─── Generate Button UI ───
    function updateGenerateButtonUI(generating) {
        const btn = $('.vg-btn-generate');
        if (generating) {
            btn.classList.add('generating');
            btn.disabled = true;
        } else {
            btn.classList.remove('generating');
            btn.disabled = false;
        }
    }

    // ─── History Management ───
    function loadHistory() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            state.history = stored ? JSON.parse(stored) : [];
        } catch {
            state.history = [];
        }
    }

    function saveHistory() {
        try {
            // Don't store blob URLs in localStorage (they are session-only)
            const serializable = state.history.map(item => ({
                prompt: item.prompt,
                negativePrompt: item.negativePrompt,
                resolution: item.resolution,
                frames: item.frames,
                fps: item.fps,
                timestamp: item.timestamp
            }));
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(serializable));
        } catch (e) {
            console.warn('Failed to save history:', e);
        }
    }

    function addToHistory(item) {
        state.history.unshift({
            prompt: item.prompt,
            negativePrompt: item.negativePrompt,
            resolution: item.resolution,
            frames: item.frames,
            fps: item.fps,
            timestamp: item.timestamp
        });

        if (state.history.length > CONFIG.MAX_HISTORY) {
            state.history = state.history.slice(0, CONFIG.MAX_HISTORY);
        }

        saveHistory();
        renderHistory();
    }

    function clearHistory() {
        if (confirm('Clear all generation history?')) {
            state.history = [];
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            renderHistory();
            showStatus('History cleared.', 'info');
        }
    }

    function renderHistory() {
        const list = $('.vg-history-list');
        const countEl = $('.vg-history-count');

        if (!list) return;

        countEl.textContent = state.history.length;

        if (state.history.length === 0) {
            list.innerHTML = `
                <div class="vg-history-empty">
                    <div class="empty-icon">📂</div>
                    <p>No generations yet.<br>Create your first video!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = state.history.map((item, i) => `
            <div class="vg-history-item" onclick="window._vgLoadHistoryItem(${i})" title="${escapeHtml(item.prompt)}">
                <div class="item-prompt">${escapeHtml(item.prompt)}</div>
                <div class="item-meta">
                    <span>${formatTimeAgo(item.timestamp)}</span>
                    <span class="item-resolution">${item.resolution}</span>
                </div>
            </div>
        `).join('');
    }

    function loadHistoryItem(index) {
        const item = state.history[index];
        if (!item) return;

        const promptEl = $('#vg-prompt');
        const negPromptEl = $('#vg-negative-prompt');

        if (promptEl) promptEl.value = item.prompt;
        if (negPromptEl) negPromptEl.value = item.negativePrompt || '';
        updateCharCount();

        showStatus(`Loaded prompt from history. Click "Generate" to create a new video.`, 'info');
    }

    // ─── Utility Functions ───
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatTimeAgo(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ─── Range Slider Updates ───
    function updateRangeValue(sliderId, displayId) {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(displayId);
        if (slider && display) {
            display.textContent = slider.value;
        }
    }

    // ─── Toggle Prompt Upsampling ───
    function toggleUpsampling() {
        const toggle = $('.vg-toggle-upsample');
        toggle.classList.toggle('active');
    }

    // ─── Event Bindings ───
    function bindEvents() {
        // API Key
        const saveBtn = $('.btn-key-save');
        if (saveBtn) saveBtn.onclick = state.isAuthenticated ? clearApiKey : saveApiKey;

        const toggleBtn = $('.btn-key-toggle');
        if (toggleBtn) toggleBtn.onclick = toggleKeyVisibility;

        const apiKeyInput = $('#vg-api-key');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !state.isAuthenticated) saveApiKey();
            });
        }

        // Settings toggle
        const settingsToggle = $('.vg-settings-toggle');
        if (settingsToggle) settingsToggle.onclick = toggleSettings;

        // Character count
        const promptTextarea = $('#vg-prompt');
        if (promptTextarea) promptTextarea.addEventListener('input', updateCharCount);

        // Generate
        const genBtn = $('.vg-btn-generate');
        if (genBtn) genBtn.onclick = generateVideo;

        // Download
        const downloadBtn = $('#vg-btn-download');
        if (downloadBtn) downloadBtn.onclick = downloadVideo;

        // Copy prompt
        const copyBtn = $('#vg-btn-copy');
        if (copyBtn) copyBtn.onclick = copyCurrentPrompt;

        // Clear history
        const clearBtn = $('.vg-history-clear');
        if (clearBtn) clearBtn.onclick = clearHistory;

        // Range sliders
        const guidanceSlider = $('#vg-guidance');
        if (guidanceSlider) {
            guidanceSlider.addEventListener('input', () => updateRangeValue('vg-guidance', 'vg-guidance-val'));
        }

        const stepsSlider = $('#vg-steps');
        if (stepsSlider) {
            stepsSlider.addEventListener('input', () => updateRangeValue('vg-steps', 'vg-steps-val'));
        }

        const framesSlider = $('#vg-frames');
        if (framesSlider) {
            framesSlider.addEventListener('input', () => updateRangeValue('vg-frames', 'vg-frames-val'));
        }

        // Toggle upsampling
        const upsampleToggle = $('.vg-toggle-upsample');
        if (upsampleToggle) upsampleToggle.onclick = toggleUpsampling;

        // Presets
        $$('.vg-preset-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                usePreset(chip.dataset.prompt);
            });
        });

        // Keyboard shortcut: Ctrl+Enter to generate
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                generateVideo();
            }
        });
    }

    // ─── Expose Globals ───
    window._vgLoadHistoryItem = loadHistoryItem;

    // ─── Boot ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
