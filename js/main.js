/* js/main.js (전체 교체본)
   - 비밀번호 최소 길이 4 통일(앞/뒤 공백 trim 후 길이 체크)
   - Supabase 에러는 콘솔로만 상세 출력, 화면은 한국어 메시지 매핑
   - 429(rate limit)일 때만 10초 쿨다운 카운트다운 후 자동 재활성화
   - 이메일/주소/단어는 사용자 화면에 절대 노출 금지
*/
(() => {
  if (window.__LUEN_INDEX_INIT__) return;
  window.__LUEN_INDEX_INIT__ = true;

  const SUPABASE_URL = "https://dgrcqwsjhffhfnyhazzn.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncmNxd3NqaGZmaGZueWhhenpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjE0OTYsImV4cCI6MjA4NTU5NzQ5Nn0.q3vXROnYfIfm_gjwniCM015HCR6Fts8-q8se3tNNzkE";

  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!sb) {
    console.error("[luenAI] Supabase SDK not loaded.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  // ===== 확정 정책 =====
  const MIN_PASSWORD_LEN = 4;
  const FAKE_DOMAIN = "luenai.app"; // 내부용(사용자 노출 금지)

  // username: 숫자-only 허용, 영문/숫자/_ 허용, 공백 금지
  const normalizeUsername = (v) => (v ?? "").toString().trim();
  const isValidUsername = (u) => {
    if (!u) return false;
    if (/\s/.test(u)) return false;          // 공백 금지
    if (!/^[A-Za-z0-9_]+$/.test(u)) return false; // 영문/숫자/_ 만
    return true;
  };

  // password: 앞/뒤 공백 제거 후 길이 체크 (4자 이상)
  const normalizePassword = (v) => (v ?? "").toString().trim();
  const isValidPassword = (p) => normalizePassword(p).length >= MIN_PASSWORD_LEN;

  const safeUUID = () => {
    try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch (_) {}
    // fallback
    const r = () => Math.random().toString(16).slice(2);
    return `${Date.now().toString(16)}-${r()}-${r()}-${r()}`;
  };

  // username@도메인 방식 폐기 → 랜덤 이메일
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
    btn.classList.toggle("is-busy", !!busy);
    if (!btn.dataset.prevText) btn.dataset.prevText = btn.querySelector(".btn-text")?.textContent || btn.textContent;
    const t = btn.querySelector(".btn-text");
    if (t) t.textContent = busy ? busyText : btn.dataset.prevText;
    else btn.textContent = busy ? busyText : btn.dataset.prevText;
  };

  const isRateLimit = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const status = err?.status;
    return status === 429 || msg.includes("rate limit") || msg.includes("too many requests");
  };

  // 화면용 메시지(이메일 관련 단어 절대 금지)
  const mapSignupError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const code = String(err?.code || "").toLowerCase();

    // profiles.username UNIQUE 위반
    if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
      return "이미 사용 중인 아이디입니다";
    }

    // 서버 비밀번호 정책 불일치/짧음/weak password 등
    if (
      code.includes("weak_password") ||
      (msg.includes("password") && (msg.includes("short") || msg.includes("at least") || msg.includes("weak") || msg.includes("length")))
    ) {
      return `비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 합니다`;
    }

    if (isRateLimit(err)) {
      return "요청이 많습니다. 잠시 후 다시 시도해주세요";
    }

    // 이메일 관련 문구는 절대 노출 금지 → 일반화
    if (msg.includes("email") || msg.includes("address")) {
      return "가입에 실패했습니다. 잠시 후 다시 시도해주세요";
    }

    return "가입에 실패했습니다. 잠시 후 다시 시도해주세요";
  };

  const mapLoginError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    if (isRateLimit(err)) return "요청이 많습니다. 잠시 후 다시 시도해주세요";
    if (msg.includes("invalid login credentials")) return "아이디 또는 비밀번호를 확인해주세요";
    if (msg.includes("email")) return "아이디 또는 비밀번호를 확인해주세요";
    return "잠시 후 다시 시도해주세요";
  };

  // 429 쿨다운(가입 버튼만)
  const startCooldown = (btn, msgEl, seconds = 10) => {
    let left = seconds;
    setBusy(btn, true, `잠시만요 (${left}s)`);
    setMsg(msgEl, `요청이 많습니다. ${left}초 후 다시 시도해주세요`, "err");

    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        setBusy(btn, false);
        setMsg(msgEl, "다시 시도할 수 있습니다.", "");
        return;
      }
      setBusy(btn, true, `잠시만요 (${left}s)`);
      setMsg(msgEl, `요청이 많습니다. ${left}초 후 다시 시도해주세요`, "err");
    }, 1000);
  };

  // 가입 실패 시 정리(가능하면)
  const tryRollbackUser = async () => {
    try { await sb.rpc("delete_user_self"); } catch (_) {}
    try { await sb.auth.signOut(); } catch (_) {}
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
    let signupInFlight = false;
    let loginInFlight = false;

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

    // 1클릭 즉시 오픈
    openSignupBtn.onclick = openSignup;
    if (closeSignupBtn) closeSignupBtn.onclick = closeSignup;
    signupOverlay.onclick = closeSignup;

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closeSignup();
    }, { passive: true });

    // ===== LOGIN =====
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginInFlight) return; // 연타 방지
      loginInFlight = true;

      setMsg(loginMsg, "로그인 중...", "");
      setBusy(loginBtn, true);

      const username = normalizeUsername(loginUsername?.value);
      const passwordRaw = loginPassword?.value || "";
      const password = normalizePassword(passwordRaw);

      if (!isValidUsername(username)) {
        setBusy(loginBtn, false);
        setMsg(loginMsg, "아이디 형식을 확인해주세요", "err");
        loginInFlight = false;
        return;
      }
      if (password.length < MIN_PASSWORD_LEN) {
        setBusy(loginBtn, false);
        setMsg(loginMsg, `비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 합니다`, "err");
        loginInFlight = false;
        return;
      }

      try {
        // RPC: auth_email_for_username(p_username) -> text (필수)
        const { data: email, error: rErr } = await sb.rpc("auth_email_for_username", {
          p_username: username,
        });

        if (rErr || !email) {
          console.warn("[luenAI][login] username lookup failed:", rErr);
          throw new Error("invalid");
        }

        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");
        window.location.href = "dashboard.html";
      } catch (err) {
        console.error("[luenAI][login] error:", err);
        setMsg(loginMsg, mapLoginError(err), "err");
      } finally {
        setBusy(loginBtn, false);
        loginInFlight = false;
      }
    });

    // ===== SIGNUP =====
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (signupInFlight) return; // 더블클릭/연타 방지
      signupInFlight = true;

      setMsg(signupMsg, "회원가입 중...", "");
      setBusy(signupBtn, true);

      const username = normalizeUsername(signupUsername?.value);
      const passwordRaw = signupPassword?.value || "";
      const password = normalizePassword(passwordRaw);

      const name = (signupName?.value || "").trim();
      const phone = (signupPhone?.value || "").trim();
      const bank = (signupBank?.value || "").trim();
      const account = (signupAccount?.value || "").trim();

      // 1) 프론트 검증(정확)
      if (!isValidUsername(username)) {
        setBusy(signupBtn, false);
        setMsg(signupMsg, "아이디 형식을 확인해주세요", "err");
        signupInFlight = false;
        return;
      }

      if (password.length < MIN_PASSWORD_LEN) {
        setBusy(signupBtn, false);
        setMsg(signupMsg, `비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 합니다`, "err");
        signupInFlight = false;
        return;
      }

      if (!name || !phone || !bank || !account) {
        setBusy(signupBtn, false);
        setMsg(signupMsg, "모든 항목을 입력해 주세요.", "err");
        signupInFlight = false;
        return;
      }

      const authEmail = makeRandomEmail(); // 내부용(절대 노출 금지)

      try {
        // 2) Auth 계정 생성
        const { data, error } = await sb.auth.signUp({
          email: authEmail,
          password,
          options: { data: { username } },
        });

        if (error) throw error;

        // Confirm email OFF 여야 session이 생김 (profiles insert를 본인 id로)
        if (!data?.session || !data?.user?.id) {
          console.warn("[luenAI][signup] no session/user after signUp. Check Confirm Email setting.");
          throw new Error("no_session");
        }

        const userId = data.user.id;

        // 3) profiles insert (username UNIQUE로 중복 판정)
        const { error: pErr } = await sb.from("profiles").insert({
          id: userId,
          username,
          name,
          phone,
          bank,
          account,
          auth_email: authEmail, // 로그인 매핑용(사용자 노출 금지)
        });

        if (pErr) {
          console.error("[luenAI][signup] profiles insert error:", pErr);
          await tryRollbackUser();
          throw pErr;
        }

        setMsg(signupMsg, "회원가입 완료! 로그인해 주세요.", "ok");
        if (loginUsername) loginUsername.value = username;

        setTimeout(() => closeSignup(), 350);
      } catch (err) {
        console.error("[luenAI][signup] error:", err);

        // 429이면 쿨다운 적용
        if (isRateLimit(err)) {
          startCooldown(signupBtn, signupMsg, 10);
        } else {
          // 내부 원인(no_session 포함)은 사용자 메시지로 정확히
          const raw = String(err?.message || "");
          if (raw === "no_session") {
            setMsg(signupMsg, "가입에 실패했습니다. 잠시 후 다시 시도해주세요", "err");
          } else {
            setMsg(signupMsg, mapSignupError(err), "err");
          }
          setBusy(signupBtn, false);
        }
      } finally {
        // 쿨다운이 아닌 경우에만 즉시 해제 (쿨다운은 자체 해제)
        if (!signupBtn.disabled || !signupBtn.classList.contains("is-busy")) {
          // noop (unlikely)
        }
        // inFlight 해제는 항상 즉시
        signupInFlight = false;
        // 쿨다운 걸린 경우는 버튼이 disabled 상태로 유지됨(타이머가 해제)
        if (!signupBtn.disabled) setBusy(signupBtn, false);
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
