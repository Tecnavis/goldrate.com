/**
 * GoldRates front-end
 * - Live feed refresh every 60s
 * - Accurate "Last update" (based on fetch time)
 * - Auto-convert currencies; dynamic FX with localStorage cache
 * - Optional obfuscation for API URL; or read from <meta name="gold-api">
 */

// ---------- OPTIONAL: LIGHT OBFUSCATION ----------
function xorStr(base64, key) {
  try {
    const s = atob(base64);
    let out = '';
    for (let i = 0; i < s.length; i++) out += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    return out;
  } catch { return ''; }
}
const OBF_KEY = 'G0ldR@tes2025!';
const OBF_API = ''; // put encoded text here if you want to use obfuscation

function getApiUrl() {
  const meta = document.querySelector('meta[name="gold-api"]')?.getAttribute('content') || '';
  if (meta && /^https?:\/\//i.test(meta)) return meta.trim();
  if (OBF_API) {
    const url = xorStr(OBF_API, OBF_KEY);
    if (/^https?:\/\//i.test(url)) return url;
  }
  console.warn('Gold API URL not set via <meta name="gold-api">; using sample fallback.');
  return '';
}

// FX source + cache keys
const FX_API_URL = 'https://api.exchangerate.host/latest';
const FX_CACHE_KEY = 'goldrates_fx';
const FX_CACHE_TS  = 'goldrates_fx_ts';
const FX_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

// ---------- CONSTANTS ----------
const OZ_TO_GRAM = 31.1034768;

// ---------- STATE ----------
let gold = null;          // last gold payload
let fxRates = null;       // USD -> others
let lastFetched = null;   // Date object
let usingFxFallback = false;

// ---------- HELPERS ----------
const fmtMoney = (n, c='USD') => {
  try { return new Intl.NumberFormat(undefined, { style:'currency', currency:c }).format(n); }
  catch { return c + ' ' + Number(n || 0).toFixed(2); }
};
const fmtPerGram = (n, c='USD') => `${fmtMoney(n, c)} / g`;
const el = (id) => document.getElementById(id);

function toCurrency(amountUSD, ccy) {
  if (!fxRates || !fxRates[ccy]) return amountUSD;
  return amountUSD * fxRates[ccy];
}
function unitToGrams(weight, unit) {
  if (unit === 'g') return weight;
  if (unit === 'kg') return weight * 1000;
  if (unit === 'oz') return weight * OZ_TO_GRAM;
  return weight;
}
function pricePerGramForKaratUSD(karat) {
  const key = `price_gram_${karat}k`;
  if (gold && gold[key] != null) return Number(gold[key]);
  const perGram24 = (Number(gold?.price) || 0) / OZ_TO_GRAM;
  if (karat === 24) return perGram24;
  return perGram24 * (karat/24);
}
function lastUpdateText() {
  if (!lastFetched) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - lastFetched.getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} minute${mins===1?'':'s'} ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

// ---------- FETCH GOLD ----------
async function fetchGold() {
  const url = getApiUrl();
  if (!url) {
    // sample fallback (so UI still renders)
    gold = {
      timestamp: 1762160856,
      price: 4022.36,
      ch: 19.96,
      chp: 0.5,
      open_price: 4002.4,
      low_price: 3962.625,
      high_price: 4028.04,
      price_gram_24k: 129.3219,
      price_gram_22k: 118.5451,
      price_gram_21k: 113.1566,
      price_gram_20k: 107.7682,
      price_gram_18k: 96.9914,
      price_gram_16k: 86.2146,
      price_gram_14k: 75.4378,
      price_gram_10k: 53.8841,
    };
    lastFetched = new Date();
    return;
  }
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Gold API ${res.status}`);
    gold = await res.json();
    lastFetched = new Date(); // accurate timer
  } catch (e) {
    console.error('Gold fetch failed:', e);
    // keep previous `gold` if we had one; otherwise use sample
    if (!gold) {
      gold = {
        timestamp: 1762160856,
        price: 4022.36,
        ch: 19.96,
        chp: 0.5,
        open_price: 4002.4,
        low_price: 3962.625,
        high_price: 4028.04,
        price_gram_24k: 129.3219,
        price_gram_22k: 118.5451,
        price_gram_21k: 113.1566,
        price_gram_20k: 107.7682,
        price_gram_18k: 96.9914,
        price_gram_16k: 86.2146,
        price_gram_14k: 75.4378,
        price_gram_10k: 53.8841,
      };
    }
    lastFetched = new Date();
  }
}

// ---------- FETCH FX with CACHE ----------
function loadFxFromCache() {
  try {
    const ts = Number(localStorage.getItem(FX_CACHE_TS) || '0');
    const val = localStorage.getItem(FX_CACHE_KEY);
    if (!val || !ts) return null;
    if (Date.now() - ts > FX_TTL_MS) return null; // expired
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object' && parsed.USD === 1) return parsed;
  } catch {}
  return null;
}
function saveFxToCache(rates) {
  try {
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
    localStorage.setItem(FX_CACHE_TS, String(Date.now()));
  } catch {}
}

async function fetchFx() {
  // Use cached first if fresh enough
  const cached = loadFxFromCache();
  if (cached) {
    fxRates = cached;
    usingFxFallback = false;
  }

  // Always try to refresh in the background
  try {
    const symbols = 'USD,AED,INR,EUR,GBP,CNY,SAR,AUD,CAD,PKR';
    const res = await fetch(`${FX_API_URL}?base=USD&symbols=${symbols}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('FX API error');
    const data = await res.json();
    if (!data || !data.rates || !data.rates.USD) throw new Error('Empty FX');
    fxRates = data.rates;
    usingFxFallback = false;
    saveFxToCache(fxRates);
  } catch (e) {
    console.warn('FX fetch failed, using last known good or USD identity:', e);
    if (!fxRates) {
      // last resort if nothing cached
      fxRates = { USD: 1 };
      usingFxFallback = true;
    }
  }
}

// ---------- RENDER ----------
function sentimentFromChange(ch) {
  if (ch > 0) return 'Bullish';
  if (ch < 0) return 'Bearish';
  return 'Neutral';
}

function renderUI() {
  if (!gold) return;

  const ccy = el('currency')?.value || 'USD';

  // Hero stats
  el('stat-24k').textContent = fmtPerGram(toCurrency(Number(gold.price_gram_24k), ccy), ccy);
  el('stat-22k').textContent = fmtPerGram(toCurrency(Number(gold.price_gram_22k), ccy), ccy);
  el('stat-spot').textContent = `${fmtMoney(toCurrency(Number(gold.price), ccy), ccy)} / oz`;
  el('stat-spot-ch').textContent = `${gold.chp>0?'+':''}${Number(gold.chp).toFixed(2)}% (${gold.ch>0?'+':''}${Number(gold.ch).toFixed(2)})`;

  // Live cards
  el('card-24k').textContent = fmtPerGram(toCurrency(Number(gold.price_gram_24k), ccy), ccy);
  el('card-22k').textContent = fmtPerGram(toCurrency(Number(gold.price_gram_22k), ccy), ccy);
  el('card-18k').textContent = fmtPerGram(toCurrency(Number(gold.price_gram_18k), ccy), ccy);
  el('card-14k').textContent = fmtPerGram(toCurrency(Number(gold.price_gram_14k), ccy), ccy);
  el('card-24k-ch').textContent = `Spot change: ${gold.chp>0?'+':''}${Number(gold.chp).toFixed(2)}%`;
  el('card-22k-ch').textContent = `Spot change: ${gold.chp>0?'+':''}${Number(gold.chp).toFixed(2)}%`;
  el('card-18k-ch').textContent = `Spot change: ${gold.chp>0?'+':''}${Number(gold.chp).toFixed(2)}%`;
  el('card-14k-ch').textContent = `Spot change: ${gold.chp>0?'+':''}${Number(gold.chp).toFixed(2)}%`;

  // Market stats
  el('stat-open').textContent = `${fmtMoney(toCurrency(Number(gold.open_price), ccy), ccy)} / oz`;
  el('stat-high').textContent = `${fmtMoney(toCurrency(Number(gold.high_price), ccy), ccy)} / oz`;
  el('stat-low').textContent = `${fmtMoney(toCurrency(Number(gold.low_price), ccy), ccy)} / oz`;
  el('sentiment').textContent = sentimentFromChange(Number(gold.ch));

  // Last update + FX note
  const lu = el('last-update');
  if (lu) lu.textContent = lastUpdateText();
  const note = el('fx-note');
  if (note) note.textContent = usingFxFallback ? 'Converted using cached FX rates.' : 'Converted from USD via live FX.';

  // Keep calculator live
  autoCalcIfPossible();
}

function autoCalcIfPossible() {
  const weightEl = el('calc-weight');
  const karatEl  = el('calc-karat');
  const unitEl   = el('calc-unit');
  const ccyEl    = el('calc-currency');
  if (!weightEl || !karatEl || !unitEl || !ccyEl) return;
  const weight = parseFloat(weightEl.value || '0');
  if (!weight || weight <= 0) { el('calc-result').textContent = '—'; return; }
  const karat = parseInt(karatEl.value, 10);
  const unit  = unitEl.value;
  const ccy   = ccyEl.value;
  const grams = unitToGrams(weight, unit);
  const perGramUSD = pricePerGramForKaratUSD(karat);
  const totalUSD = grams * perGramUSD;
  const total = toCurrency(totalUSD, ccy);
  el('calc-result').textContent =
    `≈ ${fmtMoney(total, ccy)} (${grams.toFixed(3)} g × ${fmtPerGram(toCurrency(perGramUSD, ccy), ccy)})`;
}

// ---------- EVENTS ----------
function wireEvents() {
  const btn = el('btn-calc');
  if (btn) btn.addEventListener('click', autoCalcIfPossible);

  const ccySel = el('currency');
  if (ccySel) ccySel.addEventListener('change', () => { renderUI(); });

  ['calc-weight', 'calc-karat', 'calc-unit', 'calc-currency'].forEach(id => {
    const n = el(id);
    if (n) n?.addEventListener('input', autoCalcIfPossible);
    if (n) n?.addEventListener('change', autoCalcIfPossible);
  });

  // Update "Last update" text every 30s
  setInterval(() => {
    const lu = el('last-update');
    if (lu) lu.textContent = lastUpdateText();
  }, 30000);
}

// ---------- INIT ----------
async function init() {
  await Promise.all([fetchGold(), fetchFx()]);
  wireEvents();
  renderUI();

  // Refresh gold every 60s
  setInterval(async () => {
    await fetchGold();
    renderUI();
  }, 5000);

  // Refresh FX every 6h (cache TTL). If FX API is down, cached rates keep working.
  setInterval(async () => {
    await fetchFx();
    renderUI();
  }, FX_TTL_MS);
}

document.addEventListener('DOMContentLoaded', init);
