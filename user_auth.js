(function () {
    const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw636uk0zpcQJu9nvmCHwc6DFrtwNyNTLLqNCWj4H9-pNxiYPfEuYwOb37dZxu--_SBUg/exec';
    const MEMBER_NAME_KEY = 'fx_member_name';
    const MEMBER_EMAIL_KEY = 'fx_member_email';
    const MEMBER_METHOD_KEY = 'fx_member_method';
    const GOOGLE_CLIENT_ID = window.FX_GOOGLE_CLIENT_ID || '596871995844-lh6nirpt5siuq2blmb8sbe4u1urpsqrm.apps.googleusercontent.com';
    const FACEBOOK_APP_ID = window.FX_FACEBOOK_APP_ID || '';
    const APPLE_CLIENT_ID = window.FX_APPLE_CLIENT_ID || '';
    const APPLE_REDIRECT_URI = window.FX_APPLE_REDIRECT_URI || window.location.origin;

    let pendingAuth = null;
    let googleTokenClient = null;
    let fbSdkReady = false;
    let appleSdkReady = false;
    const I18N = {
        zh: {
            signupTitle: '註冊會員',
            signupDesc: '請選擇第三方登入方式。',
            btnGoogle: '使用 Google 註冊',
            btnApple: '使用 Apple ID 註冊',
            btnFacebook: '使用 Facebook 註冊',
            btnConfirmLogin: '確認登入',
            btnProcessing: '處理中...',
            btnVerifying: '驗證中...',
            btnCancelHome: '取消（返回首頁）',
            btnLogout: '登出 (Logout)',
            errGeneric: '驗證失敗，請稍後再試。',
            errProvider: '第三方驗證失敗，請確認 SDK 設定。',
            errMissingEmail: '無法取得 Email，請確認第三方帳號授權 Email 權限。',
            errConfirm: '處理失敗，請稍後再試。',
            msgWelcomeBack: (name) => `歡迎回來 ${name}，是否確認登入？`,
            msgCreating: '尚未註冊，系統正在建立會員資料...',
            msgCreated: (name) => `尚未註冊，已自動建立會員：${name}，請確認登入。`,
            msgLoggedIn: (name) => `目前已登入：${name}。若需切換帳號，請先登出。`,
            alertWelcome: (name) => `歡迎回來，${name}`
        },
        en: {
            signupTitle: 'Member Sign Up',
            signupDesc: 'Please choose a third-party sign-in method.',
            btnGoogle: 'Continue with Google',
            btnApple: 'Continue with Apple ID',
            btnFacebook: 'Continue with Facebook',
            btnConfirmLogin: 'Confirm Sign In',
            btnProcessing: 'Processing...',
            btnVerifying: 'Verifying...',
            btnCancelHome: 'Cancel (Back to Home)',
            btnLogout: 'Logout',
            errGeneric: 'Verification failed. Please try again later.',
            errProvider: 'Third-party verification failed. Please check SDK settings.',
            errMissingEmail: 'Unable to get email. Please grant email permission in provider consent.',
            errConfirm: 'Action failed. Please try again later.',
            msgWelcomeBack: (name) => `Welcome back ${name}, confirm sign in?`,
            msgCreating: 'Not registered. Creating member profile...',
            msgCreated: (name) => `Not registered. Profile created for ${name}. Please confirm sign in.`,
            msgLoggedIn: (name) => `Signed in as ${name}. Logout first to switch account.`,
            alertWelcome: (name) => `Welcome back, ${name}`
        }
    };

    function loadScript(src, id) {
        return new Promise((resolve, reject) => {
            if (id && document.getElementById(id)) return resolve();
            const script = document.createElement('script');
            if (id) script.id = id;
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`load_failed:${src}`));
            document.head.appendChild(script);
        });
    }

    async function ensureGoogleSDK() {
        await loadScript('https://accounts.google.com/gsi/client', 'fx-google-sdk');
        if (!window.google?.accounts?.oauth2) throw new Error('google_sdk_unavailable');
        if (!GOOGLE_CLIENT_ID) throw new Error('google_client_id_missing');
        if (!googleTokenClient) {
            googleTokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'openid email profile',
                callback: () => {}
            });
        }
    }

    async function ensureFacebookSDK() {
        if (fbSdkReady) return;
        await loadScript('https://connect.facebook.net/en_US/sdk.js', 'fx-facebook-sdk');
        if (!window.FB) throw new Error('facebook_sdk_unavailable');
        if (!FACEBOOK_APP_ID) throw new Error('facebook_app_id_missing');
        window.FB.init({
            appId: FACEBOOK_APP_ID,
            cookie: true,
            xfbml: false,
            version: 'v20.0'
        });
        fbSdkReady = true;
    }

    async function ensureAppleSDK() {
        if (appleSdkReady) return;
        await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js', 'fx-apple-sdk');
        if (!window.AppleID?.auth) throw new Error('apple_sdk_unavailable');
        if (!APPLE_CLIENT_ID) throw new Error('apple_client_id_missing');
        window.AppleID.auth.init({
            clientId: APPLE_CLIENT_ID,
            scope: 'name email',
            redirectURI: APPLE_REDIRECT_URI,
            state: 'fx-spectrum-member-auth',
            usePopup: true
        });
        appleSdkReady = true;
    }

    function ensureSignUpModal() {
        if (document.getElementById('fx-signup-overlay')) return;
        const style = document.createElement('style');
        style.textContent = `
            .fx-signup-overlay { position: fixed; inset: 0; z-index: 230; display: none; align-items: center; justify-content: center; background: rgba(2,6,23,.65); backdrop-filter: blur(4px); padding: 16px; }
            .fx-signup-overlay.active { display: flex; }
            .fx-signup-card { width: min(94vw, 460px); background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 20px 45px rgba(15,23,42,.25); padding: 20px; }
            .fx-signup-provider { width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; color: #0f172a; font-weight: 700; font-size: 14px; padding: 10px 12px; margin-top: 8px; cursor: pointer; }
            .fx-signup-provider:hover { background: #f1f5f9; }
            .fx-signup-provider:disabled { opacity: 0.65; cursor: not-allowed; }
            .fx-signup-provider-row { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
            .fx-signup-provider-svg { width: 18px; height: 18px; display: inline-block; flex: none; }
            .fx-signup-provider-icon-facebook { width: 18px; height: 18px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; background: #1877f2; }
            .fx-signup-error { color: #e11d48; font-size: 12px; margin-top: 8px; display: none; }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'fx-signup-overlay';
        overlay.className = 'fx-signup-overlay';
        overlay.innerHTML = `
            <div class="fx-signup-card" onclick="event.stopPropagation()">
                <h3 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0f172a;"></h3>
                <p id="fx-signup-desc" style="margin:0 0 14px;font-size:13px;color:#64748b;"></p>
                <div id="fx-signup-provider-group">
                    <button id="fx-signup-google" class="fx-signup-provider" type="button">${buildProviderButtonHTML('google')}</button>
                    <button id="fx-signup-apple" class="fx-signup-provider" type="button">${buildProviderButtonHTML('apple')}</button>
                    <button id="fx-signup-facebook" class="fx-signup-provider" type="button">${buildProviderButtonHTML('facebook')}</button>
                </div>
                <button id="fx-signup-primary" class="fx-signup-provider" style="display:none;background:#0f172a;color:#22d3ee;" type="button"></button>
                <button id="fx-signup-cancel" class="fx-signup-provider" style="background:#fff;color:#475569;" type="button"></button>
                <p id="fx-signup-error" class="fx-signup-error"></p>
                <p id="fx-signup-debug" style="display:none;margin-top:8px;font-size:11px;color:#64748b;line-height:1.5;"></p>
            </div>
        `;
        overlay.addEventListener('click', closeSignUpModal);
        document.body.appendChild(overlay);

        document.getElementById('fx-signup-google')?.addEventListener('click', () => startMemberAuthFlow('Google'));
        document.getElementById('fx-signup-apple')?.addEventListener('click', () => startMemberAuthFlow('Apple ID'));
        document.getElementById('fx-signup-facebook')?.addEventListener('click', () => startMemberAuthFlow('Facebook'));
        document.getElementById('fx-signup-primary')?.addEventListener('click', handlePendingAuthConfirm);
        document.getElementById('fx-signup-cancel')?.addEventListener('click', () => {
            if (localStorage.getItem(MEMBER_NAME_KEY)) {
                logoutMember();
            } else {
                window.location.href = 'index.html';
            }
        });
        applyModalLocale();
    }

    function buildProviderButtonHTML(type) {
        const dict = getLocaleDict();
        if (type === 'google') {
            return `<span class="fx-signup-provider-row">
                <svg class="fx-signup-provider-svg" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.2 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.3 39.6 16 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.7-2.8 4.9-5 6.5l6.2 5.2C39.8 36.5 44 30.7 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg><span>${dict.btnGoogle}</span></span>`;
        }
        if (type === 'apple') {
            return `<span class="fx-signup-provider-row">
                <svg class="fx-signup-provider-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#111827" d="M16.365 1.43c0 1.14-.415 2.214-1.145 3.068-.738.864-1.957 1.53-3.073 1.494-.146-1.08.427-2.233 1.15-3.058.744-.862 2.03-1.526 3.068-1.504zM20.926 17.028c-.567 1.26-.838 1.82-1.568 2.958-1.02 1.595-2.46 3.584-4.247 3.6-1.586.015-1.994-1.03-4.148-1.018-2.154.01-2.603 1.036-4.188 1.02-1.788-.017-3.15-1.807-4.17-3.4-2.857-4.46-3.157-9.696-1.394-12.43 1.25-1.93 3.224-3.06 5.08-3.06 1.89 0 3.08 1.038 4.638 1.038 1.512 0 2.433-1.04 4.624-1.04 1.654 0 3.408.9 4.658 2.45-4.086 2.26-3.424 8.097.715 9.882z"/>
                </svg><span>${dict.btnApple}</span></span>`;
        }
        return `<span class="fx-signup-provider-row"><span class="fx-signup-provider-icon-facebook">f</span><span>${dict.btnFacebook}</span></span>`;
    }

    function getCurrentLang() {
        const raw = (localStorage.getItem('language') || document.documentElement.lang || '').toLowerCase();
        if (raw.startsWith('en')) return 'en';
        return 'zh';
    }

    function getLocaleDict() {
        return I18N[getCurrentLang()] || I18N.zh;
    }

    function applyModalLocale() {
        const dict = getLocaleDict();
        const titleEl = document.querySelector('#fx-signup-overlay h3');
        const descEl = document.getElementById('fx-signup-desc');
        const primaryBtn = document.getElementById('fx-signup-primary');
        const cancelBtn = document.getElementById('fx-signup-cancel');
        const errEl = document.getElementById('fx-signup-error');
        const googleBtn = document.getElementById('fx-signup-google');
        const appleBtn = document.getElementById('fx-signup-apple');
        const facebookBtn = document.getElementById('fx-signup-facebook');
        if (titleEl) titleEl.textContent = dict.signupTitle;
        if (descEl && !pendingAuth) descEl.textContent = dict.signupDesc;
        if (primaryBtn && primaryBtn.style.display !== 'none') primaryBtn.textContent = dict.btnConfirmLogin;
        if (cancelBtn) cancelBtn.textContent = localStorage.getItem(MEMBER_NAME_KEY) ? dict.btnLogout : dict.btnCancelHome;
        if (errEl && !errEl.textContent) errEl.textContent = dict.errGeneric;
        if (googleBtn) googleBtn.innerHTML = buildProviderButtonHTML('google');
        if (appleBtn) appleBtn.innerHTML = buildProviderButtonHTML('apple');
        if (facebookBtn) facebookBtn.innerHTML = buildProviderButtonHTML('facebook');
    }

    function setSignupDebug(message) {
        const debugEl = document.getElementById('fx-signup-debug');
        if (!debugEl) return;
        if (!message) {
            debugEl.style.display = 'none';
            debugEl.textContent = '';
            return;
        }
        debugEl.textContent = String(message);
        debugEl.style.display = 'block';
    }

    function setProviderButtonsLoading(loading, label) {
        const dict = getLocaleDict();
        ['fx-signup-google', 'fx-signup-apple', 'fx-signup-facebook'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = loading;
            if (loading) btn.textContent = `${dict.btnVerifying} ${label}`;
        });
    }

    function restoreProviderButtons() {
        const map = {
            'fx-signup-google': 'google',
            'fx-signup-apple': 'apple',
            'fx-signup-facebook': 'facebook'
        };
        Object.entries(map).forEach(([id, type]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.innerHTML = buildProviderButtonHTML(type);
        });
    }

    function detectSource() {
        const pageTitle = (document.title || '').trim();
        if (pageTitle) return pageTitle;
        const path = (window.location.pathname || '').toLowerCase();
        if (path.endsWith('/index.html') || path === '/' || path === '') return '首頁';
        return path.split('/').pop() || 'Unknown_Page';
    }

    function closeSignUpModal() {
        document.getElementById('fx-signup-overlay')?.classList.remove('active');
        document.body.style.overflow = '';
        pendingAuth = null;
    }

    function setModalState(state, message, primaryLabel) {
        const titleEl = document.querySelector('#fx-signup-overlay h3');
        const descEl = document.getElementById('fx-signup-desc');
        const providers = document.getElementById('fx-signup-provider-group');
        const primaryBtn = document.getElementById('fx-signup-primary');
        const cancelBtn = document.getElementById('fx-signup-cancel');
        const dict = getLocaleDict();
        if (titleEl) titleEl.textContent = state === 'confirm-login' ? `${dict.msgWelcomeBack(pendingAuth?.userName || '')}` : dict.signupTitle;
        if (descEl) descEl.textContent = message || dict.signupDesc;
        if (providers) providers.style.display = state === 'select-provider' ? 'block' : 'none';
        if (primaryBtn) {
            primaryBtn.style.display = state === 'confirm-login' || state === 'confirm-register' ? 'block' : 'none';
            primaryBtn.textContent = primaryLabel || dict.btnConfirmLogin;
        }
        if (cancelBtn) cancelBtn.textContent = localStorage.getItem(MEMBER_NAME_KEY) ? dict.btnLogout : dict.btnCancelHome;
    }

    async function postToCRM(payload) {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const text = await res.text();
        let result = {};
        try { result = JSON.parse(text); } catch { result = {}; }
        const action = payload?.action || 'unknown';
        const msg = result?.message || '';
        setSignupDebug(`[${action}] HTTP ${res.status}${msg ? ` - ${msg}` : ''}`);
        return { ok: res.ok, result };
    }

    async function queryUserFromCRM(email) {
        const payload = { action: 'check_user', email, sheet: '工作表1', identifierColumn: 'D' };
        const { ok, result } = await postToCRM(payload);
        if (!ok && result?.success === false) throw new Error(result?.message || 'query_failed');
        const user = result?.user || (result?.name ? { name: result.name, email: result.email || email } : null);
        return { exists: Boolean(result?.exists || result?.found || user), user };
    }

    async function registerUserToCRM({ method, userName, email, source }) {
        const payload = {
            action: 'register_user',
            registeredAt: new Date().toISOString(),
            method,
            userName,
            email,
            identifier: email,
            status: 'Active',
            source,
            sheet: 'CRM data'
        };
        const { ok, result } = await postToCRM(payload);
        if (!ok || result?.success === false) {
            throw new Error(result?.message || 'crm_register_failed');
        }
    }

    async function getGoogleProfile() {
        await ensureGoogleSDK();
        return new Promise((resolve, reject) => {
            googleTokenClient.callback = async (resp) => {
                if (resp?.error) return reject(new Error(resp.error));
                try {
                    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${resp.access_token}` }
                    });
                    const data = await res.json();
                    resolve({ name: data.name || 'Google User', email: data.email || '' });
                } catch (e) {
                    reject(e);
                }
            };
            googleTokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    async function getFacebookProfile() {
        await ensureFacebookSDK();
        return new Promise((resolve, reject) => {
            window.FB.login((resp) => {
                if (!resp?.authResponse) return reject(new Error('fb_login_cancelled'));
                window.FB.api('/me', { fields: 'name,email' }, (profile) => {
                    if (!profile || profile.error) return reject(new Error('fb_profile_failed'));
                    resolve({ name: profile.name || 'Facebook User', email: profile.email || '' });
                });
            }, { scope: 'public_profile,email' });
        });
    }

    async function getAppleProfile() {
        await ensureAppleSDK();
        const response = await window.AppleID.auth.signIn();
        const user = response?.user || {};
        const idToken = response?.authorization?.id_token || '';
        const tokenPayload = parseJwtPayload(idToken);
        const email = user?.email || tokenPayload?.email || '';
        const name = [user?.name?.firstName, user?.name?.lastName].filter(Boolean).join(' ') || 'Apple User';
        return { name, email };
    }

    function parseJwtPayload(token) {
        if (!token || typeof token !== 'string' || token.split('.').length < 2) return null;
        try {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(atob(base64).split('').map((c) => {
                return `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`;
            }).join(''));
            return JSON.parse(json);
        } catch {
            return null;
        }
    }

    async function getThirdPartyProfile(method) {
        if (method === 'Google') return getGoogleProfile();
        if (method === 'Facebook') return getFacebookProfile();
        if (method === 'Apple ID') return getAppleProfile();
        throw new Error('unsupported_provider');
    }

    async function startMemberAuthFlow(method) {
        const errEl = document.getElementById('fx-signup-error');
        if (errEl) errEl.style.display = 'none';
        setSignupDebug('');
        setProviderButtonsLoading(true, method);
        try {
            const profile = await getThirdPartyProfile(method);
            const source = detectSource();
            const email = (profile.email || '').trim();
            if (!email) throw new Error('missing_email');
            const { exists, user } = await queryUserFromCRM(email);
            const candidateName = user?.name || profile.name || `${method} User`;
            pendingAuth = {
                method,
                userName: candidateName,
                email,
                source,
                mode: exists ? 'confirm-login' : 'confirm-register'
            };
            const dict = getLocaleDict();
            if (exists) {
                setModalState('confirm-login', dict.msgWelcomeBack(pendingAuth.userName), dict.btnConfirmLogin);
            } else {
                setModalState('confirm-register', dict.msgCreating, dict.btnProcessing);
                await registerUserToCRM({
                    method,
                    userName: pendingAuth.userName,
                    email: pendingAuth.email,
                    source: pendingAuth.source
                });
                pendingAuth.mode = 'confirm-login';
                setModalState('confirm-login', dict.msgCreated(pendingAuth.userName), dict.btnConfirmLogin);
            }
        } catch (e) {
            if (errEl) {
                const dict = getLocaleDict();
                errEl.textContent = e?.message === 'missing_email' ? dict.errMissingEmail : dict.errProvider;
                errEl.style.display = 'block';
            }
            setSignupDebug(`provider_error: ${e?.message || 'unknown'}`);
        } finally {
            setProviderButtonsLoading(false, method);
            restoreProviderButtons();
        }
    }

    async function handlePendingAuthConfirm() {
        if (!pendingAuth) return;
        const errEl = document.getElementById('fx-signup-error');
        const primary = document.getElementById('fx-signup-primary');
        if (errEl) errEl.style.display = 'none';
        setSignupDebug('');
        if (primary) {
            primary.disabled = true;
            primary.textContent = getLocaleDict().btnProcessing;
        }
        try {
            localStorage.setItem(MEMBER_NAME_KEY, pendingAuth.userName);
            localStorage.setItem(MEMBER_EMAIL_KEY, pendingAuth.email);
            localStorage.setItem(MEMBER_METHOD_KEY, pendingAuth.method);
            applyMemberNameUI();
            closeSignUpModal();
            alert(getLocaleDict().alertWelcome(pendingAuth.userName));
        } catch (e) {
            if (errEl) {
                errEl.textContent = getLocaleDict().errConfirm;
                errEl.style.display = 'block';
            }
            setSignupDebug(`confirm_error: ${e?.message || 'unknown'}`);
        } finally {
            if (primary) {
                primary.disabled = false;
                primary.textContent = getLocaleDict().btnConfirmLogin;
            }
        }
    }

    function logoutMember() {
        localStorage.removeItem(MEMBER_NAME_KEY);
        localStorage.removeItem(MEMBER_EMAIL_KEY);
        localStorage.removeItem(MEMBER_METHOD_KEY);
        applyMemberNameUI();
        window.location.reload();
    }

    function applyMemberNameUI() {
        const name = localStorage.getItem(MEMBER_NAME_KEY);
        const signupEls = Array.from(document.querySelectorAll('[data-i18n="nav_signup"]'));
        const dict = getLocaleDict();
        signupEls.forEach((el) => {
            if (!el.dataset.defaultSignupLabel) {
                el.dataset.defaultSignupLabel = (el.textContent || '').trim() || (dict.signupTitle);
            }
        });
        if (name) {
            signupEls.forEach((el) => {
                el.textContent = `Hi, ${name}`;
                if (el.tagName === 'A') {
                    el.setAttribute('href', '#');
                    el.onclick = (e) => { e.preventDefault(); openSignUpModal(); };
                }
            });
        } else {
            signupEls.forEach((el) => {
                el.textContent = el.dataset.defaultSignupLabel || dict.signupTitle;
                if (el.tagName === 'A') {
                    el.removeAttribute('href');
                    el.setAttribute('href', '#');
                    el.onclick = (e) => { e.preventDefault(); openSignUpModal(); };
                }
            });
        }
        if (!name || signupEls.length) return;
        document.querySelectorAll('nav .flex.items-center.gap-3').forEach((wrap) => {
            if (!wrap.querySelector('a[href="admin-dashboard.html"]')) return;
            let chip = wrap.querySelector('.fx-member-greeting-chip');
            if (!chip) {
                chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'fx-member-greeting-chip px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200';
                chip.addEventListener('click', openSignUpModal);
                wrap.insertBefore(chip, wrap.firstChild);
            }
            chip.textContent = `Hi, ${name}`;
        });
    }

    function hookLanguageChangeForMemberName() {
        if (typeof window.changeLanguage !== 'function' || window.changeLanguage.__memberNameHooked) return;
        const original = window.changeLanguage;
        const wrapped = function (lang) {
            original(lang);
            applyMemberNameUI();
            applyModalLocale();
        };
        wrapped.__memberNameHooked = true;
        window.changeLanguage = wrapped;
    }

    function openSignUpModal() {
        ensureSignUpModal();
        document.getElementById('fx-signup-overlay')?.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('fx-signup-error')?.style.setProperty('display', 'none');
        setSignupDebug('');
        pendingAuth = null;
        if (localStorage.getItem(MEMBER_NAME_KEY)) {
            const name = localStorage.getItem(MEMBER_NAME_KEY) || '';
            setModalState('logged-in', getLocaleDict().msgLoggedIn(name), '');
            return;
        }
        setModalState('select-provider', getLocaleDict().signupDesc, '');
    }

    function openSignUpFromMobile() {
        if (typeof window.toggleMobileMenu === 'function') window.toggleMobileMenu();
        openSignUpModal();
    }

    window.openSignUpModal = openSignUpModal;
    window.openSignUpFromMobile = openSignUpFromMobile;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyMemberNameUI();
            hookLanguageChangeForMemberName();
        });
    } else {
        applyMemberNameUI();
        hookLanguageChangeForMemberName();
    }
})();
