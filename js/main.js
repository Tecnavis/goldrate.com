// main.fixed.goldapi.js
// Robust gold polling for GoldAPI (https://www.goldapi.io)
// - Uses header x-access-token as in your snippet
// - Polls every 1s when healthy, exponential backoff on errors
// - Safe timeouts with AbortController, FX fallback, UI updates

// -------- CONFIG --------
// Preferred: set <meta name="gold-api" content="https://www.goldapi.io/api"> in HTML head
// Fallback below will use the public goldapi host if meta absent.
const GOLD_API_URL_META = document.querySelector('meta[name="gold-api"]')?.content?.trim();
const GOLD_API_BASE = GOLD_API_URL_META || 'https://www.goldapi.io/api';

// Your API key (you provided). For production, prefer server-side storage.
const GOLD_API_KEY = 'goldapi-19gn9ye19m845omjy-io';

// FX (browser fetch)
const FX_API_URL = 'https://api.exchangerate.host/latest';

// FX fallback
const FX_FALLBACK = {
  base: 'USD',
  rates: {
    USD: 1,
    AED: 3.6725,
    INR: 84.0,
    EUR: 0.93,
    GBP: 0.79,
    CNY: 7.10,
    SAR: 3.75,
    AUD: 1.51,
    CAD: 1.37,
    PKR: 279.0
  }
};
let usingFxFallback = false;

// constants
const OZ_TO_GRAM = 31.1034768;

// cached
let gold = null;
let fx = null;

// utils (kept from your original)
const fmt = (n, c='USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n); }
  catch { return (c + ' ' + Number(n||0).toFixed(2)); }
};

const lastUpdateText = (tsSec) => {
  const now = Date.now();
  const t = (tsSec || (Date.now()/1000)) * 1000;
  const diffMin = Math.max(0, Math.round((now - t)/60000));
  return diffMin <= 1 ? 'just now' : `${diffMin} minutes ago`;
};

function toCurrency(amountUSD, ccy) {
  if (!fx || !fx.rates) return amountUSD;
  if (ccy === 'USD') return amountUSD;

  const r = fx.rates;
  if (fx.base === 'USD' || r.USD === 1) return amountUSD * (r[ccy] ?? 1);
  if (!r.USD || !r[ccy]) return amountUSD;
  return amountUSD * (r[ccy] / r.USD);
}

function pricePerGramForKaratUSD(karat) {
  const key = `price_gram_${karat}k`;
  if (gold && gold[key] != null) return gold[key]; // USD/g
  const perGram24 = (gold?.price || 0) / OZ_TO_GRAM; // USD/g
  return karat === 24 ? perGram24 : perGram24 * (karat / 24);
}

function unitToGrams(weight, unit) {
  if (unit === 'g')  return weight;
  if (unit === 'kg') return weight * 1000;
  if (unit === 'oz') return weight * OZ_TO_GRAM;
  return weight;
}

function sentimentFromChange() {
  if (!gold) return '—';
  if (gold.ch > 0) return 'Bullish';
  if (gold.ch < 0) return 'Bearish';
  return 'Neutral';
}

function setDeltaPill(el, chp) {
  if (!el) return;
  const up = Number(chp) > 0, down = Number(chp) < 0;
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  if (up) {
    el.className = base + ' text-green-700 bg-green-50';
    el.textContent = `▲ ${Number(chp).toFixed(2)}%`;
  } else if (down) {
    el.className = base + ' text-red-700 bg-red-50';
    el.textContent = `▼ ${Number(chp).toFixed(2)}%`;
  } else {
    el.className = 'text-xs text-gray-500';
    el.textContent = '● 0.00%';
  }
}

// backoff state
const backoffState = { consecutiveErrors: 0, backoffMs: 0, lastError: null };

