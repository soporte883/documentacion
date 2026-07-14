const tabs = [...document.querySelectorAll(".tab")];
const panels = [...document.querySelectorAll(".tab-panel")];
const adminOnlyNodes = [...document.querySelectorAll(".admin-only")];
const searchInput = document.getElementById("globalSearch");
const themeToggleBtn = document.getElementById("themeToggle");
const toggleSecretsBtn = document.getElementById("toggleSecrets");
const logoutBtn = document.getElementById("logoutBtn");
const activeUserLabel = document.getElementById("activeUser");
const secrets = [...document.querySelectorAll(".secret")];
const copyButtons = [...document.querySelectorAll(".copy-secret")];
const checkboxes = [...document.querySelectorAll(".checklist input[type='checkbox']")];
const notes = [...document.querySelectorAll(".notes")];
const adminCreateUserForm = document.getElementById("adminCreateUserForm");
const adminCreateMessage = document.getElementById("adminCreateMessage");
const adminUsersList = document.getElementById("adminUsersList");
const adminUsersMessage = document.getElementById("adminUsersMessage");
const adminRefreshUsersBtn = document.getElementById("adminRefreshUsers");
const adminCreateModuleForm = document.getElementById("adminCreateModuleForm");
const adminModuleMessage = document.getElementById("adminModuleMessage");
const dynamicModulesList = document.getElementById("dynamicModulesList");
const dynamicModulesMessage = document.getElementById("dynamicModulesMessage");

const STORAGE_KEYS = {
  checklist: "doc_checklist_state",
  notes: "doc_notes_state",
  theme: "doc_theme_mode",
};

let secretsVisible = true;
let currentUser = null;

function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeButton(mode) {
  if (!themeToggleBtn) {
    return;
  }

  themeToggleBtn.textContent = mode === "dark" ? "Modo claro" : "Modo oscuro";
}

function applyTheme(mode) {
  const dark = mode === "dark";
  document.body.classList.toggle("theme-dark", dark);
  updateThemeButton(mode);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("theme-dark");
  const next = isDark ? "light" : "dark";
  localStorage.setItem(STORAGE_KEYS.theme, next);
  applyTheme(next);
}

async function ensureAuthenticated() {
  try {
    const response = await fetch("/api/me", { credentials: "include" });
    if (!response.ok) {
      window.location.replace("/login.html");
      return false;
    }

    const data = await response.json();
    if (!data.authenticated) {
      window.location.replace("/login.html");
      return false;
    }

    currentUser = data.user;
    activeUserLabel.textContent = data.user.displayName || data.user.email;
    return true;
  } catch {
    window.location.replace("/login.html");
    return false;
  }
}

function setAdminVisibility(isAdmin) {
  adminOnlyNodes.forEach((node) => {
    node.hidden = !isAdmin;
  });

  if (!isAdmin && document.querySelector(".tab.active")?.dataset.tab === "admin") {
    activateTab("modulos");
  }
}

function activateTab(tabName) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle("active", isActive);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabName);
  });
}

