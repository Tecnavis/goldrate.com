// assets/content.js
// Load latest Blog & News cards from CMS

(function () {
  // 1) CMS API base detection
  const API_RAW =
    (window.CONFIG && window.CONFIG.CMS_API) ||
    document.querySelector('meta[name="cms-api"]')?.content ||
    document.querySelector('meta[name="gold-api"]')?.content ||
    "";

  if (!API_RAW) {
    console.warn("content.js: CMS API not configured (no cms-api meta or CONFIG.CMS_API).");
    return;
  }

  const API_BASE = API_RAW.replace(/\/+$/, ""); // trim trailing slash

  // Turn relative path into absolute CMS URL
  const abs = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return `${API_BASE}${u.startsWith("/") ? u : "/" + u}`;
  };

  // Generic loader for blog/news
  async function load(type, targetId, limit = 3) {
    const box = document.getElementById(targetId);
    if (!box) return;

    box.innerHTML =
      '<div class="text-sm text-gray-600 p-4 bg-white rounded-lg">Loading...</div>';

    // We hit /posts with filters:
    //   GET /posts?type=blog&limit=3&published=true
    const params = new URLSearchParams({
      type,
      page: "1",
      limit: String(limit),
      published: "true",
    });

    try {
      const resp = await fetch(`${API_BASE}/posts?${params.toString()}`, {
        cache: "no-store",
      });

      if (!resp.ok) {
        throw new Error("HTTP " + resp.status);
      }

      const json = await resp.json();
      const items = Array.isArray(json)
        ? json
        : json.items || json.data || [];

      if (!items.length) {
        box.innerHTML =
          '<div class="text-sm text-gray-500 p-4 bg-white rounded-lg">No posts yet.</div>';
        return;
      }

      box.innerHTML = items
        .map((p) => {
          const img = abs(
            p.coverImage || p.image || p.thumbnail || p.cover || ""
          );
          const date = new Date(
            p.publishedAt || p.createdAt || p.date || Date.now()
          ).toLocaleDateString();

          // Link to listing page with slug as query param (optional)
          const href =
            type === "blog"
              ? (p.slug
                  ? `blog.html?slug=${encodeURIComponent(p.slug)}`
                  : "blog.html")
              : (p.slug
                  ? `news.html?slug=${encodeURIComponent(p.slug)}`
                  : "news.html");

          return `
          <a href="${href}" class="block p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition">
            <div class="flex gap-3 items-start">
              ${
                img
                  ? `<img src="${img}" alt="${p.title || ""}" class="h-20 w-28 object-cover rounded-md flex-none"/>`
                  : ""
              }
              <div class="flex-1">
                <div class="text-xs text-gray-500">${date}</div>
                <div class="font-semibold mt-1 line-clamp-2">${p.title || ""}</div>
                <div class="text-sm text-gray-600 mt-2 line-clamp-3">
                  ${p.excerpt || p.summary || ""}
                </div>
              </div>
            </div>
          </a>`;
        })
        .join("");
    } catch (e) {
      console.error("content.js load error:", type, e);
      box.innerHTML = `
        <div class="text-sm text-red-600 p-4 rounded bg-red-50">
          Cannot load ${type}: ${e.message || e}
        </div>`;
    }
  }

  // Run when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    load("blog", "blog-cards", 3);
    load("news", "news-cards", 3);
  });
})();
