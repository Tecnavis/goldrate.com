// content.patched.js — improved loader for blog/news with meta detection and better error messages
(function () {
  const API =
    (window.CONFIG && window.CONFIG.CMS_API) ||
    document.querySelector('meta[name="cms-api"]')?.content ||
    document.querySelector('meta[name="gold-api"]')?.content || // fallback to same meta
    "";

  if (!API) {
    console.warn("content.js: CMS API not configured (no meta cms-api or gold-api).");
    return;
  }

  const abs = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return `${API}${u.startsWith('/') ? u : '/' + u}`;
  };

  async function load(collection, elid, limit=6) {
    const box = document.getElementById(elid);
    if (!box) return;
    box.innerHTML = '<div class="text-sm p-4">Loading...</div>';

    try {
      const url = `${API.replace(/\/+$/,'')}/${collection}?limit=${limit}`;
      const resp = await fetch(url, {cache: 'no-store'});
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      const items = Array.isArray(json) ? json : (json.items || json.data || []);
      if (!items.length) {
        box.innerHTML = '<div class="text-sm text-gray-500">No posts yet.</div>';
        return;
      }
      box.innerHTML = items.map(p => {
        const img = abs(p.image || p.thumbnail || p.cover || '');
        const date = new Date(p.publishedAt || p.createdAt || p.date || Date.now()).toLocaleDateString();
        return `
          <a href="${p.url || '#'}" class="block p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition">
            <div class="flex gap-3 items-start">
              <img src="${img}" alt="" class="h-20 w-28 object-cover rounded-md flex-none"/>
              <div class="flex-1">
                <div class="text-xs text-gray-500">${date}</div>
                <div class="font-semibold mt-1">${p.title || ''}</div>
                <div class="text-sm text-gray-600 mt-2 line-clamp-3">${p.excerpt || p.summary || ''}</div>
              </div>
            </div>
          </a>`;
      }).join('');
    } catch (e) {
      console.error("content.js load error:", e);
      box.innerHTML = `<div class="text-sm text-red-600 p-4 rounded bg-red-50">Cannot load ${collection}: ${e.message || e}</div>`;
    }
  }

  load("blog", "blog-cards", 6);
  load("news", "news-cards", 6);
})();
