// assets/content.js - enhanced debug version
(function () {
  const API =
    (window.CONFIG && window.CONFIG.CMS_API) ||
    document.querySelector('meta[name="cms-api"]')?.content ||
    "";

  if (!API) {
    console.warn("content.js: CMS API not configured (no meta cms-api).");
    return;
  }

  const abs = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return `${API}${u.startsWith("/") ? u : "/" + u}`;
  };

  async function load(type, targetId, limit = 6) {
    const box = document.getElementById(targetId);
    if (!box) {
      console.debug(`content.js: target ${targetId} not found on page.`);
      return;
    }

    box.innerHTML = '<div class="text-sm text-gray-500 p-4 border rounded-xl bg-white/50">Loading...</div>';

    try {
      const url = `${API}/posts?type=${encodeURIComponent(type)}&limit=${limit}`;
      const r = await fetch(url);
      if (!r.ok) {
        const text = await r.text().catch(()=>''); 
        console.error(`content.js: fetch ${url} returned ${r.status}`, text);
        box.innerHTML = `<div class="text-sm text-red-500 p-4 border rounded-xl">Could not load items (status ${r.status}).</div>`;
        return;
      }

      const j = await r.json();
      let items = j.items || j || [];
      // Keep only published (if field exists) and sort latest first
      items = items.filter(p => p.published !== false);
      items.sort((a,b) => {
        const da = new Date(a.publishedAt || a.updatedAt || a.createdAt || 0).getTime();
        const db = new Date(b.publishedAt || b.updatedAt || b.createdAt || 0).getTime();
        return db - da;
      });

      items = items.slice(0, limit);
      if (!items.length) {
        box.innerHTML =
          '<div class="text-sm text-gray-500 p-4 border rounded-xl bg-white/50">No posts yet.</div>';
        return;
      }

      box.innerHTML = items
        .map((p) => {
          const img = p.coverImage ? `<img src="${abs(p.coverImage)}" class="w-full h-40 object-cover" alt="">` : "";
          const href = `${type}.html#${encodeURIComponent(p.slug || "")}`;
          return `<a class="block shadow-sm rounded-xl overflow-hidden bg-white" href="${href}">
              ${img}
              <div class="p-4">
                <div class="text-sm text-gray-500">${new Date(p.publishedAt||p.updatedAt||p.createdAt||0).toLocaleDateString()}</div>
                <div class="font-semibold mt-1">${p.title || ''}</div>
                <div class="text-sm text-gray-600 mt-2">${p.excerpt || ''}</div>
              </div>
            </a>`;
        })
        .join("");
    } catch (e) {
      console.error("content.js load error:", e);
      box.innerHTML = `<div class="text-sm text-gray-500 p-4 border rounded-xl bg-white/50">Network error: ${e.message || e}</div>`;
    }
  }

  load("blog", "blog-cards", 6);
  load("news", "news-cards", 6);
})();