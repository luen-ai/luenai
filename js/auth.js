/* js/auth.js (전체 교체본) - username 기반 로그인 + 가짜 이메일 + profiles 저장 */
(() => {
  if (window.__LUEN_AUTH_INIT__) return;
  window.__LUEN_AUTH_INIT__ = true;

  const SUPABASE_URL = "https://dgrcqwsjhffhfnyhazzn.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncmNxd3NqaGZmaGZueWhhenpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjE0OTYsImV4cCI6MjA4NTU5NzQ5Nn0.q3vXROnYfIfm_gjwniCM015HCR6Fts8-q8se3tNNzkE";

  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!sb) {
    console.error("Supabase SDK not loaded.");
    return;
  }

  const qs = (id) => document.getElementById(id);

  const normalizeUsername = (v) => {
    const raw = (v || "").trim().toLowerCase();
    // allow: a-z 0-9 . _ -
    const cleaned = raw.replace(/[^a-z0-9._-]/g, "_");
    return cleaned;
  };

  const usernameToEmail = (username) => `${normalizeUsername(username)}@luenai.local`;

  const setMsg = (el, text, type) => {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  };

  const onlyDigits = (v) => (v || "").replace(/[^\d]/g, "");

  const init = () => {
    // Login elements
    const loginForm = qs("loginForm");
    const loginId = qs("loginId"); // 아이디 입력(텍스트/이메일 상관없음)
    const loginPassword = qs("loginPassword");
    const loginMsg = qs("loginMsg");
    const logoutBtn = qs("logoutBtn");

    // Signup slide elements
    const openSignupBtn = qs("openSignupBtn");
    const closeSignupBtn = qs("closeSignupBtn");
    const signupOverlay = qs("signupOverlay");
    const signupSheet = qs("signupSheet");

    // Signup form fields (EMAIL 제거됨)
    const signupForm = qs("signupForm");
    const signupUsername = qs("signupUsername"); // 아이디
    const signupPassword = qs("signupPassword");
    const signupName = qs("signupName");
    const signupPhone = qs("signupPhone");
    const signupBank = qs("signupBank");
    const signupAccount = qs("signupAccount");
    const signupMsg = qs("signupMsg");

    if (!loginForm || !openSignupBtn || !signupOverlay || !signupSheet) return;

    let isOpen = false;

    const openSignup = () => {
      if (isOpen) return;
      isOpen = true;

      signupOverlay.classList.add("open");
      signupSheet.classList.add("open");
      signupOverlay.setAttribute("aria-hidden", "false");
      setMsg(signupMsg, "", "");

      setTimeout(() => signupUsername?.focus(), 0);
    };

    const closeSignup = () => {
      if (!isOpen) return;
      isOpen = false;

      signupOverlay.classList.remove("open");
      signupSheet.classList.remove("open");
      signupOverlay.setAttribute("aria-hidden", "true");
      setMsg(signupMsg, "", "");

      setTimeout(() => openSignupBtn?.focus(), 0);
    };

    // single binding (double click issue 제거)
    openSignupBtn.onclick = openSignup;
    if (closeSignupBtn) closeSignupBtn.onclick = closeSignup;
    signupOverlay.onclick = closeSignup;

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && isOpen) closeSignup();
      },
      { passive: true }
    );

    // LOGIN: 아이디 + 비밀번호 => fake email로 로그인
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(loginMsg, "로그인 중...", "");

      const username = (loginId?.value || "").trim();
      const password = loginPassword?.value || "";

      const normalized = normalizeUsername(username);
      if (!normalized) {
        setMsg(loginMsg, "아이디를 입력해 주세요.", "err");
        return;
      }
      if (!password) {
        setMsg(loginMsg, "비밀번호를 입력해 주세요.", "err");
        return;
      }

      const email = usernameToEmail(normalized);

      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");
        window.location.href = "dashboard.html";
      } catch (err) {
        setMsg(loginMsg, err?.message || "로그인 실패", "err");
      }
    });

    // SIGNUP: 6필드 => fake email 생성 + Auth + profiles 저장
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setMsg(signupMsg, "회원가입 중...", "");

        const usernameRaw = (signupUsername?.value || "").trim();
        const username = normalizeUsername(usernameRaw);

        const password = signupPassword?.value || "";
        const name = (signupName?.value || "").trim();
        const phone = (signupPhone?.value || "").trim();
        const bank = (signupBank?.value || "").trim();
        const account = (signupAccount?.value || "").trim();

        if (!username) return setMsg(signupMsg, "아이디를 입력해 주세요.", "err");
        if (password.length < 6) return setMsg(signupMsg, "비밀번호는 6자 이상으로 설정해 주세요.", "err");
        if (!name) return setMsg(signupMsg, "이름을 입력해 주세요.", "err");
        if (!phone) return setMsg(signupMsg, "전화번호를 입력해 주세요.", "err");
        if (!bank) return setMsg(signupMsg, "은행을 입력해 주세요.", "err");
        if (!account) return setMsg(signupMsg, "계좌번호를 입력해 주세요.", "err");

        const email = usernameToEmail(username);

        try {
          // 이메일 인증/확인 절차 미사용 전제(대시보드에서 Confirm email OFF)
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
              data: {
                username,
                name,
                phone,
                bank,
                account,
              },
            },
          });
          if (error) throw error;

          const userId = data?.user?.id;
          const hasSession = !!data?.session;

          if (!userId) throw new Error("회원 생성 실패: user id 없음");

          if (!hasSession) {
            // Confirm email이 켜져 있으면 session이 없을 수 있음
            throw new Error("Auth 설정에서 이메일 확인을 끄고 다시 시도해 주세요.");
          }

          // profiles insert (RLS 정책 필요)
          const { error: pErr } = await sb.from("profiles").insert({
            id: userId,
            username,
            name,
            phone,
            bank,
            account,
          });

          if (pErr) throw pErr;

          setMsg(signupMsg, "회원가입 완료! 로그인해 주세요.", "ok");

          if (loginId) loginId.value = username;
          setTimeout(() => closeSignup(), 350);
        } catch (err) {
          setMsg(signupMsg, err?.message || "회원가입 실패", "err");
        }
      });
    }

    // Optional logout UI
    const refreshSessionUI = async () => {
      const { data } = await sb.auth.getSession();
      const isLoggedIn = !!data?.session;
      if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
    };

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await sb.auth.signOut();
        setMsg(loginMsg, "로그아웃 완료", "ok");
        refreshSessionUI();
      });
    }

    sb.auth.onAuthStateChange(() => refreshSessionUI());
    refreshSessionUI();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
