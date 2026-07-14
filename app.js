const tabs = [...document.querySelectorAll(".tab")];
const panels = [...document.querySelectorAll(".tab-panel")];
const adminOnlyNodes = [...document.querySelectorAll(".admin-only")];
const searchInput = document.getElementById("globalSearch");
const themeToggleBtn = document.getElementById("themeToggle");
const toggleSecretsBtn = document.getElementById("toggleSecrets");
const logoutBtn = document.getElementById("logoutBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");
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
const adminUserSearchInput = document.getElementById("adminUserSearch");
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : "";
}

// Cabeceras para peticiones que modifican estado (double-submit CSRF).
function mutationHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-csrf-token": getCookie("doc_csrf"),
    ...extra,
  };
}

// Modal reutilizable. fields: [{name,label,type,value,required,minlength}]
function openModal(title, fields, onSubmit) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const rows = fields
    .map((f) => {
      const val = escapeHtml(f.value || "");
      if (f.type === "textarea") {
        return `<label>${escapeHtml(f.label)}<textarea name="${f.name}" ${f.required ? "required" : ""}>${val}</textarea></label>`;
      }
      if (f.type === "select") {
        const options = (f.options || [])
          .map(
            (o) =>
              `<option value="${escapeHtml(o.value)}" ${o.value === f.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`
          )
          .join("");
        return `<label>${escapeHtml(f.label)}<select name="${f.name}">${options}</select></label>`;
      }
      const min = f.minlength ? `minlength="${f.minlength}"` : "";
      return `<label>${escapeHtml(f.label)}<input name="${f.name}" type="${f.type || "text"}" value="${val}" ${f.required ? "required" : ""} ${min} /></label>`;
    })
    .join("");

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${escapeHtml(title)}</h3>
      <form class="admin-form modal-form">
        ${rows}
        <p class="admin-message modal-message" aria-live="polite"></p>
        <div class="modal-actions">
          <button type="button" class="btn ghost modal-cancel">Cancelar</button>
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector("form");
  const message = overlay.querySelector(".modal-message");
  const close = () => overlay.remove();

  overlay.querySelector(".modal-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    setMessage(message, "Guardando...");
    try {
      const ok = await onSubmit(data, message);
      if (ok) {
        close();
      }
    } catch {
      setMessage(message, "Error inesperado", true);
    }
  });

  return { close, setMessage: (t, e) => setMessage(message, t, e) };
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

  if (currentUser?.role === "admin") {
    const actions = document.createElement("div");
    actions.className = "admin-user-actions";
    actions.innerHTML = `
      <button class="btn" type="button" data-action="edit-module">Editar</button>
      <button class="btn ghost" type="button" data-action="delete-module">Eliminar</button>
    `;
    actions
      .querySelector("[data-action='edit-module']")
      .addEventListener("click", () => openEditModuleModal(moduleItem));
    actions
      .querySelector("[data-action='delete-module']")
      .addEventListener("click", () => handleDeleteModule(moduleItem));
    card.appendChild(actions);
  }

  return card;
}

