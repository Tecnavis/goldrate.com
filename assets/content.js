// assets/content.js
(function () {
  const API =
    (window.CONFIG && window.CONFIG.CMS_API) ||
    document.querySelector('meta[name="cms-api"]')?.content ||
    "";

  if (!API) return;

  const abs = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return `${API}${u.startsWith("/") ? u : "/" + u}`;
  };

  async function load(type, targetId, limit = 6) {
    const box = document.getElementById(targetId);
    if (!box) return;

    // skeleton
    box.innerHTML = Array.from({ length: Math.min(limit, 6) })
      .map(
        () => `
        <div class="animate-pulse p-4 border rounded-xl bg-white/50">
          <div class="h-40 bg-gray-200 rounded-xl mb-3"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>`
      )
      .join("");

    try {
      const r = await fetch(
        `${API}/posts?type=${encodeURIComponent(type)}&limit=${limit}`
      );
      const j = await r.json();
      if (!r.ok) {
        box.innerHTML =
          '<div class="text-sm text-gray-500 p-4 border rounded-xl bg-white/50">Could not load items.</div>';
        return;
      }

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
          const img = p.coverImage ? `<img src="${abs(
            p.coverImage
          )}" class="w-full h-40 object-cover" alt="">` : "";
          const href = `${type}.html#${encodeURIComponent(
            p.slug || ""
          )}`; // or `${type}.html?slug=${encodeURIComponent(p.slug||'')}`

          return `
          <a href="${href}" class="card p-4 border rounded-xl bg-white hover:shadow transition block">
            <div class="h-40 w-full overflow-hidden rounded-xl bg-gray-100 mb-3">
              ${img}
            </div>
            <div class="text-sm text-gray-500">${new Date(
              p.publishedAt || p.createdAt
            ).toLocaleDateString()}</div>
            <div class="font-semibold mt-1">${p.title || ""}</div>
            <div class="text-sm text-gray-600 line-clamp-2 mt-1">${
              p.excerpt || ""
            }</div>
          </a>`;
        })
        .join("");
    } catch (e) {
      box.innerHTML =
        '<div class="text-sm text-gray-500 p-4 border rounded-xl bg-white/50">Network error.</div>';
      console.error("content.js load error:", e);
    }
  }

  // IDs must exist in your HTML
  load("blog", "blog-cards", 6);
  load("news", "news-cards", 6);
})();
