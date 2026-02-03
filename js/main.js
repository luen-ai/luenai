/* js/main.js - index용 Supabase Auth (username 기반, fake email, profiles 저장) */
(() => {
  if (window.__LUEN_INDEX_INIT__) return;
  window.__LUEN_INDEX_INIT__ = true;

  const SUPABASE_URL = "https://dgrcqwsjhffhfnyhazzn.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncmNxd3NqaGZmaGZueWhhenpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjE0OTYsImV4cCI6MjA4NTU5NzQ5Nn0.q3vXROnYfIfm_gjwniCM015HCR6Fts8-q8se3tNNzkE";

  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!sb) {
    console.error("Supabase SDK not loaded.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  // username -> fake email
  const normalizeUsername = (v) => {
    const raw = (v || "").trim().toLowerCase();
    // allowed: a-z 0-9 . _ -
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

  const init = () => {
    // login
    const loginForm = $("loginForm");
    const loginUsername = $("loginUsername");
    const loginPassword = $("loginPassword");
    const loginMsg = $("loginMsg");
    const logoutBtn = $("logoutBtn");

    // signup slide
    const openSignupBtn = $("openSignupBtn");
    const closeSignupBtn = $("closeSignupBtn");
    const signupOverlay = $("signupOverlay");
    const signupSheet = $("signupSheet");

    // signup fields (6)
    const signupForm = $("signupForm");
    const signupUsername = $("signupUsername");
    const signupPassword = $("signupPassword");
    const signupName = $("signupName");
    const signupPhone = $("signupPhone");
    const signupBank = $("signupBank");
    const signupAccount = $("signupAccount");
    const signupMsg = $("signupMsg");

    if (!loginForm || !openSignupBtn || !signupOverlay || !signupSheet || !signupForm) return;

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

    // 목표 A: 1번 클릭 즉시 오픈 (중복 이벤트 방지)
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

    // LOGIN (username + password)
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(loginMsg, "로그인 중...", "");

      const usernameRaw = (loginUsername?.value || "").trim();
      const username = normalizeUsername(usernameRaw);
      const password = loginPassword?.value || "";

      if (!username) return setMsg(loginMsg, "아이디를 입력해 주세요.", "err");
      if (!password) return setMsg(loginMsg, "비밀번호를 입력해 주세요.", "err");

      const email = usernameToEmail(username);

      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");
        window.location.href = "dashboard.html";
      } catch (err) {
        setMsg(loginMsg, err?.message || "로그인 실패", "err");
      }
    });

    // SIGNUP (6 fields -> fake email -> Auth -> profiles insert)
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
        // 목표 D: fake email로 Auth 가입
        // 목표 E: 가입 성공 후 profiles 저장
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { username }, // 필요시 metadata
          },
        });
        if (error) throw error;

        // 목표 F(5): 이메일 인증/확인 절차 미사용 => 반드시 Confirm Email OFF여야 session이 생김
        if (!data?.session || !data?.user?.id) {
          throw new Error("Supabase Auth 설정에서 'Confirm email'을 OFF로 설정해 주세요.");
        }

        const userId = data.user.id;

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

        // 로그인 입력란에 아이디 채움
        if (loginUsername) loginUsername.value = username;

        setTimeout(() => closeSignup(), 350);
      } catch (err) {
        setMsg(signupMsg, err?.message || "회원가입 실패", "err");
      }
    });

    // Optional logout button visibility
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