function openEditModuleModal(moduleItem) {
  openModal(
    "Editar modulo",
    [
      { name: "title", label: "Titulo", value: moduleItem.title, required: true },
      {
        name: "description",
        label: "Descripcion",
        type: "textarea",
        value: moduleItem.description,
        required: true,
      },
      {
        name: "linkUrl",
        label: "Enlace (http/https)",
        type: "url",
        value: moduleItem.linkUrl,
        required: true,
      },
      { name: "linkText", label: "Texto del enlace", value: moduleItem.linkText, required: true },
      {
        name: "detailLabel",
        label: "Etiqueta detalle",
        value: moduleItem.detailLabel,
        required: true,
      },
      {
        name: "detailValue",
        label: "Valor detalle",
        value: moduleItem.detailValue,
        required: true,
      },
      { name: "usage", label: "Uso", type: "textarea", value: moduleItem.usage, required: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        value: moduleItem.status,
        options: [
          { value: "ok", label: "Activo" },
          { value: "warn", label: "Flujo" },
          { value: "critical", label: "Critico" },
        ],
      },
      { name: "tags", label: "Etiquetas (coma)", value: moduleItem.tags },
    ],
    async (data, setMsg) => {
      const response = await fetch("/api/modules", {
        method: "PATCH",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify({ id: moduleItem.id, ...data }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMsg(result.error || "No fue posible actualizar", true);
        return false;
      }
      setMessage(dynamicModulesMessage, "Modulo actualizado");
      await loadModules();
      return true;
    }
  );
}

async function handleDeleteModule(moduleItem) {
  if (
    !window.confirm(`Eliminar el modulo "${moduleItem.title}"? Esta accion no se puede deshacer.`)
  ) {
    return;
  }

  setMessage(dynamicModulesMessage, "Eliminando modulo...");
  try {
    const response = await fetch("/api/modules", {
      method: "DELETE",
      headers: mutationHeaders(),
      credentials: "include",
      body: JSON.stringify({ id: moduleItem.id }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(dynamicModulesMessage, result.error || "No fue posible eliminar", true);
      return;
    }
    setMessage(dynamicModulesMessage, "Modulo eliminado");
    await loadModules();
  } catch {
    setMessage(dynamicModulesMessage, "Error de conexion al eliminar", true);
  }
}

async function loadModules() {
  if (!dynamicModulesList) {
    return;
  }

  dynamicModulesList.innerHTML = "";
  setMessage(dynamicModulesMessage, "Cargando modulos...");

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
      setMessage(
        dynamicModulesMessage,
        "Aun no hay modulos. Un admin puede crearlos desde 'Crear Modulo Nuevo'."
      );
      return;
    }

    data.modules.forEach((moduleItem) => {
      dynamicModulesList.appendChild(renderDynamicModuleCard(moduleItem));
    });

    setMessage(dynamicModulesMessage, `Modulos cargados: ${data.modules.length}`);
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
      headers: mutationHeaders(),
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
      <strong>${escapeHtml(user.displayName)}</strong>
      <p>${escapeHtml(user.email)}</p>
      <p>Rol: ${user.role === "admin" ? "Administrador" : "Usuario"}</p>
    </div>
    <div class="admin-user-actions">
      <span class="chip ${user.isActive ? "ok" : "warn"}">${statusLabel}</span>
      <button class="btn" type="button" data-action="toggle" data-id="${user.id}" data-next-active="${String(!user.isActive)}">${toggleText}</button>
      <button class="btn" type="button" data-action="edit">Editar</button>
      <button class="btn ghost" type="button" data-action="reset">Resetear clave</button>
    </div>
  `;

  item
    .querySelector("[data-action='edit']")
    .addEventListener("click", () => openEditUserModal(user));
  item
    .querySelector("[data-action='reset']")
    .addEventListener("click", () => openResetPasswordModal(user));

  const toggleButton = item.querySelector("button[data-action='toggle']");
  toggleButton.addEventListener("click", async () => {
    const userId = Number(toggleButton.dataset.id);
    const nextActive = toggleButton.dataset.nextActive === "true";

    toggleButton.disabled = true;
    setMessage(adminUsersMessage, "Actualizando estado de usuario...");

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: mutationHeaders(),
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

  const search = adminUserSearchInput ? adminUserSearchInput.value.trim() : "";
  const queryString = search ? `?search=${encodeURIComponent(search)}` : "";

  try {
    const response = await fetch(`/api/users${queryString}`, {
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
      headers: mutationHeaders(),
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

function openEditUserModal(user) {
  openModal(
    "Editar usuario",
    [
      { name: "displayName", label: "Nombre completo", value: user.displayName, required: true },
      {
        name: "role",
        label: "Rol",
        type: "select",
        value: user.role,
        options: [
          { value: "user", label: "Usuario" },
          { value: "admin", label: "Administrador" },
        ],
      },
    ],
    async (data, setMsg) => {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify({ userId: user.id, action: "updateProfile", ...data }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMsg(result.error || "No fue posible actualizar", true);
        return false;
      }
      setMessage(adminUsersMessage, "Usuario actualizado");
      await loadUsers();
      return true;
    }
  );
}

function openResetPasswordModal(user) {
  openModal(
    `Resetear clave de ${user.displayName}`,
    [
      {
        name: "password",
        label: "Nueva clave (min 8)",
        type: "password",
        required: true,
        minlength: 8,
      },
    ],
    async (data, setMsg) => {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify({ userId: user.id, action: "resetPassword", password: data.password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMsg(result.error || "No fue posible resetear", true);
        return false;
      }
      setMessage(adminUsersMessage, "Clave reseteada. El usuario debera cambiarla al ingresar.");
      return true;
    }
  );
}

function openChangePasswordModal(forced = false) {
  const modal = openModal(
    forced ? "Debes cambiar tu clave" : "Cambiar mi clave",
    [
      { name: "currentPassword", label: "Clave actual", type: "password", required: true },
      {
        name: "newPassword",
        label: "Nueva clave (min 8)",
        type: "password",
        required: true,
        minlength: 8,
      },
    ],
    async (data, setMsg) => {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        setMsg(result.error || "No fue posible cambiar la clave", true);
        return false;
      }
      if (currentUser) {
        currentUser.mustChangePassword = false;
      }
      return true;
    }
  );

  return modal;
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

if (adminUserSearchInput) {
  let userSearchTimer;
  adminUserSearchInput.addEventListener("input", () => {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(loadUsers, 300);
  });
}

if (adminCreateModuleForm) {
  adminCreateModuleForm.addEventListener("submit", handleCreateModule);
}

if (changePasswordBtn) {
  changePasswordBtn.addEventListener("click", () => openChangePasswordModal(false));
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

  if (currentUser?.mustChangePassword) {
    openChangePasswordModal(true);
  }
}

init();