// fetch with timeout utility
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// fetch gold once using the GoldAPI pattern you provided
async function fetchGoldOnce() {
  const base = (GOLD_API_BASE || '').replace(/\/+$/,'');
  if (!base) {
    console.error('Gold API base not configured. Set <meta name="gold-api"> or adjust GOLD_API_BASE.');
    return null;
  }

  // GoldAPI endpoint for XAU/USD as per your snippet
  const url = `${base}/XAU/USD?t=${Date.now()}`;

  // build headers exactly like your snippet
  const myHeaders = new Headers();
  myHeaders.append("x-access-token", GOLD_API_KEY);
  myHeaders.append("Content-Type", "application/json");

  try {
    const resp = await fetchWithTimeout(url, { method: 'GET', headers: myHeaders }, 5000);
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>'');
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${txt ? ('- ' + txt) : ''}`);
    }
    const data = await resp.json().catch(()=>null);
    if (!data) throw new Error('Invalid JSON from GoldAPI');
    // normalize common fields used by UI (attempts to map provider fields to your existing keys)
    const normalized = normalizeGoldApiResponse(data);
    // reset backoff state
    backoffState.consecutiveErrors = 0;
    backoffState.backoffMs = 0;
    backoffState.lastError = null;
    return normalized;
  } catch (err) {
    backoffState.consecutiveErrors++;
    backoffState.lastError = err;
    const backoff = Math.min(30000, 1000 * Math.pow(2, Math.max(0, backoffState.consecutiveErrors - 1)));
    backoffState.backoffMs = backoff;
    console.warn('fetchGoldOnce error:', err && (err.message || err), `— backing off ${backoff}ms (count=${backoffState.consecutiveErrors})`);
    return null;
  }
}

// Normalizer: adapt goldapi fields to the UI's expected keys (price, price_gram_24k, ch, chp, etc.)
function normalizeGoldApiResponse(data) {
  // Example GoldAPI response fields (may vary): price (per oz USD), ch (change), chp (percent), timestamp
  // GoldAPI also sometimes returns price_gram directly; if not, we compute from price (/oz -> /g)
  const out = {
    // keep raw
    raw: data,
    timestamp: data.timestamp || Math.floor(Date.now()/1000),
    price: data.price ?? data['price'] ?? null,
    ch: data.ch ?? data.change ?? 0,
    chp: data.chp ?? data.change_pct ?? 0,
    open_price: data.open_price ?? data.open ?? null,
    low_price: data.low_price ?? data.low ?? null,
    high_price: data.high_price ?? data.high ?? null,
    // price per gram if provider gives it directly; otherwise compute from price (/oz -> /g)
    price_gram_24k: data.price_gram_24k ?? data.price_gram ?? (data.price ? (data.price / OZ_TO_GRAM) : null),
    // best-effort other karats (fallback compute)
  };

  // If provider gave only price (per oz), compute the other per-gram karats
  if (!out.price_gram_24k && out.price) out.price_gram_24k = out.price / OZ_TO_GRAM;
  // Fill k-values for UI if missing
  if (out.price_gram_24k != null) {
    out.price_gram_22k = out.price_gram_22k ?? out.price_gram_24k * (22/24);
    out.price_gram_21k = out.price_gram_21k ?? out.price_gram_24k * (21/24);
    out.price_gram_20k = out.price_gram_20k ?? out.price_gram_24k * (20/24);
    out.price_gram_18k = out.price_gram_18k ?? out.price_gram_24k * (18/24);
    out.price_gram_16k = out.price_gram_16k ?? out.price_gram_24k * (16/24);
    out.price_gram_14k = out.price_gram_14k ?? out.price_gram_24k * (14/24);
    out.price_gram_10k = out.price_gram_10k ?? out.price_gram_24k * (10/24);
  }

  return out;
}

// FX fetch (same as before)
async function fetchFx() {
  try {
    const symbols = 'USD,AED,INR,EUR,GBP,CNY,SAR,AUD,CAD,PKR';
    const res = await fetchWithTimeout(`${FX_API_URL}?symbols=${symbols}&base=USD`, {}, 5000);
    if (!res.ok) throw new Error('FX API error ' + res.status);
    const data = await res.json();
    if (!data || !data.rates || Object.keys(data.rates).length === 0) throw new Error('Empty FX');
    fx = { base: data.base || 'USD', rates: data.rates };
    usingFxFallback = false;
  } catch (e) {
    console.warn('FX fetch failed; using fallback', e);
    fx = { ...FX_FALLBACK };
    usingFxFallback = true;
  }
}

// UI update (adapted to normalized gold object structure)
function updateUI() {
  const ccySel = document.getElementById('currency');
  const ccy = ccySel ? ccySel.value : 'USD';
  if (!gold || !fx) return;

  // gold.price_gram_24k etc. exist on normalized object
  const g24 = toCurrency(gold.price_gram_24k, ccy);
  const g22 = toCurrency(gold.price_gram_22k, ccy);
  const g18 = toCurrency(gold.price_gram_18k, ccy);
  const g14 = toCurrency(gold.price_gram_14k, ccy);
  const spot = toCurrency(gold.price, ccy);
  const open = toCurrency(gold.open_price, ccy);
  const high = toCurrency(gold.high_price, ccy);
  const low  = toCurrency(gold.low_price, ccy);

  const el24 = document.getElementById('stat-24k');
  const el22 = document.getElementById('stat-22k');
  const elSpot = document.getElementById('stat-spot');
  if (el24)  el24.textContent  = fmt(g24, ccy) + ' / g';
  if (el22)  el22.textContent  = fmt(g22, ccy) + ' / g';
  if (elSpot) elSpot.textContent = fmt(spot, ccy) + ' / oz';

  setDeltaPill(document.getElementById('stat-spot-ch'), gold.chp);

  const map = [
    ['card-24k', g24], ['card-22k', g22], ['card-18k', g18], ['card-14k', g14]
  ];
  map.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(val, ccy) + ' / g';
  });
  ['card-24k-ch','card-22k-ch','card-18k-ch','card-14k-ch'].forEach(id => {
    setDeltaPill(document.getElementById(id), gold.chp);
  });

  const elOpen = document.getElementById('stat-open');
  const elHigh = document.getElementById('stat-high');
  const elLow  = document.getElementById('stat-low');
  if (elOpen) elOpen.textContent = fmt(open, ccy) + ' / oz';
  if (elHigh) elHigh.textContent = fmt(high, ccy) + ' / oz';
  if (elLow)  elLow.textContent  = fmt(low,  ccy) + ' / oz';

  const elSent = document.getElementById('sentiment');
  if (elSent) elSent.textContent = sentimentFromChange();

  const elLast = document.getElementById('last-update');
  if (elLast) elLast.textContent = lastUpdateText(gold.timestamp);

  const fxNoteEl = document.getElementById('fx-note');
  if (fxNoteEl) fxNoteEl.textContent = usingFxFallback
    ? 'Converted using fallback FX rates (approx).'
    : `Converted from ${fx.base} via live FX.`;
}

function handleCalculator() {
  const btn = document.getElementById('btn-calc');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const karat = parseInt(document.getElementById('calc-karat').value, 10);
    const weight = parseFloat(document.getElementById('calc-weight').value || '0');
    const unit = document.getElementById('calc-unit').value;
    const ccy = document.getElementById('calc-currency').value;

    if (!weight || weight <= 0) {
      document.getElementById('calc-result').textContent = 'Enter a valid weight.';
      return;
    }
    const grams = unitToGrams(weight, unit);
    const perGramUSD = pricePerGramForKaratUSD(karat);
    const totalUSD = grams * perGramUSD;

    const total = toCurrency(totalUSD, ccy);
    const perGramLocal = toCurrency(perGramUSD, ccy);

    document.getElementById('calc-result').textContent =
      `≈ ${fmt(total, ccy)} (${grams.toFixed(3)} g × ${fmt(perGramLocal, ccy)}/g)`;
  });
}

// Polling loop
let polling = true;
async function pollingLoop() {
  while (polling) {
    const start = Date.now();
    if (backoffState.backoffMs > 0) {
      await new Promise(r => setTimeout(r, backoffState.backoffMs));
    }
    const data = await fetchGoldOnce();
    if (data) {
      gold = data;
      fetchFx().catch(()=>{});
      updateUI();
    } else {
      if (gold) updateUI();
    }

    const elapsed = Date.now() - start;
    const healthyWait = Math.max(0, 500 - elapsed);
    const waitMs = backoffState.backoffMs > 0 ? backoffState.backoffMs : healthyWait;
    await new Promise(r => setTimeout(r, waitMs));
  }
}

async function init() {
  await Promise.allSettled([fetchFx(), fetchGoldOnce().then(d => { if (d) gold = d; })]);
  updateUI();
  handleCalculator();

  const cur = document.getElementById('currency');
  if (cur) cur.addEventListener('change', updateUI);

  polling = true;
  pollingLoop();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      polling = false;
    } else {
      if (!polling) {
        polling = true;
        pollingLoop();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
