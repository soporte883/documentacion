const tabs = [...document.querySelectorAll(".tab")];
const panels = [...document.querySelectorAll(".tab-panel")];
const searchInput = document.getElementById("globalSearch");
const toggleSecretsBtn = document.getElementById("toggleSecrets");
const logoutBtn = document.getElementById("logoutBtn");
const activeUserLabel = document.getElementById("activeUser");
const secrets = [...document.querySelectorAll(".secret")];
const copyButtons = [...document.querySelectorAll(".copy-secret")];
const checkboxes = [...document.querySelectorAll(".checklist input[type='checkbox']")];
const notes = [...document.querySelectorAll(".notes")];
const searchableCards = [...document.querySelectorAll(".searchable")];

const STORAGE_KEYS = {
  checklist: "doc_checklist_state",
  notes: "doc_notes_state",
};

let secretsVisible = false;

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

    activeUserLabel.textContent = data.user.displayName || data.user.email;
    return true;
  } catch {
    window.location.replace("/login.html");
    return false;
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

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

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

document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const accordion = trigger.closest(".accordion");
    const isOpen = accordion.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
    trigger.lastElementChild.textContent = isOpen ? "-" : "+";
  });
});

async function init() {
  const ok = await ensureAuthenticated();
  if (!ok) {
    return;
  }

  loadChecklistState();
  loadNotesState();
  renderSecrets();
  updateStats();
}

init();
