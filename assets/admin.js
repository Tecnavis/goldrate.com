/* GoldRates Admin Client (fixed/defensive) */
(function () {
  // Wait until DOM is ready before running the admin logic
  document.addEventListener('DOMContentLoaded', () => {

    const API = (window.CONFIG && window.CONFIG.CMS_API) || location.origin;
    const el = (id) => document.getElementById(id);
    let TOKEN = localStorage.getItem("goldrates_token") || "";
    let CURRENT_ID = null;
    let quill;

    function status(id, msg) {
      const n = el(id);
      if (n) n.textContent = msg || "";
      else console.debug(`status: element ${id} not found`);
    }

    // UI
    function showApp() {
      if (el("card-login")) el("card-login").classList.add("hidden");
      if (el("app")) el("app").classList.remove("hidden");
      if (el("btn-logout")) el("btn-logout").classList.remove("hidden");
    }
    function showLogin() {
      if (el("card-login")) el("card-login").classList.remove("hidden");
      if (el("app")) el("app").classList.add("hidden");
      if (el("btn-logout")) el("btn-logout").classList.add("hidden");
    }

    // Logout (guarded)
    if (el("btn-logout")) {
      el("btn-logout").onclick = () => {
        localStorage.removeItem("goldrates_token");
        TOKEN = "";
        location.reload();
      };
    }

    // Eye toggle
    (function () {
      const eye = el("pass-eye");
      const input = el("a-pass");
      if (eye && input) {
        eye.textContent = "👁";
        eye.addEventListener("click", () => {
          const t = input.type === "password" ? "text" : "password";
          input.type = t;
          eye.textContent = t === "password" ? "👁" : "🙈";
        });
      }
    })();

    // Quill
    function initQuill() {
      if (quill) return;
      if (typeof Quill === 'undefined') {
        console.debug("Quill not found on page");
        return;
      }
      quill = new Quill("#quill", { theme: "snow" });
    }

    async function me() {
      if (!TOKEN) return false;
      try {
        const r = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        return r.ok;
      } catch (err) {
        console.debug("me() failed:", err);
        return false;
      }
    }

    // Login (guarded)
    if (el("btn-login")) {
      el("btn-login").onclick = async () => {
        const email = (el("a-email") && el("a-email").value.trim()) || "";
        const password = (el("a-pass") && el("a-pass").value) || "";
        status("a-status", "Logging in...");
        try {
          const r = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const j = await r.json();
          if (r.ok) {
            TOKEN = j.token;
            localStorage.setItem("goldrates_token", TOKEN);
            showApp();
            initQuill();
            loadAll();
            status("a-status", "");
          } else status("a-status", j.error || "Login failed");
        } catch (e) {
          status("a-status", "Network error");
          console.error(e);
        }
      };
    }

    // Save or Update post
    async function savePost() {
      const body = {
        type: el("p-type") ? el("p-type").value : "blog",
        title: el("p-title") ? el("p-title").value.trim() : "",
        excerpt: el("p-excerpt") ? el("p-excerpt").value.trim() : "",
        content: (quill && quill.root && quill.root.innerHTML) || "",
        published: el("p-published") ? el("p-published").checked : false,
        coverImage: el("p-image-url") ? el("p-image-url").value.trim() : "",
      };
      status("p-status", "Saving...");
      try {
        const endpoint = CURRENT_ID ? `${API}/posts/${CURRENT_ID}` : `${API}/posts`;
        const method = CURRENT_ID ? "PUT" : "POST";
        const r = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TOKEN}`,
          },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (r.ok) {
          status("p-status", CURRENT_ID ? "Updated!" : "Saved!");
          CURRENT_ID = null;
          if (el("p-title")) el("p-title").value = "";
          if (el("p-excerpt")) el("p-excerpt").value = "";
          if (el("p-image-url")) el("p-image-url").value = "";
          if (quill && quill.root) quill.root.innerHTML = "";
          refreshTable();
        } else status("p-status", j.error || "Failed");
      } catch (e) {
        console.error(e);
        status("p-status", "Network error");
      }
    }
    if (el("p-save")) el("p-save").onclick = savePost;

    // Upload
    if (el("p-upload")) {
      el("p-upload").onclick = async () => {
        const file = el("p-image-file") && el("p-image-file").files[0];
        if (!file) {
          alert("Choose an image first.");
          return;
        }
        status("p-status", "Uploading...");
        const fd = new FormData();
        fd.append("file", file);
        try {
          const r = await fetch(`${API}/uploads`, {
            method: "POST",
            headers: { Authorization: `Bearer ${TOKEN}` },
            body: fd,
          });
          const j = await r.json();
          if (r.ok) {
            const abs = j.url?.startsWith("http") ? j.url : `${API}${j.url}`;
            if (el("p-image-url")) el("p-image-url").value = abs;
            status("p-status", "Image uploaded");
          } else status("p-status", j.error || "Upload failed");
        } catch (e) {
          console.error(e);
          status("p-status", "Network error");
        }
      };
    }

    // Defensive helper to attach one delegated listener per table element
    function ensureTableDelegation(tEl) {
      if (!tEl) return;
      if (tEl.dataset.delegation === "1") return;
      tEl.addEventListener('click', async (ev) => {
        // Edit
        const editBtn = ev.target.closest('.edit-post');
        if (editBtn) {
          const id = editBtn.getAttribute("data-id");
          try {
            const r = await fetch(`${API}/posts/${id}`, {
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            const p = await r.json();
            if (r.ok) {
              CURRENT_ID = id;
              if (el("p-type")) el("p-type").value = p.type || "blog";
              if (el("p-title")) el("p-title").value = p.title || "";
              if (el("p-excerpt")) el("p-excerpt").value = p.excerpt || "";
              if (el("p-image-url")) el("p-image-url").value = p.coverImage || "";
              if (quill && quill.root) quill.root.innerHTML = p.content || "";
              window.scrollTo({ top: 0, behavior: "smooth" });
              status("p-status", "Editing...");
            }
          } catch (e) {
            console.error(e);
          }
          return;
        }

        // Delete
        const delBtn = ev.target.closest('.del-post');
        if (delBtn) {
          if (!confirm("Delete post?")) return;
          const id = delBtn.getAttribute("data-id");
          try {
            await fetch(`${API}/posts/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            refreshTable();
          } catch (e) {
            console.error(e);
          }
          return;
        }
      });
      tEl.dataset.delegation = "1";
    }

    // Table (admin view)
    async function refreshTable() {
      const t = document.getElementById("t-body") || document.getElementById("posts-tbody");
      if (!t) {
        console.debug("refreshTable: table container not found (t-body/posts-tbody)");
        return;
      }
      // set loading state
      try {
        t.innerHTML =
          '<tr><td colspan="5" class="p-3 text-sm text-gray-500">Loading...</td></tr>';
      } catch (e) {
        console.error("refreshTable: cannot set innerHTML on table container", e);
        return;
      }

      try {
        let r = await fetch(`${API}/posts/admin?limit=50&page=1`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        if (r.status === 404) r = await fetch(`${API}/posts?limit=50&page=1`);
        const j = await r.json();
        if (!r.ok) {
          t.innerHTML =
            '<tr><td colspan="5" class="p-3 text-sm text-red-500">Failed to load</td></tr>';
          return;
        }
        const items = j.items || j || [];
        t.innerHTML = items
          .map(
            (p) => `
          <tr class="border-t">
            <td class="py-2 pr-4">${p.title || ''}</td>
            <td class="py-2 pr-4">${p.type || ''}</td>
            <td class="py-2 pr-4">${p.published ? "Yes" : "No"}</td>
            <td class="py-2 pr-4 text-xs">${new Date(
              p.updatedAt || p.createdAt || 0
            ).toLocaleString()}</td>
            <td class="py-2 pr-4 text-right space-x-3">
              <button data-id="${p._id}" class="edit-post text-amber-600 text-xs">Edit</button>
              <button data-id="${p._id}" class="del-post text-red-600 text-xs">Delete</button>
            </td>
          </tr>`
          )
          .join("");

        // Ensure a single delegated listener on the table container
        ensureTableDelegation(t);

      } catch (e) {
        console.error("refreshTable error", e);
      }
    }

    // Safe refreshGallery stub (no runtime errors if gallery element absent)
    async function refreshGallery() {
      const container = el('gallery-body') || el('gallery') || el('g-body');
      if (!container) {
        console.debug('refreshGallery: no gallery container found');
        return;
      }
      try {
        container.innerHTML = '<div class="p-3 text-sm text-gray-500">Loading gallery...</div>';
      } catch (e) {
        console.error('refreshGallery: cannot set innerHTML', e);
        return;
      }

      try {
        const r = await fetch(`${API}/uploads?limit=50`, { headers: { Authorization: `Bearer ${TOKEN}` } });
        if (!r.ok) {
          container.innerHTML = '<div class="p-3 text-sm text-red-500">Failed to load gallery.</div>';
          return;
        }
        const data = await r.json();
        const items = data.items || data || [];
        if (!items.length) {
          container.innerHTML = '<div class="p-3 text-sm text-gray-500">No gallery items.</div>';
          return;
        }
        container.innerHTML = items.map(it => {
          const url = it.url?.startsWith('http') ? it.url : `${API}${it.url || ''}`;
          const caption = (it.name || it.title || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return `<div class="inline-block p-2"><img src="${url}" alt="${caption}" style="max-width:120px;max-height:90px;border-radius:6px"/><div class="text-xs mt-1">${caption}</div></div>`;
        }).join('');
      } catch (err) {
        console.error('refreshGallery error', err);
        container.innerHTML = '<div class="p-3 text-sm text-red-500">Gallery load error.</div>';
      }
    }

    async function loadAll() {
      initQuill();
      refreshTable();
      // optionally refresh gallery if your admin UI includes it
      refreshGallery();
    }

    // boot
    (async () => {
      (await me()) ? (showApp(), loadAll()) : showLogin();
    })();

  }); // end DOMContentLoaded listener
})(); // end IIFE
