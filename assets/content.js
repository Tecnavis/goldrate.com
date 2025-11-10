
(function(){
  const API = (window.CONFIG && window.CONFIG.CMS_API) || '';
  if (!API) return;
  async function load(type, targetId){
    try{
      const r = await fetch(`${API}/posts?type=${encodeURIComponent(type)}&limit=6`);
      const j = await r.json();
      if (!r.ok) return;
      const box = document.getElementById(targetId);
      if (!box) return;
      box.innerHTML = (j.items||[]).map(p => `
        <a href="${type}.html#${p.slug}" class="card p-4 hover:shadow-xl2 block transition">
          <div class="h-40 w-full overflow-hidden rounded-xl bg-gray-100 mb-3">
            ${p.coverImage ? `<img src="${API}${p.coverImage}" class="w-full h-40 object-cover" />` : ''}
          </div>
          <div class="text-sm text-gray-500">${new Date(p.publishedAt||p.createdAt).toLocaleDateString()}</div>
          <div class="font-semibold mt-1">${p.title}</div>
          <div class="text-sm text-gray-600 line-clamp-2 mt-1">${p.excerpt||''}</div>
        </a>`).join('');
    }catch(e){}
  }
  load('blog','blog-cards');
  load('news','news-cards');
})();
