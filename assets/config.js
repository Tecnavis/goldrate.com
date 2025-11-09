
// Simple config helper: reads from <meta name="cms-api"> and <meta name="gold-api">
(function () {
  const cms = document.querySelector('meta[name="cms-api"]')?.content?.trim()
           || document.querySelector('meta[name="gold-api"]')?.content?.trim()
           || (window.location.origin);
  const gold = document.querySelector('meta[name="gold-api"]')?.content?.trim() || '';
  window.CONFIG = { CMS_API: cms.replace(/\/+$/,''), GOLD_API: gold.replace(/\/+$/,'') };
  console.log('[CONFIG]', window.CONFIG);
})();
