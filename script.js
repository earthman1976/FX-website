(function () {
    const AV_API_KEY = 'T90381X2762DY8TO';
    const METAL_API_KEY = '189f129089a4219b9af80aaefbac2c00';
    const CACHE_KEY = 'fx_spectrum_ticker_data';
    const CACHE_TTL = 5 * 60 * 1000;

    const AV_TARGETS = [
        { symbol: 'EUR/USD', from: 'EUR', to: 'USD', decimals: 4 },
        { symbol: 'GBP/USD', from: 'GBP', to: 'USD', decimals: 4 },
        { symbol: 'USD/JPY', from: 'USD', to: 'JPY', decimals: 2 },
        { symbol: 'AUD/USD', from: 'AUD', to: 'USD', decimals: 4 },
        { symbol: 'USD/CHF', from: 'USD', to: 'CHF', decimals: 4 }
    ];

    const CRYPTO_TARGETS = [
        { symbol: 'BTC/USD', binanceSymbol: 'BTCUSDT', decimals: 2 },
        { symbol: 'ETH/USD', binanceSymbol: 'ETHUSDT', decimals: 2 },
        { symbol: 'BNB/USD', binanceSymbol: 'BNBUSDT', decimals: 2 },
        { symbol: 'USDT/USD', binanceSymbol: 'USDCUSDT', decimals: 4, isStable: true }
    ];

    const INDEX_TARGETS = [
        { symbol: 'NASDAQ',     avSymbol: 'IXIC',  decimals: 0 },
        { symbol: 'DOW JONES',  avSymbol: 'DJI',   decimals: 0 },
        { symbol: 'NIKKEI 225', avSymbol: 'NI225', decimals: 0 },
        { symbol: 'DAX',        avSymbol: 'GDAXI', decimals: 0 },
        { symbol: 'TAIEX',      avSymbol: 'TWA00', decimals: 0 }
    ];

    const ALL_SYMBOLS = [
        'XAU/USD', 'XAG/USD', 'XPD/USD',
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF',
        'BTC/USD', 'ETH/USD', 'BNB/USD', 'USDT/USD',
        'NASDAQ', 'DOW JONES', 'NIKKEI 225', 'DAX', 'TAIEX'
    ];

    const FALLBACK_DATA = [
        { pair: 'XAU/USD', price: 2024.15, change: -0.32, decimals: 2 },
        { pair: 'XAG/USD', price: 24.85, change: 0.45, decimals: 2 },
        { pair: 'XPD/USD', price: 1025.00, change: -0.18, decimals: 2 },
        { pair: 'EUR/USD', price: 1.0850, change: 0.12, decimals: 4 },
        { pair: 'GBP/USD', price: 1.2510, change: 0.18, decimals: 4 },
        { pair: 'USD/JPY', price: 149.30, change: -0.05, decimals: 2 },
        { pair: 'AUD/USD', price: 0.6530, change: 0.22, decimals: 4 },
        { pair: 'USD/CHF', price: 0.8790, change: -0.15, decimals: 4 },
        { pair: 'BTC/USD', price: 62450.00, change: 1.45, decimals: 2 },
        { pair: 'ETH/USD', price: 3450.00, change: 0.85, decimals: 2 },
        { pair: 'BNB/USD', price: 580.50, change: 0.62, decimals: 2 },
        { pair: 'USDT/USD', price: 1.0001, change: 0.01, decimals: 4 },
        { pair: 'NASDAQ', price: 22807, change: 0.45, decimals: 0 },
        { pair: 'DOW JONES', price: 42300, change: 0.18, decimals: 0 },
        { pair: 'NIKKEI 225', price: 38500, change: -0.25, decimals: 0 },
        { pair: 'DAX', price: 18200, change: 0.32, decimals: 0 },
        { pair: 'TAIEX', price: 22500, change: 0.15, decimals: 0 }
    ];

    function getCachedData() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (Date.now() - cached.timestamp < CACHE_TTL && cached.data?.length) {
                return cached.data;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function setCachedData(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) { /* ignore */ }
    }

    async function fetchAlphaVantageRate(target) {
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${target.from}&to_currency=${target.to}&apikey=${AV_API_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        const rateInfo = json['Realtime Currency Exchange Rate'];
        if (!rateInfo) return null;
        const price = parseFloat(rateInfo['5. Exchange Rate']);
        const bidPrice = parseFloat(rateInfo['8. Bid Price'] || price);
        const askPrice = parseFloat(rateInfo['9. Ask Price'] || price);
        const mid = (bidPrice + askPrice) / 2;
        const change = mid > 0 ? ((price - mid) / mid) * 100 : 0;
        return {
            pair: target.symbol,
            price: parseFloat(price.toFixed(target.decimals)),
            change: parseFloat(change.toFixed(2)),
            decimals: target.decimals
        };
    }

    async function fetchMetalPrices() {
        const url = `https://api.metalpriceapi.com/v1/latest?api_key=${METAL_API_KEY}&base=USD&currencies=XAU,XAG,XPD`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.success || !json.rates) return [];
        const results = [];
        const metals = [
            { key: 'XAU', pair: 'XAU/USD', dec: 2 },
            { key: 'XAG', pair: 'XAG/USD', dec: 2 },
            { key: 'XPD', pair: 'XPD/USD', dec: 2 }
        ];
        metals.forEach(m => {
            if (json.rates[m.key]) {
                const price = parseFloat((1 / json.rates[m.key]).toFixed(m.dec));
                const fb = FALLBACK_DATA.find(d => d.pair === m.pair);
                const prev = fb ? fb.price : price;
                const change = prev > 0 ? parseFloat((((price - prev) / prev) * 100).toFixed(2)) : 0;
                results.push({ pair: m.pair, price, change, decimals: m.dec });
            }
        });
        return results;
    }

    async function fetchCryptoPrice(target) {
        if (target.isStable) {
            return { pair: target.symbol, price: 1.0001, change: parseFloat((Math.random() * 0.04 - 0.02).toFixed(2)), decimals: target.decimals };
        }
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${target.binanceSymbol}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.price) return null;
        const price = parseFloat(parseFloat(json.price).toFixed(target.decimals));
        const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
        const prevPrice = fb ? fb.price : price;
        const change = prevPrice > 0 ? parseFloat((((price - prevPrice) / prevPrice) * 100).toFixed(2)) : 0;
        return { pair: target.symbol, price, change, decimals: target.decimals };
    }

    async function fetchIndexQuote(target) {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${target.avSymbol}&apikey=${AV_API_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        const gq = json['Global Quote'];
        if (!gq || !gq['05. price']) return null;
        const price = Math.round(parseFloat(gq['05. price']));
        const changeStr = (gq['10. change percent'] || '0').replace('%', '');
        const change = parseFloat(parseFloat(changeStr).toFixed(2));
        if (isNaN(price) || price <= 0) return null;
        return { pair: target.symbol, price, change, decimals: target.decimals };
    }

    async function fetchAllRates() {
        const results = [];

        for (const target of AV_TARGETS) {
            try {
                const rate = await fetchAlphaVantageRate(target);
                if (rate) {
                    results.push(rate);
                } else {
                    const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
                    if (fb) results.push(fb);
                }
            } catch (e) {
                const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
                if (fb) results.push(fb);
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        try {
            const metals = await fetchMetalPrices();
            if (metals.length) {
                results.push(...metals);
            } else {
                results.push(FALLBACK_DATA.find(d => d.pair === 'XAU/USD'));
                results.push(FALLBACK_DATA.find(d => d.pair === 'XAG/USD'));
                results.push(FALLBACK_DATA.find(d => d.pair === 'XPD/USD'));
            }
        } catch (e) {
            results.push(FALLBACK_DATA.find(d => d.pair === 'XAU/USD'));
            results.push(FALLBACK_DATA.find(d => d.pair === 'XAG/USD'));
            results.push(FALLBACK_DATA.find(d => d.pair === 'XPD/USD'));
        }

        for (const target of CRYPTO_TARGETS) {
            try {
                const rate = await fetchCryptoPrice(target);
                if (rate) {
                    results.push(rate);
                } else {
                    const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
                    if (fb) results.push(fb);
                }
            } catch (e) {
                const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
                if (fb) results.push(fb);
            }
        }

        for (const target of INDEX_TARGETS) {
            try {
                const rate = await fetchIndexQuote(target);
                if (rate) {
                    results.push(rate);
                    console.log(`[Index] ✓ ${target.symbol}: ${rate.price}`);
                } else {
                    const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
                    if (fb) results.push(fb);
                    console.warn(`[Index] ✗ ${target.symbol}: using fallback`);
                }
            } catch (e) {
                const fb = FALLBACK_DATA.find(d => d.pair === target.symbol);
                if (fb) results.push(fb);
                console.warn(`[Index] ✗ ${target.symbol}: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        results.sort((a, b) => ALL_SYMBOLS.indexOf(a.pair) - ALL_SYMBOLS.indexOf(b.pair));
        return results;
    }

    function renderTickerHTML(data) {
        return data.map(item => {
            const dec = item.decimals ?? (item.price > 100 ? 2 : 4);
            const priceStr = item.price.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
            const changeColor = item.change >= 0 ? 'color:#22c55e' : 'color:#ef4444';
            const arrow = item.change >= 0 ? '▲' : '▼';
            const sign = item.change >= 0 ? '+' : '';
            return `<span class="ticker-item font-mono" style="display:inline-block;padding:0 2rem;font-size:0.85rem;font-weight:500;">` +
                `<span style="color:#94a3b8;margin-right:0.4rem;">${item.pair}</span>` +
                `<span style="color:#e2e8f0;font-weight:700;">${priceStr}</span> ` +
                `<span style="${changeColor};font-weight:600;font-size:0.78rem;">${arrow} ${sign}${item.change.toFixed(2)}%</span>` +
                `</span>`;
        }).join('');
    }

    function populateTickers(data) {
        const topTicker = document.getElementById('top-ticker');
        const bottomTicker = document.getElementById('bottom-ticker');
        const html = renderTickerHTML(data);
        const htmlReversed = renderTickerHTML([...data].reverse());
        if (topTicker) topTicker.innerHTML = html + html;
        if (bottomTicker) bottomTicker.innerHTML = htmlReversed + htmlReversed;
    }
    window.fxSpectrumPopulateTickers = populateTickers;

    function broadcastData(data, source) {
        const payload = data.filter(d => d && d.pair).map(d => ({ ...d }));
        payload._source = source || 'fallback';
        window.fxSpectrumTickerData = payload;
        window.dispatchEvent(new CustomEvent('fxSpectrumDataReady', { detail: payload }));
    }

    async function refreshLiveData() {
        try {
            console.log('[FX Spectrum] Fetching live market data...');
            const liveData = await fetchAllRates();
            if (liveData.length) {
                setCachedData(liveData);
                populateTickers(liveData);
                broadcastData(liveData, 'live');
                console.log(`[FX Spectrum] Live data updated — ${liveData.length} symbols at ${new Date().toLocaleTimeString()}`);
            }
        } catch (e) {
            console.warn('[FX Spectrum] API fetch failed, retrying next cycle.', e);
        }
    }

    async function initLiveTicker() {
        const cached = getCachedData();
        if (cached) {
            populateTickers(cached);
            broadcastData(cached, 'cached');
            console.log('[FX Spectrum] Loaded cached data — next refresh in 5 min.');
        } else {
            populateTickers(FALLBACK_DATA);
            broadcastData(FALLBACK_DATA, 'fallback');
            await refreshLiveData();
        }

        setInterval(refreshLiveData, 5 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLiveTicker);
    } else {
        initLiveTicker();
    }
})();

(function () {
    const SIGNUP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuB65CD8rzc_YrediUF6FQ3M1DqoPyAv4cBwH9uu_nWfcV-tDT61G94AYbY51qA1dO3A/exec';
    const LABELS = {
        en: {
            nav: 'Sign Up',
            title: 'Sign Up Membership',
            desc: 'Complete the form and our team will assist your onboarding.',
            name: 'Name',
            email: 'Email',
            password: 'Set Password',
            phone: 'Phone',
            platform: 'Preferred Trading Platform',
            submit: 'Create Membership',
            successTitle: 'Registration successful! Welcome to FX Spectrum',
            successDesc: 'Your request has been submitted successfully.',
            sending: 'Sending...'
        },
        'zh-TW': {
            nav: '註冊會員',
            title: '註冊會員',
            desc: '請填寫以下資料，我們將協助您完成開通流程。',
            name: '姓名',
            email: '電子郵件',
            password: '設定密碼',
            phone: '手機號碼',
            platform: '預計使用交易平台',
            submit: '立即註冊',
            successTitle: '註冊成功！歡迎加入 FX Spectrum',
            successDesc: '我們已收到您的資料，將盡快與您聯繫。',
            sending: '送出中...'
        },
        'zh-CN': {
            nav: '注册会员',
            title: '注册会员',
            desc: '请填写以下资料，我们将协助您完成开通流程。',
            name: '姓名',
            email: '电子邮箱',
            password: '设置密码',
            phone: '手机号',
            platform: '预计使用交易平台',
            submit: '立即注册',
            successTitle: '注册成功！欢迎加入 FX Spectrum',
            successDesc: '我们已收到您的资料，将尽快与您联系。',
            sending: '提交中...'
        }
    };

    function currentLang() {
        const lang = localStorage.getItem('fx_spectrum_lang') || document.documentElement.lang || 'en';
        return LABELS[lang] ? lang : 'en';
    }

    function injectSignupStyles() {
        if (document.getElementById('fx-signup-style')) return;
        const style = document.createElement('style');
        style.id = 'fx-signup-style';
        style.textContent = `
            .nav-signup-btn {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
                border: 1px solid rgba(6,182,212,0.5) !important;
                color: #ffffff !important;
                font-weight: 700 !important;
                transition: all 0.25s ease !important;
            }
            .nav-signup-btn:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 0 15px rgba(6,182,212,0.4) !important;
                background: linear-gradient(135deg, #0b1324 0%, #1f2d44 100%) !important;
            }
            .fx-signup-overlay {
                position: fixed; inset: 0; z-index: 130;
                background: rgba(2,6,23,.72); backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center;
                padding: 16px;
            }
            .fx-signup-overlay.hidden { display: none; }
            .fx-signup-card {
                width: min(92vw, 620px); max-height: 92vh; overflow-y: auto;
                border-radius: 24px; border: 1px solid rgba(148,163,184,.28);
                background: rgba(15,23,42,.85); backdrop-filter: blur(16px);
                box-shadow: 0 24px 60px rgba(0,0,0,.45); color: #e2e8f0;
                padding: 28px;
            }
            .fx-signup-input {
                width: 100%; background: rgba(15,23,42,.88);
                border: 1px solid #334155; border-radius: 12px;
                padding: 12px 14px; color: #f8fafc; font-size: 14px;
                outline: none; transition: all .2s ease;
            }
            .fx-signup-input::placeholder { color: #64748b; }
            .fx-signup-input:focus { border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34,211,238,.16); }
            .fx-signup-submit {
                width: 100%; padding: 12px 16px; border-radius: 12px; border: none;
                color: #fff; font-weight: 700; cursor: pointer;
                background: linear-gradient(135deg, #06B6D4, #A855F7);
            }
        `;
        document.head.appendChild(style);
    }

    function ensureSignupModal() {
        if (document.getElementById('signup-modal')) return;
        const wrapper = document.createElement('div');
        wrapper.id = 'signup-modal';
        wrapper.className = 'fx-signup-overlay hidden';
        wrapper.innerHTML = `
            <div class="fx-signup-card" onclick="event.stopPropagation()">
                <button type="button" onclick="closeSignUpModal()" style="position:absolute;right:28px;top:24px;width:30px;height:30px;border:none;background:transparent;color:#94a3b8;cursor:pointer;">✕</button>
                <div id="signup-form-view">
                    <h3 id="fx-signup-title" style="font-size:28px;font-weight:700;color:#fff;margin:0 0 8px;"></h3>
                    <p id="fx-signup-desc" style="font-size:14px;color:#cbd5e1;margin:0 0 20px;"></p>
                    <form id="signup-form" style="display:grid;gap:14px;">
                        <div><label id="fx-label-name" style="display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#cbd5e1;margin-bottom:7px;"></label><input id="signup-name" required class="fx-signup-input" type="text"></div>
                        <div><label id="fx-label-email" style="display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#cbd5e1;margin-bottom:7px;"></label><input id="signup-email" required class="fx-signup-input" type="email"></div>
                        <div><label id="fx-label-password" style="display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#cbd5e1;margin-bottom:7px;"></label><input id="signup-password" required class="fx-signup-input" type="password"></div>
                        <div><label id="fx-label-phone" style="display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#cbd5e1;margin-bottom:7px;"></label><input id="signup-phone" required class="fx-signup-input" type="tel"></div>
                        <div><label id="fx-label-platform" style="display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#cbd5e1;margin-bottom:7px;"></label><input id="signup-platform" required class="fx-signup-input" type="text"></div>
                        <button id="signup-submit-btn" class="fx-signup-submit" type="submit"></button>
                    </form>
                </div>
                <div id="signup-success-view" class="hidden" style="text-align:center;padding:36px 0;">
                    <div style="width:64px;height:64px;margin:0 auto 12px;border-radius:999px;background:rgba(16,185,129,.2);display:flex;align-items:center;justify-content:center;color:#34d399;font-size:32px;">✓</div>
                    <h3 id="fx-signup-success-title" style="font-size:24px;font-weight:700;color:#fff;margin:0 0 8px;"></h3>
                    <p id="fx-signup-success-desc" style="font-size:14px;color:#cbd5e1;margin:0;"></p>
                </div>
            </div>
        `;
        wrapper.addEventListener('click', () => closeSignUpModal());
        document.body.appendChild(wrapper);
    }

    function applySignupText(lang) {
        const t = LABELS[lang] || LABELS.en;
        document.querySelectorAll('.nav-signup-btn').forEach(el => { el.textContent = t.nav; });
        const map = [
            ['fx-signup-title', t.title], ['fx-signup-desc', t.desc], ['fx-label-name', t.name],
            ['fx-label-email', t.email], ['fx-label-password', t.password], ['fx-label-phone', t.phone],
            ['fx-label-platform', t.platform], ['signup-submit-btn', t.submit],
            ['fx-signup-success-title', t.successTitle], ['fx-signup-success-desc', t.successDesc]
        ];
        map.forEach(([id, txt]) => { const el = document.getElementById(id); if (el) el.textContent = txt; });
        const i1 = document.getElementById('signup-name'); if (i1) i1.placeholder = t.name;
        const i2 = document.getElementById('signup-email'); if (i2) i2.placeholder = 'example@mail.com';
        const i3 = document.getElementById('signup-password'); if (i3) i3.placeholder = '********';
        const i4 = document.getElementById('signup-phone'); if (i4) i4.placeholder = lang === 'zh-CN' ? '+86 138...' : '+886 912...';
        const i5 = document.getElementById('signup-platform'); if (i5) i5.placeholder = 'MT4 / MT5 / cTrader';
    }

    function bindSignupForm() {
        const form = document.getElementById('signup-form');
        const submitBtn = document.getElementById('signup-submit-btn');
        if (!form || !submitBtn || form.dataset.bound === '1') return;
        form.dataset.bound = '1';
        form.onsubmit = async (e) => {
            e.preventDefault();
            const lang = currentLang();
            const t = LABELS[lang] || LABELS.en;
            const original = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = t.sending;
            const payload = {
                type: 'USER_REGISTRATION',
                source: 'TOP_NAV_BUTTON',
                timestamp: new Date().toLocaleString(),
                name: document.getElementById('signup-name')?.value.trim() || '',
                email: document.getElementById('signup-email')?.value.trim() || '',
                password: document.getElementById('signup-password')?.value || '',
                phone: document.getElementById('signup-phone')?.value.trim() || '',
                platform: document.getElementById('signup-platform')?.value.trim() || ''
            };
            try {
                await fetch(SIGNUP_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const fv = document.getElementById('signup-form-view');
                const sv = document.getElementById('signup-success-view');
                if (fv) fv.classList.add('hidden');
                if (sv) sv.classList.remove('hidden');
                setTimeout(() => closeSignUpModal(), 1800);
            } catch (err) {
                alert(lang === 'zh-CN' ? '提交失败，请稍后重试。' : (lang === 'zh-TW' ? '提交失敗，請稍後再試。' : 'Submission failed. Please try again.'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = original;
            }
        };
    }

    function normalizeSignupTriggers() {
        const candidates = Array.from(document.querySelectorAll('[data-i18n="nav_login"], [data-i18n="nav_signup"], .nav-signup-btn'));
        candidates.forEach(el => {
            el.classList.add('nav-signup-btn');
            el.setAttribute('data-i18n', 'nav_signup');
            if (el.tagName === 'A') {
                el.setAttribute('href', '#');
                el.onclick = (e) => { e.preventDefault(); openSignUpFromMobile(); };
            } else {
                el.onclick = () => openSignUpModal();
            }
        });
    }

    function openSignUpModal() {
        ensureSignupModal();
        const modal = document.getElementById('signup-modal');
        const fv = document.getElementById('signup-form-view');
        const sv = document.getElementById('signup-success-view');
        const form = document.getElementById('signup-form');
        if (!modal) return;
        if (fv) fv.classList.remove('hidden');
        if (sv) sv.classList.add('hidden');
        if (form) form.reset();
        applySignupText(currentLang());
        bindSignupForm();
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeSignUpModal() {
        const modal = document.getElementById('signup-modal');
        if (modal) modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function openSignUpFromMobile() {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('active') && typeof window.toggleMobileMenu === 'function') {
            window.toggleMobileMenu();
        }
        openSignUpModal();
    }

    function hookLanguageChange() {
        if (typeof window.changeLanguage !== 'function' || window.changeLanguage.__fxSignupWrapped) return;
        const original = window.changeLanguage;
        const wrapped = function (lang) {
            original(lang);
            applySignupText(lang);
        };
        wrapped.__fxSignupWrapped = true;
        window.changeLanguage = wrapped;
    }

    function initSignupGlobal() {
        injectSignupStyles();
        normalizeSignupTriggers();
        ensureSignupModal();
        bindSignupForm();
        applySignupText(currentLang());
        hookLanguageChange();
        window.openSignUpModal = openSignUpModal;
        window.openSignUpFromMobile = openSignUpFromMobile;
        window.closeSignUpModal = closeSignUpModal;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSignupGlobal);
    } else {
        initSignupGlobal();
    }
})();
