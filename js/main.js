/* js/main.js (전체 교체본) - username 기반 가입/로그인 + 랜덤 이메일 + 에러 매핑(이메일 노출 금지)
   전제(필수):
   - DB에 RPC 함수 auth_email_for_username(username) 생성 (하단 SQL 참고)
   - profiles 테이블에 auth_email 컬럼 추가 (하단 SQL 참고)
   - Supabase Auth 설정: Confirm email OFF, Password 최소 길이 4로 설정 권장
*/
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

  const FAKE_DOMAIN = "luenai.app";

  // ===== 정책(확정) =====
  // username: 숫자-only 허용, 영문/숫자/_ 허용, 공백 금지
  const normalizeUsername = (v) => (v || "").trim();
  const isValidUsername = (u) => {
    if (!u) return false;
    if (/\s/.test(u)) return false;               // 공백 금지
    if (!/^[A-Za-z0-9_]+$/.test(u)) return false; // 영문/숫자/_ 만
    return true;
  };

  // password: 최소 4자
  const isValidPassword = (p) => (p || "").length >= 4;

  const safeUUID = () => {
    try {
      if (crypto?.randomUUID) return crypto.randomUUID();
    } catch (_) {}
    // fallback
    const r = () => Math.random().toString(16).slice(2);
    return `${Date.now().toString(16)}-${r()}-${r()}-${r()}`;
  };

  const makeRandomEmail = () => `${safeUUID()}@${FAKE_DOMAIN}`;

  const setMsg = (el, text, type) => {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  };

  const setBusy = (btn, busy, busyText = "처리 중...") => {
    if (!btn) return;
    btn.disabled = !!busy;
    if (!btn.dataset.prevText) btn.dataset.prevText = btn.textContent;
    btn.textContent = busy ? busyText : btn.dataset.prevText;
  };

  // ===== 에러 메시지 매핑(이메일/주소/단어 노출 금지) =====
  const mapSignupError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const code = String(err?.code || "").toLowerCase();
    const status = err?.status;

    // username 중복 (profiles.username UNIQUE) - Postgres unique_violation
    if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
      return "이미 사용 중인 아이디입니다";
    }

    // password 짧음
    if (
      code.includes("weak_password") ||
      (msg.includes("password") && (msg.includes("short") || msg.includes("at least") || msg.includes("weak")))
    ) {
      return "비밀번호는 4자 이상이어야 합니다";
    }

    // rate limit
    if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
      return "요청이 많습니다. 잠시 후 다시 시도해주세요";
    }

    // 어떠한 경우에도 email 관련 문구 노출 금지 → 전부 일반화
    if (msg.includes("email")) {
      // 사용자가 이메일을 몰라야 하므로 무조건 일반 문구
      return "가입에 실패했습니다. 잠시 후 다시 시도해주세요";
    }

    return "가입에 실패했습니다. 잠시 후 다시 시도해주세요";
  };

  const mapLoginError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const status = err?.status;

    if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
      return "요청이 많습니다. 잠시 후 다시 시도해주세요";
    }

    // 로그인 실패는 단순화
    if (msg.includes("invalid login credentials")) {
      return "아이디 또는 비밀번호를 확인해주세요";
    }

    if (msg.includes("email")) {
      return "아이디 또는 비밀번호를 확인해주세요";
    }

    return "잠시 후 다시 시도해주세요";
  };

  // ===== 가입 실패 시 Auth 계정 정리(가능하면) =====
  // anon으로 auth.users 삭제는 불가 → (선택) RPC delete_user_self() 제공 시 호출
  const tryRollbackUser = async () => {
    try {
      // optional RPC: public.delete_user_self()
      await sb.rpc("delete_user_self");
    } catch (_) {
      // ignore
    }
    try {
      await sb.auth.signOut();
    } catch (_) {
      // ignore
    }
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

    // 1클릭 즉시 오픈 (중복 방지)
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

    // ===== LOGIN: username + password =====
    // 랜덤 이메일이므로 username→auth_email 매핑 RPC 필요
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(loginMsg, "로그인 중...", "");
      setBusy(loginBtn, true);

      const usernameRaw = normalizeUsername(loginUsername?.value);
      const password = loginPassword?.value || "";

      if (!isValidUsername(usernameRaw)) {
        setBusy(loginBtn, false);
        return setMsg(loginMsg, "아이디 형식을 확인해주세요", "err");
      }
      if (!isValidPassword(password)) {
        setBusy(loginBtn, false);
        return setMsg(loginMsg, "비밀번호는 4자 이상이어야 합니다", "err");
      }

      try {
        // RPC: auth_email_for_username(p_username) -> text
        const { data: email, error: rErr } = await sb.rpc("auth_email_for_username", {
          p_username: usernameRaw,
        });

        if (rErr || !email) {
          // username 미존재 포함
          throw new Error("invalid");
        }

        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");
        window.location.href = "dashboard.html";
      } catch (err) {
        // invalid는 통합 메시지
        setMsg(loginMsg, "아이디 또는 비밀번호를 확인해주세요", "err");
      } finally {
        setBusy(loginBtn, false);
      }
    });

    // ===== SIGNUP: 6 fields =====
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(signupMsg, "회원가입 중...", "");
      setBusy(signupBtn, true);

      const usernameRaw = normalizeUsername(signupUsername?.value);
      const password = signupPassword?.value || "";
      const name = (signupName?.value || "").trim();
      const phone = (signupPhone?.value || "").trim();
      const bank = (signupBank?.value || "").trim();
      const account = (signupAccount?.value || "").trim();

      if (!isValidUsername(usernameRaw)) {
        setBusy(signupBtn, false);
        return setMsg(signupMsg, "아이디 형식을 확인해주세요", "err");
      }
      if (!isValidPassword(password)) {
        setBusy(signupBtn, false);
        return setMsg(signupMsg, "비밀번호는 4자 이상이어야 합니다", "err");
      }
      if (!name || !phone || !bank || !account) {
        setBusy(signupBtn, false);
        return setMsg(signupMsg, "모든 항목을 입력해 주세요.", "err");
      }

      const authEmail = makeRandomEmail();

      try {
        // 1) Auth 계정 생성(랜덤 이메일) - 사용자에게 절대 노출 금지
        const { data, error } = await sb.auth.signUp({
          email: authEmail,
          password,
          options: { data: { username: usernameRaw } },
        });
        if (error) throw error;

        // Confirm email OFF 여야 session이 생김 (프로필 insert 위해)
        if (!data?.session || !data?.user?.id) {
          // email 언급 금지
          throw new Error("no_session");
        }

        const userId = data.user.id;

        // 2) profiles insert (UNIQUE(username)로 중복 판정)
        const { error: pErr } = await sb.from("profiles").insert({
          id: userId,
          username: usernameRaw,
          name,
          phone,
          bank,
          account,
          auth_email: authEmail, // 로그인 매핑용(사용자에게 노출 금지)
        });

        if (pErr) {
          // 3) 실패 시 가능한 롤백 시도
          await tryRollbackUser();
          throw pErr;
        }

        setMsg(signupMsg, "회원가입 완료! 로그인해 주세요.", "ok");
        if (loginUsername) loginUsername.value = usernameRaw;

        setTimeout(() => closeSignup(), 350);
      } catch (err) {
        // no_session 등 내부 사유도 사용자 메시지로 정리
        const m =
          String(err?.message || "") === "no_session"
            ? "가입에 실패했습니다. 잠시 후 다시 시도해주세요"
            : mapSignupError(err);

        setMsg(signupMsg, m, "err");
      } finally {
        setBusy(signupBtn, false);
      }
    });

    // optional logout visibility
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
