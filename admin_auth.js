(function () {
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxXVonS2efn71YS909fXgbLtxm80jihUuO3aYIVzgWiRTgY9Pj59H5xnAG9OiG5H7JD/exec';
    const AUTH_KEY = 'fx_staff_authed';
    const STAFF_NAME_KEY = 'fx_staff_name';

    const TEXT = {
        en: {
            title: 'Staff Area Login',
            desc: 'Enter staff credentials to continue.',
            user: 'Staff ID',
            pass: 'Password',
            submit: 'Sign In',
            loading: 'Verifying...',
            cancel: 'Cancel',
            error: 'Invalid staff ID or password.'
        },
        'zh-TW': {
            title: '員工專區登入',
            desc: '請輸入員工帳號密碼以繼續。',
            user: '員工編號',
            pass: '密碼',
            submit: '登入',
            loading: '驗證中...',
            cancel: '取消',
            error: '帳號或密碼錯誤。'
        },
        'zh-CN': {
            title: '员工专区登录',
            desc: '请输入员工账号密码以继续。',
            user: '员工编号',
            pass: '密码',
            submit: '登录',
            loading: '验证中...',
            cancel: '取消',
            error: '账号或密码错误。'
        }
    };

    function currentLang() {
        const lang = localStorage.getItem('fx_spectrum_lang') || document.documentElement.lang || 'en';
        return TEXT[lang] ? lang : 'en';
    }

    function ensureStyle() {
        if (document.getElementById('fx-staff-auth-style')) return;
        const style = document.createElement('style');
        style.id = 'fx-staff-auth-style';
        style.textContent = `
            .fx-staff-overlay { position: fixed; inset: 0; z-index: 220; background: rgba(2,6,23,.65); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 16px; }
            .fx-staff-overlay.active { display: flex; }
            .fx-staff-card { width: min(92vw, 420px); background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 24px 50px rgba(15,23,42,.22); padding: 20px; }
            .fx-staff-input { width: 100%; border: 1px solid #dbe2ea; border-radius: 10px; padding: 10px 12px; outline: none; font-size: 14px; }
            .fx-staff-input:focus { border-color: #06B6D4; box-shadow: 0 0 0 3px rgba(6,182,212,.14); }
            .fx-staff-row { display: flex; gap: 10px; margin-top: 14px; }
            .fx-staff-btn { flex: 1; border: none; border-radius: 10px; padding: 10px 12px; font-weight: 700; cursor: pointer; }
            .fx-staff-btn-primary { color: #fff; background: #0f172a; }
            .fx-staff-btn-secondary { color: #334155; background: #f1f5f9; }
            .fx-staff-error { margin-top: 10px; font-size: 12px; color: #e11d48; display: none; }
        `;
        document.head.appendChild(style);
    }

    function ensureModal() {
        if (document.getElementById('fx-staff-auth-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'fx-staff-auth-overlay';
        overlay.className = 'fx-staff-overlay';
        overlay.innerHTML = `
            <div class="fx-staff-card" onclick="event.stopPropagation()">
                <h3 id="fx-staff-title" style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0f172a;"></h3>
                <p id="fx-staff-desc" style="margin:0 0 14px;font-size:13px;color:#64748b;"></p>
                <label id="fx-staff-user-label" style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;"></label>
                <input id="fx-staff-user" class="fx-staff-input" type="text" />
                <label id="fx-staff-pass-label" style="display:block;font-size:12px;font-weight:700;color:#334155;margin:10px 0 6px;"></label>
                <input id="fx-staff-pass" class="fx-staff-input" type="password" />
                <div class="fx-staff-row">
                    <button id="fx-staff-cancel" type="button" class="fx-staff-btn fx-staff-btn-secondary"></button>
                    <button id="fx-staff-submit" type="button" class="fx-staff-btn fx-staff-btn-primary"></button>
                </div>
                <p id="fx-staff-error" class="fx-staff-error"></p>
            </div>
        `;
        overlay.addEventListener('click', closeStaffLoginModal);
        document.body.appendChild(overlay);
    }

    function applyText() {
        const lang = currentLang();
        const t = TEXT[lang];
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('fx-staff-title', t.title);
        set('fx-staff-desc', t.desc);
        set('fx-staff-user-label', t.user);
        set('fx-staff-pass-label', t.pass);
        set('fx-staff-submit', t.submit);
        set('fx-staff-cancel', t.cancel);
        set('fx-staff-error', t.error);
        const userInput = document.getElementById('fx-staff-user');
        const passInput = document.getElementById('fx-staff-pass');
        if (userInput) userInput.placeholder = 'staff-001';
        if (passInput) passInput.placeholder = '********';
    }

    function closeStaffLoginModal() {
        const overlay = document.getElementById('fx-staff-auth-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openStaffLoginModal() {
        ensureStyle();
        ensureModal();
        applyText();
        const overlay = document.getElementById('fx-staff-auth-overlay');
        const err = document.getElementById('fx-staff-error');
        const userInput = document.getElementById('fx-staff-user');
        const passInput = document.getElementById('fx-staff-pass');
        if (err) err.style.display = 'none';
        if (userInput) userInput.value = '';
        if (passInput) passInput.value = '';
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        userInput?.focus();
    }

    function bindModalEvents() {
        const submit = document.getElementById('fx-staff-submit');
        const cancel = document.getElementById('fx-staff-cancel');
        const userInput = document.getElementById('fx-staff-user');
        const passInput = document.getElementById('fx-staff-pass');
        const err = document.getElementById('fx-staff-error');
        if (!submit || submit.dataset.bound === '1') return;
        submit.dataset.bound = '1';
        submit.addEventListener('click', async () => {
            const lang = currentLang();
            const t = TEXT[lang] || TEXT.en;
            const staffId = (userInput?.value || '').trim();
            const password = passInput?.value || '';
            if (err) err.style.display = 'none';
            submit.disabled = true;
            submit.textContent = t.loading;
            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'login', staffId, password })
                });
                const raw = await response.text();
                let result;
                try {
                    result = JSON.parse(raw);
                } catch {
                    result = { success: false, message: t.error };
                }
                if (!response.ok && !result?.success) {
                    throw new Error(result?.message || `HTTP_${response.status}`);
                }
                if (result?.success) {
                    const staffName = result?.user?.name || result?.staffName || result?.name || 'Staff';
                    localStorage.setItem(AUTH_KEY, '1');
                    localStorage.setItem(STAFF_NAME_KEY, staffName);
                    closeStaffLoginModal();
                    window.location.href = 'admin-dashboard.html';
                    return;
                }
                if (err) {
                    err.textContent = result?.message || t.error;
                    err.style.display = 'block';
                }
            } catch (_e) {
                if (err) {
                    err.textContent = t.error;
                    err.style.display = 'block';
                }
            } finally {
                submit.disabled = false;
                submit.textContent = t.submit;
            }
        });
        cancel?.addEventListener('click', closeStaffLoginModal);
        passInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit.click();
        });
    }

    function bindTriggers() {
        document.querySelectorAll('[data-open-staff-login]').forEach((el) => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu && mobileMenu.classList.contains('active') && typeof window.toggleMobileMenu === 'function') {
                    window.toggleMobileMenu();
                }
                openStaffLoginModal();
                bindModalEvents();
            });
        });
    }

    function isAuthed() {
        return localStorage.getItem(AUTH_KEY) === '1';
    }

    function requireStaffAuth() {
        if (!isAuthed()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    function logoutStaff() {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(STAFF_NAME_KEY);
        window.location.href = 'index.html';
    }

    window.openStaffLoginModal = openStaffLoginModal;
    window.requireStaffAuth = requireStaffAuth;
    window.logoutStaff = logoutStaff;
    window.isStaffAuthed = isAuthed;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindTriggers);
    } else {
        bindTriggers();
    }
})();
