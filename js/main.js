/* js/main.js (전체 교체본) - 이메일 노출 금지 + 에러 매핑 + fake email @luenai.app */
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

  // username -> fake email (valid domain)
  const FAKE_DOMAIN = "luenai.app";

  const normalizeUsername = (v) => {
    const raw = (v || "").trim().toLowerCase();
    // allow: a-z 0-9 . _ -
    const cleaned = raw.replace(/[^a-z0-9._-]/g, "_");
    return cleaned;
  };

  const isLikelyInvalidUsername = (u) => {
    // very loose: must start with alnum, length 3~24, avoid consecutive dots
    if (!u) return true;
    if (u.length < 3 || u.length > 24) return true;
    if (!/^[a-z0-9]/.test(u)) return true;
    if (!/[a-z0-9]$/.test(u)) return true;
    if (u.includes("..")) return true;
    return false;
  };

  const usernameToEmail = (username) => `${normalizeUsername(username)}@${FAKE_DOMAIN}`;

  const setMsg = (el, text, type) => {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  };

  const setBusy = (btn, busy) => {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.dataset.prevText = btn.dataset.prevText || btn.textContent;
    btn.textContent = busy ? "처리 중..." : btn.dataset.prevText;
  };

  // NEVER show raw errors. Map to user-safe messages (NO 'email' word)
  const mapAuthError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const code = String(err?.code || "").toLowerCase();
    const status = err?.status;

    // invalid "email" / invalid address
    if (
      msg.includes("invalid") && (msg.includes("email") || msg.includes("address")) ||
      code.includes("email") ||
      msg.includes("email address") ||
      msg.includes("invalid login credentials") && msg.includes("email")
    ) {
      return "아이디 형식을 확인해주세요";
    }

    // already registered / user exists
    if (
      msg.includes("already registered") ||
      msg.includes("user already registered") ||
      msg.includes("duplicate") ||
      msg.includes("already exists") ||
      msg.includes("email already") ||
      code.includes("user_already_exists")
    ) {
      return "이미 사용 중인 아이디입니다";
    }

    // weak password
    if (
      msg.includes("password") && (msg.includes("weak") || msg.includes("short") || msg.includes("at least")) ||
      code.includes("weak_password")
    ) {
      return "비밀번호를 더 강하게 설정해주세요";
    }

    // rate limit / too many requests / network
    if (
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("timeout") ||
      msg.includes("too many requests") ||
      msg.includes("rate limit") ||
      status === 429
    ) {
      return "잠시 후 다시 시도해주세요";
    }

    // default
    return "잠시 후 다시 시도해주세요";
  };

  const init = () => {
    // login
    const loginForm = $("loginForm");
    const loginUsername = $("loginUsername");
    const loginPassword = $("loginPassword");
    const loginMsg = $("loginMsg");
    const loginBtn = $("loginBtn");
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
    const signupBtn = $("signupBtn");

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

    // 1클릭 즉시 오픈 + 중복 이벤트 방지
    openSignupBtn.onclick = openSignup;
    closeSignupBtn && (closeSignupBtn.onclick = closeSignup);
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
      setBusy(loginBtn, true);

      const usernameRaw = (loginUsername?.value || "").trim();
      const username = normalizeUsername(usernameRaw);
      const password = loginPassword?.value || "";

      if (!username || isLikelyInvalidUsername(username)) {
        setBusy(loginBtn, false);
        return setMsg(loginMsg, "아이디 형식을 확인해주세요", "err");
      }
      if (!password) {
        setBusy(loginBtn, false);
        return setMsg(loginMsg, "비밀번호를 입력해 주세요.", "err");
      }

      const email = usernameToEmail(username);

      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");
        window.location.href = "dashboard.html";
      } catch (err) {
        // 로그인 에러는 "아이디/비번 확인"으로 단순화 (email 노출 금지)
        const raw = String(err?.message || "").toLowerCase();
        if (raw.includes("invalid login credentials")) {
          setMsg(loginMsg, "아이디 또는 비밀번호를 확인해주세요", "err");
        } else {
          setMsg(loginMsg, mapAuthError(err), "err");
        }
      } finally {
        setBusy(loginBtn, false);
      }
    });

    // SIGNUP (6 fields -> fake email -> Auth -> profiles insert)
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(signupMsg, "회원가입 중...", "");
      setBusy(signupBtn, true);

      const usernameRaw = (signupUsername?.value || "").trim();
      const username = normalizeUsername(usernameRaw);
      const password = signupPassword?.value || "";
      const name = (signupName?.value || "").trim();
      const phone = (signupPhone?.value || "").trim();
      const bank = (signupBank?.value || "").trim();
      const account = (signupAccount?.value || "").trim();

      if (!username || isLikelyInvalidUsername(username)) {
        setBusy(signupBtn, false);
        return setMsg(signupMsg, "아이디 형식을 확인해주세요", "err");
      }
      if (password.length < 6) {
        setBusy(signupBtn, false);
        return setMsg(signupMsg, "비밀번호를 더 강하게 설정해주세요", "err");
      }
      if (!name || !phone || !bank || !account) {
        setBusy(signupBtn, false);
        return setMsg(signupMsg, "모든 항목을 입력해 주세요.", "err");
      }

      // internal-only
      const email = usernameToEmail(username);

      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { username }, // metadata
          },
        });
        if (error) throw error;

        // 이메일 확인 절차 미사용(Confirm Email OFF 필요)
        if (!data?.session || !data?.user?.id) {
          // 사용자에게는 email 언급 금지
          throw new Error("잠시 후 다시 시도해주세요");
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

        // 로그인 입력란에 아이디 자동 채움
        if (loginUsername) loginUsername.value = username;

        setTimeout(() => closeSignup(), 350);
      } catch (err) {
        setMsg(signupMsg, mapAuthError(err), "err");
      } finally {
        setBusy(signupBtn, false);
      }
    });

    // Optional logout visibility
    const refreshSessionUI = async () => {
      const { data } = await sb.auth.getSession();
      const isLoggedIn = !!data?.session;
      if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
    };

    logoutBtn?.addEventListener("click", async () => {
      await sb.auth.signOut();
      setMsg(loginMsg, "로그아웃 완료", "ok");
      refreshSessionUI();
    });

    sb.auth.onAuthStateChange(() => refreshSessionUI());
    refreshSessionUI();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
