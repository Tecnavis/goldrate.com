/* GoldRates Admin Client */
(function () {
  const API = (window.CONFIG && window.CONFIG.CMS_API) || location.origin;
  const el = (id) => document.getElementById(id);
  let TOKEN = localStorage.getItem("goldrates_token") || "";
  let CURRENT_ID = null;
  let quill;

  function status(id, msg) {
    const n = el(id);
    if (n) n.textContent = msg || "";
  }

  // UI
  function showApp() {
    el("card-login").classList.add("hidden");
    el("app").classList.remove("hidden");
    el("btn-logout").classList.remove("hidden");
  }
  function showLogin() {
    el("card-login").classList.remove("hidden");
    el("app").classList.add("hidden");
    el("btn-logout").classList.add("hidden");
  }
  el("btn-logout").onclick = () => {
    localStorage.removeItem("goldrates_token");
    TOKEN = "";
    location.reload();
  };

  // Eye toggle
  (function () {
    const eye = document.getElementById("pass-eye");
    const input = document.getElementById("a-pass");
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
    quill = new Quill("#quill", { theme: "snow" });
  }

  async function me() {
    if (!TOKEN) return false;
    try {
      const r = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  // Login
  el("btn-login").onclick = async () => {
    const email = el("a-email").value.trim();
    const password = el("a-pass").value;
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

  // Save or Update post
  async function savePost() {
    const body = {
      type: el("p-type").value,
      title: el("p-title").value.trim(),
      excerpt: el("p-excerpt").value.trim(),
      content: quill.root.innerHTML,
      published: el("p-published").checked,
      coverImage: el("p-image-url").value.trim(),
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
        el("p-title").value = "";
        el("p-excerpt").value = "";
        el("p-image-url").value = "";
        quill.root.innerHTML = "";
        refreshTable();
      } else status("p-status", j.error || "Failed");
    } catch (e) {
      console.error(e);
      status("p-status", "Network error");
    }
  }
  el("p-save").onclick = savePost;

  // Upload
  el("p-upload").onclick = async () => {
    const file = el("p-image-file").files[0];
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
        el("p-image-url").value = abs;
        status("p-status", "Image uploaded");
      } else status("p-status", j.error || "Upload failed");
    } catch (e) {
      console.error(e);
      status("p-status", "Network error");
    }
  };

  // Table (admin view)
  async function refreshTable() {
    const t = document.getElementById("t-body") || document.getElementById("posts-tbody");
    if (!t) return;
    t.innerHTML =
      '<tr><td colspan="5" class="p-3 text-sm text-gray-500">Loading...</td></tr>';
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
          <td class="py-2 pr-4">${p.title}</td>
          <td class="py-2 pr-4">${p.type}</td>
          <td class="py-2 pr-4">${p.published ? "Yes" : "No"}</td>
          <td class="py-2 pr-4 text-xs">${new Date(
            p.updatedAt || p.createdAt
          ).toLocaleString()}</td>
          <td class="py-2 pr-4 text-right space-x-3">
            <button data-id="${p._id}" class="edit-post text-amber-600 text-xs">Edit</button>
            <button data-id="${p._id}" class="del-post text-red-600 text-xs">Delete</button>
          </td>
        </tr>`
        )
        .join("");

      // Edit
      t.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('.edit-post');
        if (!btn) return;

        btn.onclick = async () => {
          const id = btn.getAttribute("data-id");
          try {
            const r = await fetch(`${API}/posts/${id}`, {
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            const p = await r.json();
            if (r.ok) {
              CURRENT_ID = id;
              el("p-type").value = p.type || "blog";
              el("p-title").value = p.title || "";
              el("p-excerpt").value = p.excerpt || "";
              el("p-image-url").value = p.coverImage || "";
              quill.root.innerHTML = p.content || "";
              window.scrollTo({ top: 0, behavior: "smooth" });
              status("p-status", "Editing...");
            }
          } catch (e) {
            console.error(e);
          }
        };
      });

      // Delete (event delegation)
      t.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('.del-post');
        if (!btn) return;

        btn.onclick = async () => {
          if (!confirm("Delete post?")) return;
          const id = btn.getAttribute("data-id");
          await fetch(`${API}/posts/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${TOKEN}` },
          });
          refreshTable();
          return;
        };
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAll() {
    initQuill();
    refreshTable();
  }

  // boot
  (async () => {
    (await me()) ? (showApp(), loadAll()) : showLogin();
  })();
})();
