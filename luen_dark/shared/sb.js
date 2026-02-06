// Shared Supabase client + tiny helpers
// Requires:
//   - https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
//   - shared/config.js (window.NEO_SUPABASE_URL / window.NEO_SUPABASE_ANON_KEY)

(function () {
  const url = window.NEO_SUPABASE_URL;
  const key = window.NEO_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Supabase config missing. Edit shared/config.js');
    return;
  }

  // single client (avoid duplicate)
  window.__neo_sb = window.__neo_sb || window.supabase.createClient(url, key);
  window.neoSb = window.__neo_sb;

  window.neoFmtWon = function (n) {
    const v = Number(n || 0);
    return v.toLocaleString('ko-KR') + '원';
  };

  window.neoNowKST = function () {
    return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  };
})();
