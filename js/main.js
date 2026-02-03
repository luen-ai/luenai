/* js/main.js - index 전용: Login + Signup Slide + Supabase Auth */
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

  const loginForm = $("loginForm");
  const loginId = $("loginId");
  const loginPassword = $("loginPassword");
  const loginMsg = $("loginMsg");

  const openSignupBtn = $("openSignupBtn");
  const closeSignupBtn = $("closeSignupBtn");
  const signupOverlay = $("signupOverlay");
  const signupSheet = $("signupSheet");

  const signupForm = $("signupForm");
  const signupId = $("signupId");
  const signupPassword = $("signupPassword");
  const signupName = $("signupName");
  const signupPhone = $("signupPhone");
  const signupBank = $("signupBank");
  const signupAccount = $("signupAccount");
  const signupMsg = $("signupMsg");

  function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  }

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

  // single binding
  if (openSignupBtn) openSignupBtn.onclick = openSignup;
  if (closeSignupBtn) closeSignupBtn.onclick = closeSignup;
  if (signupOverlay) signupOverlay.onclick = closeSignup;

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && isOpen) closeSignup();
    },
    { passive: true }
  );

  // Login
  if (loginForm) {
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
  }

  // Signup (6 fields -> user_metadata)
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg(signupMsg, "회원가입 중...", "");

      const email = (signupId?.value || "").trim();
      const password = signupPassword?.value || "";
      const name = (signupName?.value || "").trim();
      const phone = (signupPhone?.value || "").trim();
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
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              user_id: email,
              name,
              phone,
              bank,
              account,
            },
          },
        });
        if (error) throw error;

        setMsg(signupMsg, "회원가입 완료! 로그인해 주세요.", "ok");
        if (loginId) loginId.value = email;

        setTimeout(() => closeSignup(), 350);
      } catch (err) {
        setMsg(signupMsg, err?.message || "회원가입 실패", "err");
      }
    });
  }
})();
