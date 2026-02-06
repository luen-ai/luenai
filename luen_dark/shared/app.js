(function(){
  const fmt = new Intl.NumberFormat('ko-KR');
  window.luen = {
    sb(){
      if (!window.supabase) throw new Error('supabase-js 로드 실패');
      const url = window.LUEN_SUPABASE_URL;
      const key = window.LUEN_SUPABASE_ANON_KEY;
      window.__LUEN_sb = window.__LUEN_sb || window.supabase.createClient(url, key);
      return window.__LUEN_sb;
    },
    won(n){
      const v = Number(n||0);
      return fmt.format(v);
    },
    // 매우 단순한 로컬 로그인(테이블 기반). 운영용 보안 강화는 다음 단계에서.
    setSession(kind, user){
      localStorage.setItem(`LUEN_${kind}_logged_in`, 'true');
      localStorage.setItem(`LUEN_${kind}_user`, JSON.stringify(user||{}));
    },
    clearSession(kind){
      localStorage.removeItem(`LUEN_${kind}_logged_in`);
      localStorage.removeItem(`LUEN_${kind}_user`);
    },
    getSession(kind){
      const ok = localStorage.getItem(`LUEN_${kind}_logged_in`) === 'true';
      const raw = localStorage.getItem(`LUEN_${kind}_user`);
      return { ok, user: raw ? JSON.parse(raw) : null };
    },
    require(kind, redirect){
      const s = window.luen.getSession(kind);
      if (!s.ok) {
        alert('로그인이 필요합니다.');
        window.location.href = redirect;
        return null;
      }
      return s.user;
    }
  };
})();
