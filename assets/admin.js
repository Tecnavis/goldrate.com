
/* Admin panel client */
(async function(){
  const API = window.CONFIG?.CMS_API || (location.origin);
  let TOKEN = localStorage.getItem('goldrates_token') || '';

  const el = (id)=>document.getElementById(id);
  const status = (id,msg)=>{ const n=el(id); if(n) n.textContent=msg||''; }

  function showApp(){
    el('card-login').classList.add('hidden');
    el('app').classList.remove('hidden');
    el('btn-logout').classList.remove('hidden');
  }
  function showLogin(){
    el('card-login').classList.remove('hidden');
    el('app').classList.add('hidden');
    el('btn-logout').classList.add('hidden');
  }

  el('btn-logout').onclick = ()=>{ localStorage.removeItem('goldrates_token'); TOKEN=''; location.reload(); };

  async function me(){
    if (!TOKEN) return false;
    try{
      const r = await fetch(`${API}/auth/me`, { headers:{ Authorization:`Bearer ${TOKEN}` } });
      return r.ok;
    }catch{ return false; }
  }

  // Login handler
  el('btn-login').onclick = async () => {
    const email = el('a-email').value.trim();
    const password = el('a-pass').value;
    status('a-status','Logging in...');
    try{
      const r = await fetch(`${API}/auth/login`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password })
      });
      const j = await r.json();
      if (r.ok){
        TOKEN = j.token;
        localStorage.setItem('goldrates_token', TOKEN);
        showApp(); loadAll();
        status('a-status','');
      } else {
        status('a-status', j.error || 'Login failed');
      }
    } catch(e){
      console.error(e);
      status('a-status','Network error');
    }
  };

  // Posts
  const quill = new Quill('#quill', { theme:'snow' });

  async function savePost(){
    const body = {
      type: el('p-type').value,
      title: el('p-title').value.trim(),
      excerpt: el('p-excerpt').value.trim(),
      content: quill.root.innerHTML,
      published: el('p-published').checked,
      coverImage: el('p-image-url').value.trim()
    };
    status('p-status','Saving...');
    try{
      const r = await fetch(`${API}/posts`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${TOKEN}` },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (r.ok){ status('p-status','Saved!'); refreshTable(); }
      else status('p-status', j.error || 'Failed');
    }catch(e){ console.error(e); status('p-status','Network error'); }
  }
  el('p-save').onclick = savePost;

  el('p-upload').onclick = async () => {
    const file = el('p-image-file').files[0];
    if (!file){ alert('Choose an image first.'); return; }
    status('p-status','Uploading image...');
    const fd = new FormData();
    fd.append('file', file);
    try{
      const r = await fetch(`${API}/uploads`, { method:'POST', headers:{ Authorization:`Bearer ${TOKEN}` }, body:fd });
      const j = await r.json();
      if (r.ok){
        el('p-image-url').value = j.url;
        status('p-status','Image uploaded.');
      } else status('p-status', j.error || 'Upload failed');
    }catch(e){ console.error(e); status('p-status','Network error'); }
  };

  async function refreshTable(){
    const t = el('posts-tbody');
    t.innerHTML = '<tr><td class="p-3 text-sm text-gray-500" colspan="5">Loading...</td></tr>';
    try{
      const r = await fetch(`${API}/posts?limit=50&page=1`);
      const j = await r.json();
      if (!r.ok){ t.innerHTML='<tr><td class="p-3 text-sm text-red-500" colspan="5">Failed to load</td></tr>'; return; }
      t.innerHTML = j.items.map(p => `
        <tr class="border-t">
          <td class="py-2 pr-4">${p.title}</td>
          <td class="py-2 pr-4">${p.type}</td>
          <td class="py-2 pr-4">${p.published ? 'Yes':'No'}</td>
          <td class="py-2 pr-4 text-xs">${new Date(p.updatedAt||p.createdAt).toLocaleString()}</td>
          <td class="py-2 pr-4 text-right">
            <button data-id="${p._id}" class="del-post text-red-600 text-xs">Delete</button>
          </td>
        </tr>`).join('');
      t.querySelectorAll('.del-post').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete post?')) return;
        const id = btn.getAttribute('data-id');
        await fetch(`${API}/posts/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${TOKEN}` } });
        refreshTable();
      });
    }catch(e){ console.error(e); }
  }

  async function loadAll(){
    refreshTable();
  }

  // Init on load
  (await me()) ? (showApp(), loadAll()) : showLogin();
})();