function applySearch(query) {
  const term = query.trim().toLowerCase();
  const searchableCards = [...document.querySelectorAll(".searchable")];

  searchableCards.forEach((card) => {
    if (!term) {
      card.classList.remove("hidden-by-search");
      return;
    }

    const text = card.textContent.toLowerCase();
    const tags = (card.dataset.tags || "").toLowerCase();
    const match = text.includes(term) || tags.includes(term);
    card.classList.toggle("hidden-by-search", !match);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusTextFromCode(status) {
  if (status === "critical") {
    return "Critico";
  }

  if (status === "warn") {
    return "Flujo";
  }

  return "Activo";
}

function renderDynamicModuleCard(moduleItem) {
  const card = document.createElement("article");
  card.className = "card searchable module-card";
  card.dataset.tags = moduleItem.tags || "";

  const firstLetter = (moduleItem.title || "M").trim().charAt(0).toUpperCase() || "M";
  const safeTitle = escapeHtml(moduleItem.title);
  const safeDescription = escapeHtml(moduleItem.description);
  const safeLinkUrl = escapeHtml(moduleItem.linkUrl);
  const safeLinkText = escapeHtml(moduleItem.linkText);
  const safeDetailLabel = escapeHtml(moduleItem.detailLabel);
  const safeDetailValue = escapeHtml(moduleItem.detailValue);
  const safeUsage = escapeHtml(moduleItem.usage);

  card.innerHTML = `
    <div class="card-head">
      <div class="title-wrap">
        <span class="logo-badge dynamic">${firstLetter}</span>
        <h3>${safeTitle}</h3>
      </div>
      <span class="chip ${moduleItem.status}">${statusTextFromCode(moduleItem.status)}</span>
    </div>
    <p>${safeDescription}</p>
    <ul class="kv-list">
      <li><strong>Enlace:</strong> <a href="${safeLinkUrl}" target="_blank" rel="noreferrer">${safeLinkText}</a></li>
      <li><strong>${safeDetailLabel}:</strong> ${safeDetailValue}</li>
      <li><strong>Uso:</strong> ${safeUsage}</li>
    </ul>
  `;

  return card;
}

async function loadModules() {
  if (!dynamicModulesList) {
    return;
  }

  dynamicModulesList.innerHTML = "";
  setMessage(dynamicModulesMessage, "Cargando modulos creados por admin...");

  try {
    const response = await fetch("/api/modules", {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(dynamicModulesMessage, data.error || "No fue posible cargar modulos", true);
      return;
    }

    if (!data.modules.length) {
      setMessage(dynamicModulesMessage, "Aun no hay modulos adicionales");
      return;
    }

    data.modules.forEach((moduleItem) => {
      dynamicModulesList.appendChild(renderDynamicModuleCard(moduleItem));
    });

    setMessage(dynamicModulesMessage, `Modulos adicionales cargados: ${data.modules.length}`);
    applySearch(searchInput.value || "");
  } catch {
    setMessage(dynamicModulesMessage, "Error de conexion al cargar modulos", true);
  }
}

async function handleCreateModule(event) {
  event.preventDefault();
  setMessage(adminModuleMessage, "Creando modulo...");

  const formData = new FormData(adminCreateModuleForm);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    linkUrl: String(formData.get("linkUrl") || "").trim(),
    linkText: String(formData.get("linkText") || "").trim(),
    detailLabel: String(formData.get("detailLabel") || "").trim(),
    detailValue: String(formData.get("detailValue") || "").trim(),
    usage: String(formData.get("usage") || "").trim(),
    status: String(formData.get("status") || "ok").trim(),
    tags: String(formData.get("tags") || "").trim(),
  };

  try {
    const response = await fetch("/api/modules", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(adminModuleMessage, data.error || "No fue posible crear modulo", true);
      return;
    }

    adminCreateModuleForm.reset();
    setMessage(adminModuleMessage, "Modulo creado correctamente");
    await loadModules();
  } catch {
    setMessage(adminModuleMessage, "Error de conexion al crear modulo", true);
  }
}

function renderSecrets() {
  secrets.forEach((secret) => {
    const raw = secret.dataset.secret || "";
    if (secretsVisible) {
      secret.textContent = raw;
      secret.classList.add("revealed");
    } else {
      secret.textContent = "••••••••••••";
      secret.classList.remove("revealed");
    }
  });
}

function saveChecklistState() {
  const data = {};
  checkboxes.forEach((input) => {
    data[input.dataset.task] = input.checked;
  });
  localStorage.setItem(STORAGE_KEYS.checklist, JSON.stringify(data));
  updateStats();
}

function loadChecklistState() {
  const raw = localStorage.getItem(STORAGE_KEYS.checklist);
  if (!raw) {
    return;
  }

  try {
    const data = JSON.parse(raw);
    checkboxes.forEach((input) => {
      input.checked = Boolean(data[input.dataset.task]);
    });
  } catch {
    localStorage.removeItem(STORAGE_KEYS.checklist);
  }
}

function saveNotesState() {
  const data = notes.map((n, i) => ({ i, value: n.value }));
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(data));
}

function loadNotesState() {
  const raw = localStorage.getItem(STORAGE_KEYS.notes);
  if (!raw) {
    return;
  }

  try {
    const data = JSON.parse(raw);
    data.forEach((entry) => {
      if (notes[entry.i]) {
        notes[entry.i].value = entry.value;
      }
    });
  } catch {
    localStorage.removeItem(STORAGE_KEYS.notes);
  }
}

function updateStats() {
  const totalProcesses = document.querySelectorAll("#procesos .card").length;
  const totalAccess = document.querySelectorAll("#accesos .card").length;
  const pending = checkboxes.filter((cb) => !cb.checked).length;

  document.getElementById("countProcesses").textContent = String(totalProcesses);
  document.getElementById("countAccess").textContent = String(totalAccess);
  document.getElementById("countPending").textContent = String(pending);
}

function setMessage(element, text, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.toggle("error", isError);
}

function createUserRow(user) {
  const item = document.createElement("article");
  item.className = "admin-user-item";

  const statusLabel = user.isActive ? "Activo" : "Inactivo";
  const toggleText = user.isActive ? "Inactivar" : "Activar";

  item.innerHTML = `
    <div>
      <strong>${user.displayName}</strong>
      <p>${user.email}</p>
      <p>Rol: ${user.role === "admin" ? "Administrador" : "Usuario"}</p>
    </div>
    <div class="admin-user-actions">
      <span class="chip ${user.isActive ? "ok" : "warn"}">${statusLabel}</span>
      <button class="btn" type="button" data-action="toggle" data-id="${user.id}" data-next-active="${String(!user.isActive)}">${toggleText}</button>
    </div>
  `;

  const toggleButton = item.querySelector("button[data-action='toggle']");
  toggleButton.addEventListener("click", async () => {
    const userId = Number(toggleButton.dataset.id);
    const nextActive = toggleButton.dataset.nextActive === "true";

    toggleButton.disabled = true;
    setMessage(adminUsersMessage, "Actualizando estado de usuario...");

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId,
          isActive: nextActive,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(adminUsersMessage, data.error || "No fue posible actualizar", true);
        return;
      }

      setMessage(adminUsersMessage, "Estado actualizado correctamente");
      await loadUsers();
    } catch {
      setMessage(adminUsersMessage, "Error de conexion al actualizar", true);
    } finally {
      toggleButton.disabled = false;
    }
  });

  return item;
}

