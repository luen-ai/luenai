(function () {
  // luen 네임스페이스 보장
  window.luen = window.luen || {};

  // 1) Supabase JS 라이브러리 로드 확인
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[LUEN] supabase-js not loaded. Make sure supabase.min.js is included before sb.js');
    return;
  }

  // 2) config 값 확인
  const url = window.LUEN_SUPABASE_URL;
  const key = window.LUEN_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('[LUEN] Missing LUEN_SUPABASE_URL / LUEN_SUPABASE_ANON_KEY in shared/config.js');
    return;
  }

  // 3) "클라이언트" 생성 (여기서만!)
  const client = window.supabase.createClient(url, key, {
    auth: { persistSession: false }, // 우리는 auth.users 안 쓰는 구조
    realtime: { params: { eventsPerSecond: 10 } },
  });

  // 4) 모든 페이지가 동일하게 쓰도록 고정
  window.luen.sb = function () {
    return client;
  };

  console.log('[LUEN] Supabase client ready:', url);
})();
