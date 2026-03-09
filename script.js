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
    const SLIDE_KEY = 'fx_managed_slides';
    const SLIDE_CONFIG_KEY = 'fx_spectrum_slides_config';
    const SEMINAR_KEY = 'fx_spectrum_seminars';
    const LEGACY_SEMINAR_KEY = 'fx_managed_seminars';

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function getManagedSlidesConfig() {
        const cfg = readJson(SLIDE_CONFIG_KEY, null);
        if (cfg && Array.isArray(cfg.slides) && cfg.slides.length) {
            return {
                intervalSeconds: Math.max(1, Number(cfg.intervalSeconds) || 5),
                slides: cfg.slides
                    .map((s) => ({
                        imageUrl: typeof s?.imageUrl === 'string' ? s.imageUrl.trim() : '',
                        title: typeof s?.title === 'string' ? s.title : '',
                        subtitle: typeof s?.subtitle === 'string' ? s.subtitle : '',
                        buttonText: typeof s?.buttonText === 'string' ? s.buttonText : '',
                        buttonLink: typeof s?.buttonLink === 'string' ? s.buttonLink : ''
                    }))
                    .filter((s) => s.imageUrl)
            };
        }
        const legacySlides = readJson(SLIDE_KEY, null);
        if (Array.isArray(legacySlides) && legacySlides.length) {
            return {
                intervalSeconds: 5,
                slides: legacySlides
                    .filter((url) => typeof url === 'string' && url.trim())
                    .map((url, idx) => ({
                        imageUrl: url.trim(),
                        title: `Slide ${idx + 1}`,
                        subtitle: '',
                        buttonText: '',
                        buttonLink: ''
                    }))
            };
        }
        return null;
    }

    function applyManagedSlides() {
        const config = getManagedSlidesConfig();
        const slides = config?.slides?.map((s) => s.imageUrl) || [];
        if (!slides.length) return;
        const ids = ['managed-slide-1', 'managed-slide-2', 'managed-slide-3'];
        ids.forEach((id, idx) => {
            const el = document.getElementById(id);
            const next = slides[idx];
            if (el && typeof next === 'string' && next.trim()) {
                el.src = next.trim();
            }
        });
    }

    function getManagedSeminars() {
        const seminars = readJson(SEMINAR_KEY, null) || readJson(LEGACY_SEMINAR_KEY, null);
        return Array.isArray(seminars) ? seminars : null;
    }

    // Expose seminar override getter for seminar.html rendering.
    window.getManagedSlidesConfig = getManagedSlidesConfig;
    window.getManagedSeminars = getManagedSeminars;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyManagedSlides);
    } else {
        applyManagedSlides();
    }
})();

(function () {
    const SEMINAR_LABELS = {
        en: 'Seminars',
        'zh-TW': '研討會',
        'zh-CN': '研讨会'
    };

    function getCurrentLang() {
        return localStorage.getItem('fx_spectrum_lang') || document.documentElement.lang || 'en';
    }

    function applySeminarFooterText(lang) {
        const text = SEMINAR_LABELS[lang] || SEMINAR_LABELS.en;
        document.querySelectorAll('a[href="seminar.html"][data-i18n="footer_seminar"]').forEach((el) => {
            el.textContent = text;
        });
    }

    function hookLanguageChange() {
        if (typeof window.changeLanguage !== 'function' || window.changeLanguage.__footerSeminarHooked) return;
        const original = window.changeLanguage;
        const wrapped = function (lang) {
            original(lang);
            applySeminarFooterText(lang);
        };
        wrapped.__footerSeminarHooked = true;
        window.changeLanguage = wrapped;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applySeminarFooterText(getCurrentLang());
            hookLanguageChange();
        });
    } else {
        applySeminarFooterText(getCurrentLang());
        hookLanguageChange();
    }
})();
