const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const themeToggleBtn = document.getElementById("themeToggle");
const THEME_KEY = "doc_theme_mode";

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode) {
  const dark = mode === "dark";
  document.body.classList.toggle("theme-dark", dark);

  if (themeToggleBtn) {
    themeToggleBtn.textContent = dark ? "Modo claro" : "Modo oscuro";
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains("theme-dark");
  const next = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

async function checkAlreadyLoggedIn() {
  try {
    const response = await fetch("/api/me", { credentials: "include" });
    if (response.ok) {
      window.location.replace("/");
    }
  } catch {
    // Keep user on login screen if API is unreachable.
  }
}

function setMessage(text, isError = false) {
  loginMessage.textContent = text;
  loginMessage.classList.toggle("error", isError);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Validando acceso...");

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorText = data?.error || "No fue posible iniciar sesion";
      const detailText = data?.detail ? ` (${data.detail})` : "";
      setMessage(`${errorText}${detailText}`, true);
      return;
    }

    setMessage("Acceso concedido. Redirigiendo...");
    window.location.replace("/");
  } catch {
    setMessage("Error de conexion con el servidor", true);
  }
});

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", toggleTheme);
}

applyTheme(getPreferredTheme());

checkAlreadyLoggedIn();
