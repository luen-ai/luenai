/* js/auth.js - Supabase Auth (Login/Signup) */

const SUPABASE_URL = "https://dgrcqwsjhffhfnyhazzn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncmNxd3NqaGZmaGZueWhhenpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjE0OTYsImV4cCI6MjA4NTU5NzQ5Nn0.q3vXROnYfIfm_gjwniCM015HCR6Fts8-q8se3tNNzkE";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elements
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMsg = document.getElementById("loginMsg");

const openSignupBtn = document.getElementById("openSignupBtn");
const closeSignupBtn = document.getElementById("closeSignupBtn");
const signupPanel = document.getElementById("signupPanel");

const signupForm = document.getElementById("signupForm");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupPassword2 = document.getElementById("signupPassword2");
const signupMsg = document.getElementById("signupMsg");

const logoutBtn = document.getElementById("logoutBtn");

function setMsg(el, text, type) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("ok", "err");
  if (type === "ok") el.classList.add("ok");
  if (type === "err") el.classList.add("err");
}

function openSignup() {
  signupPanel?.classList.add("open");
  setMsg(signupMsg, "", "");
}

function closeSignup() {
  signupPanel?.classList.remove("open");
  setMsg(signupMsg, "", "");
}

openSignupBtn?.addEventListener("click", openSignup);
closeSignupBtn?.addEventListener("click", closeSignup);

// Login
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg(loginMsg, "로그인 중...", "");

  const email = (loginEmail?.value || "").trim();
  const password = loginPassword?.value || "";

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    setMsg(loginMsg, "로그인 성공! 이동 중...", "ok");

    // 원하는 대로: 로그인 성공 시 dashboard.html 이동
    window.location.href = "dashboard.html";
  } catch (err) {
    setMsg(loginMsg, err?.message || "로그인 실패", "err");
  }
});

// Signup
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg(signupMsg, "회원가입 중...", "");

  const email = (signupEmail?.value || "").trim();
  const pw1 = signupPassword?.value || "";
  const pw2 = signupPassword2?.value || "";

  if (pw1.length < 6) {
    setMsg(signupMsg, "비밀번호는 6자 이상으로 설정해 주세요.", "err");
    return;
  }
  if (pw1 !== pw2) {
    setMsg(signupMsg, "비밀번호가 일치하지 않습니다.", "err");
    return;
  }

  try {
    const { data, error } = await sb.auth.signUp({ email, password: pw1 });
    if (error) throw error;

    // Supabase 설정에 따라 이메일 인증이 필요할 수 있음
    if (data?.user && !data?.session) {
      setMsg(signupMsg, "가입 완료! 이메일 인증 후 로그인해 주세요.", "ok");
    } else {
      setMsg(signupMsg, "가입 완료! 로그인해 주세요.", "ok");
    }

    // UX 유지: 패널은 열어두고, 로그인 폼에 이메일 미리 채움
    if (loginEmail) loginEmail.value = email;
  } catch (err) {
    setMsg(signupMsg, err?.message || "회원가입 실패", "err");
  }
});

// Session UI (optional)
async function refreshSessionUI() {
  const { data } = await sb.auth.getSession();
  const isLoggedIn = !!data?.session;

  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
}

logoutBtn?.addEventListener("click", async () => {
  await sb.auth.signOut();
  setMsg(loginMsg, "로그아웃 완료", "ok");
  refreshSessionUI();
});

sb.auth.onAuthStateChange(() => {
  refreshSessionUI();
});

refreshSessionUI();
