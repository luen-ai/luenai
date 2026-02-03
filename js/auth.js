/* js/auth.js (전체 교체본) - Supabase Auth + Signup Slide (single-click open) */
(() => {
  // prevent double init (event duplicate)
  if (window.__LUEN_AUTH_INIT__) return;
  window.__LUEN_AUTH_INIT__ = true;

  const SUPABASE_URL = "https://dgrcqwsjhffhfnyhazzn.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncmNxd3NqaGZmaGZueWhhenpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjE0OTYsImV4cCI6MjA4NTU5NzQ5Nn0.q3vXROnYfIfm_gjwniCM015HCR6Fts8-q8se3tNNzkE";

  // Supabase SDK must exist
  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!sb) {
    console.error("Supabase SDK not loaded.");
    return;
  }

  function qs(id) { return document.getElementById(id); }

  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  }

  function sanitizePhone(v) {
    return (v || "").trim();
  }

  function init() {
    // Elements
    const loginForm = qs("loginForm");
    const loginId = qs("loginId");
    const loginPassword = qs("loginPassword");
    const loginMsg = qs("loginMsg");
    const logoutBtn = qs("logoutBtn");

    const openSignupBtn = qs("openSignupBtn");
    const closeSignupBtn = qs("closeSignupBtn");
    const signupOverlay = qs("signupOverlay");
    const signupSheet = qs("signupSheet");

    const signupForm = qs("signupForm");
    const signupId = qs("signupId");
    const signupPassword = qs("signupPassword");
    const signupName = qs("signupName");
    const signupPhone = qs("signupPhone");
    const signupBank = qs("signupBank");
    const signupAccount = qs("signupAccount");
    const signupMsg = qs("signupMsg");

    if (!loginForm || !openSignupBtn || !signupOverlay || !signupSheet) return;

    let isOpen = false;

    function openSignup() {
      if (isOpen) return;
      isOpen = true;

      signupOverlay.classList.add("open");
      signupSheet.classList.add("open");
      signupOverlay.setAttribute("aria-hidden", "false");
      setMsg(signupMsg, "", "");

      setTimeout(() => signupId?.focus(), 0);
    }

    function closeSignup() {
      if (!isOpen) return;
      isOpen = false;

      signupOverlay.classList.remove("open");
      signupSheet.classList.remove("open");
      signupOverlay.setAttribute("aria-hidden", "true");
      setMsg(signupMsg, "", "");

      setTimeout(() => openSignupBtn?.focus(), 0);
    }

    // Ensure single binding
    openSignupBtn.onclick = openSignup;
    if (closeSignupBtn) closeSignupBtn.onclick = closeSignup;
    signupOverlay.onclick = closeSignup;

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closeSignup();
    }, { passive: true });

    // Login
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(loginMsg, "로그인 중...", "");

      const email = (loginId?.value || "").trim();
      const password = loginPassword?.value || "";

      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");
        window.location.href = "dashboard.html";
      } catch (err) {
        setMsg(loginMsg, err?.message || "로그인 실패", "err");
      }
    });

    // Signup (6 fields -> store extra in user_metadata)
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setMsg(signupMsg, "회원가입 중...", "");

        const email = (signupId?.value || "").trim();
        const password = signupPassword?.value || "";
        const name = (signupName?.value || "").trim();
        const phone = sanitizePhone(signupPhone?.value);
        const bank = (signupBank?.value || "").trim();
        const account = (signupAccount?.value || "").trim();

        if (password.length < 6) {
          setMsg(signupMsg, "비밀번호는 6자 이상으로 설정해 주세요.", "err");
          return;
        }
        if (!email || !name || !phone || !bank || !account) {
          setMsg(signupMsg, "모든 항목을 입력해 주세요.", "err");
          return;
        }

        try {
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
              data: {
                user_id: email,      // 아이디 저장(원하면 키 변경)
                name,
                phone,
                bank,
                account,
              },
            },
          });
          if (error) throw error;

          // NOTE: 이메일 인증 옵션 여부와 무관하게, UX는 가입 완료로 처리
          setMsg(signupMsg, "회원가입 완료! 로그인해 주세요.", "ok");
          if (loginId) loginId.value = email;

          setTimeout(() => closeSignup(), 350);
        } catch (err) {
          setMsg(signupMsg, err?.message || "회원가입 실패", "err");
        }
      });
    }

    // Optional logout UI
    async function refreshSessionUI() {
      const { data } = await sb.auth.getSession();
      const isLoggedIn = !!data?.session;
      if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await sb.auth.signOut();
        setMsg(loginMsg, "로그아웃 완료", "ok");
        refreshSessionUI();
      });
    }

    sb.auth.onAuthStateChange(() => refreshSessionUI());
    refreshSessionUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