async function loadUsers() {
  if (!adminUsersList) {
    return;
  }

  adminUsersList.innerHTML = "";
  setMessage(adminUsersMessage, "Cargando usuarios...");

  try {
    const response = await fetch("/api/users", {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(adminUsersMessage, data.error || "No fue posible cargar usuarios", true);
      return;
    }

    if (!data.users.length) {
      setMessage(adminUsersMessage, "No hay usuarios registrados");
      return;
    }

    data.users.forEach((user) => {
      adminUsersList.appendChild(createUserRow(user));
    });

    setMessage(adminUsersMessage, `Usuarios cargados: ${data.users.length}`);
  } catch {
    setMessage(adminUsersMessage, "Error de conexion al cargar usuarios", true);
  }
}

async function handleCreateUser(event) {
  event.preventDefault();
  setMessage(adminCreateMessage, "Creando usuario...");

  const formData = new FormData(adminCreateUserForm);
  const payload = {
    email: String(formData.get("email") || "").trim(),
    displayName: String(formData.get("displayName") || "").trim(),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || "user"),
  };

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(adminCreateMessage, data.error || "No fue posible crear usuario", true);
      return;
    }

    adminCreateUserForm.reset();
    setMessage(adminCreateMessage, "Usuario creado correctamente");
    await loadUsers();
  } catch {
    setMessage(adminCreateMessage, "Error de conexion al crear usuario", true);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", toggleTheme);
}

searchInput.addEventListener("input", (event) => {
  applySearch(event.target.value);
});

toggleSecretsBtn.addEventListener("click", () => {
  secretsVisible = !secretsVisible;
  renderSecrets();
});

logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    window.location.replace("/login.html");
  }
});

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy || "";
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copiado";
      setTimeout(() => {
        button.textContent = "Copiar";
      }, 1100);
    } catch {
      button.textContent = "No disponible";
      setTimeout(() => {
        button.textContent = "Copiar";
      }, 1100);
    }
  });
});

checkboxes.forEach((input) => {
  input.addEventListener("change", saveChecklistState);
});

notes.forEach((n) => {
  n.addEventListener("input", saveNotesState);
});

if (adminCreateUserForm) {
  adminCreateUserForm.addEventListener("submit", handleCreateUser);
}

if (adminRefreshUsersBtn) {
  adminRefreshUsersBtn.addEventListener("click", loadUsers);
}

if (adminCreateModuleForm) {
  adminCreateModuleForm.addEventListener("submit", handleCreateModule);
}

document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const accordion = trigger.closest(".accordion");
    const isOpen = accordion.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
    trigger.lastElementChild.textContent = isOpen ? "-" : "+";
  });
});

async function init() {
  applyTheme(getPreferredTheme());

  const ok = await ensureAuthenticated();
  if (!ok) {
    return;
  }

  const isAdmin = currentUser?.role === "admin";
  setAdminVisibility(isAdmin);

  loadChecklistState();
  loadNotesState();
  renderSecrets();
  updateStats();
  await loadModules();

  if (isAdmin) {
    await loadUsers();
  }
}

init();
