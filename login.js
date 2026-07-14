const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

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

checkAlreadyLoggedIn();
