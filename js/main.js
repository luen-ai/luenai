/* js/main.js (전체 교체본)
   핵심 수정:
   - 비밀번호 최소 길이: 서버 기본값(GoTrue) 6에 맞춰 "6"으로 완전 통일 (프론트/UI/메시지)
     * GoTrue 기본 최소 길이 6 (환경설정으로 변경 가능) :contentReference[oaicite:0]{index=0}
   - 429 무한 반복 방지:
     * 1클릭 1요청(onsubmit 단일 바인딩 + inFlight 가드)
     * 429일 때만 쿨다운, 추가 요청 절대 없음
     * 429 재발 시 쿨다운을 10→30→60초로 자동 증가(서버 윈도우가 60초인 케이스 대응) :contentReference[oaicite:1]{index=1}
   - 실패 원인 분리:
     * password too short / rate limit / username duplicate / 기타
     * 상세 에러는 console에만 출력
     * 화면에는 email 관련 단어/주소 절대 노출 금지
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

  // ===== 정책(서버/프론트/UI 통일) =====
  // Supabase(GoTrue) 기본 최소 길이 6 → 여기서도 6으로 고정
  const MIN_PASSWORD_LEN = 6;

  // 랜덤 이메일(내부용) - 사용자에게 절대 노출 금지
  const FAKE_DOMAIN = "luenai.app";
  const safeUUID = () => {
    try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch (_) {}
    const r = () => Math.random().toString(16).slice(2);
    return `${Date.now().toString(16)}-${r()}-${r()}-${r()}`;
  };
  const makeRandomEmail = () => `${safeUUID()}@${FAKE_DOMAIN}`;

  // username: 숫자-only 허용, 영문/숫자/_ 허용, 공백 금지
  const normalizeUsername = (v) => (v ?? "").toString().trim();
  const isValidUsername = (u) => {
    if (!u) return false;
    if (/\s/.test(u)) return false;
    if (!/^[A-Za-z0-9_]+$/.test(u)) return false;
    return true;
  };

  // password: 앞/뒤 공백 제거 후 길이 체크
  const normalizePassword = (v) => (v ?? "").toString().trim();

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

    const textEl = btn.querySelector(".btn-text");
    if (textEl) {
      if (!btn.dataset.prevText) btn.dataset.prevText = textEl.textContent;
      textEl.textContent = busy ? busyText : btn.dataset.prevText;
    } else {
      if (!btn.dataset.prevText) btn.dataset.prevText = btn.textContent;
      btn.textContent = busy ? busyText : btn.dataset.prevText;
    }
  };

  const isRateLimit = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const status = err?.status;
    return status === 429 || msg.includes("rate limit") || msg.includes("too many requests");
  };

  // ===== 화면 메시지(이메일 단어/주소 절대 금지) =====
  const mapSignupError = (err) => {
    const msg = String(err?.message || "").toLowerCase();
    const code = String(err?.code || "").toLowerCase();

    // profiles.username UNIQUE 위반
    if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
      return "이미 사용 중인 아이디입니다";
    }

    // 비밀번호 정책 위반
    if (
      code.includes("weak_password") ||
      (msg.includes("password") && (msg.includes("short") || msg.includes("at least") || msg.includes("weak") || msg.includes("length")))
    ) {
      return `비밀번호는 ${MIN_PASSWORD_LEN}자 이상이어야 합니다`;
    }

    if (isRateLimit(err)) {
      return "요청이 많습니다. 잠시 후 다시 시도해주세요";
    }

    // email 관련 문구는 전부 일반화
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

  // 429 쿨다운: 10초 시작, 재발 시 30→60으로 증가 (백그라운드 요청 없음)
  const makeCooldownController = () => {
    let lastWindow = 10;
    let timer = null;

    const start = (btn, msgEl) => {
      // 쿨다운 중이면 무시
      if (timer) return;

      let left = lastWindow;
      // 다음 429 대비 윈도우 증가(10→30→60)
      lastWindow = Math.min(lastWindow === 10 ? 30 : 60, 60);

      setBusy(btn, true, `잠시만요 (${left}s)`);
      setMsg(msgEl, `요청이 많습니다. ${left}초 후 다시 시도해주세요`, "err");

      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          timer = null;
          setBusy(btn, false);
          setMsg(msgEl, "다시 시도할 수 있습니다.", "");
          return;
        }
        setBusy(btn, true, `잠시만요 (${left}s)`);
        setMsg(msgEl, `요청이 많습니다. ${left}초 후 다시 시도해주세요`, "err");
      }, 1000);
    };

    const resetBackoff = () => { lastWindow = 10; };

    return { start, resetBackoff };
  };

  const signupCooldown = makeCooldownController();

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

    // ===== 이벤트 중복 방지: on*로 단일 바인딩 (이전 addEventListener 흔적 제거 효과) =====
    // open/close
    let isOpen = false;
    openSignupBtn.onclick = () => {
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

    if (closeSignupBtn) closeSignupBtn.onclick = closeSignup;
    signupOverlay.onclick = closeSignup;

    document.onkeydown = (e) => {
      if (e.key === "Escape" && isOpen) closeSignup();
    };

    // ===== 1클릭 1요청 가드 =====
    let loginInFlight = false;
    let signupInFlight = false;

    // LOGIN
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      if (loginInFlight) return;
      loginInFlight = true;

      setMsg(loginMsg, "로그인 중...", "");
      setBusy(loginBtn, true);

      const username = normalizeUsername(loginUsername?.value);
      const password = normalizePassword(loginPassword?.value || "");

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
        // username -> auth_email 조회 RPC (필수)
        const { data: email, error: rErr } = await sb.rpc("auth_email_for_username", { p_username: username });
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
    };

    // SIGNUP
    signupForm.onsubmit = async (e) => {
      e.preventDefault();

      // 쿨다운/비활성 중이면 요청 금지
      if (signupBtn.disabled) return;

      if (signupInFlight) return;
      signupInFlight = true;

      setMsg(signupMsg, "회원가입 중...", "");
      setBusy(signupBtn, true);

      const username = normalizeUsername(signupUsername?.value);
      const password = normalizePassword(signupPassword?.value || "");

      const name = (signupName?.value || "").trim();
      const phone = (signupPhone?.value || "").trim();
      const bank = (signupBank?.value || "").trim();
      const account = (signupAccount?.value || "").trim();

      // 프론트 검증(정확)
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
        // Auth 계정 생성
        const { data, error } = await sb.auth.signUp({
          email: authEmail,
          password,
          options: { data: { username } },
        });
        if (error) throw error;

        // Confirm email ON이면 여기서 세션이 없을 수 있음 → 가입 완료 처리가 막힘
        // (이 경우도 email 단어 없이 안내)
        if (!data?.session || !data?.user?.id) {
          console.warn("[luenAI][signup] no session after signUp. Check Auth confirm settings.");
          throw { status: 422, message: "no_session" };
        }

        const userId = data.user.id;

        // profiles insert (username UNIQUE)
        const { error: pErr } = await sb.from("profiles").insert({
          id: userId,
          username,
          name,
          phone,
          bank,
          account,
          auth_email: authEmail, // 로그인 매핑용(노출 금지)
        });

        if (pErr) {
          console.error("[luenAI][signup] profiles insert error:", pErr);
          await tryRollbackUser();
          throw pErr;
        }

        signupCooldown.resetBackoff();
        setMsg(signupMsg, "회원가입 완료! 로그인해 주세요.", "ok");
        if (loginUsername) loginUsername.value = username;

        setTimeout(() => closeSignup(), 350);
      } catch (err) {
        console.error("[luenAI][signup] error:", err);

        // 429만 쿨다운(백그라운드 요청 없음)
        if (isRateLimit(err)) {
          signupCooldown.start(signupBtn, signupMsg);
        } else if (String(err?.message || "") === "no_session") {
          // 실제 원인 분리(이메일 단어 금지)
          setMsg(signupMsg, "가입 설정을 확인해주세요. 관리자에게 문의해주세요.", "err");
          setBusy(signupBtn, false);
        } else {
          setMsg(signupMsg, mapSignupError(err), "err");
          setBusy(signupBtn, false);
        }
      } finally {
        signupInFlight = false;
        // 쿨다운이 걸리지 않은 경우에만 확실히 해제
        if (!isRateLimit({ status: 429 }) && !signupBtn.disabled) setBusy(signupBtn, false);
        // 위 줄은 안전장치로 남기되, 실제로는 catch에서 처리
      }
    };

    // logout
    const refreshSessionUI = async () => {
      const { data } = await sb.auth.getSession();
      const isLoggedIn = !!data?.session;
      if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
    };

    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await sb.auth.signOut();
        setMsg(loginMsg, "로그아웃 완료", "ok");
        refreshSessionUI();
      };
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
