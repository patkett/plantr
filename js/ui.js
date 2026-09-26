// --- SHARED UI UTILITIES: TOASTS, CONFIRM DIALOG, SQL COPY ---

function copySqlScript() {
  const scriptText = cachedSqlScript || document.getElementById('sql-script-text').innerText;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(scriptText).then(() => {
      showToast("SQL-Setup-Skript in die Zwischenablage kopiert!", "📋");
    }).catch(() => {
      fallbackCopyText(scriptText);
    });
  } else {
    fallbackCopyText(scriptText);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast("SQL-Setup-Skript in die Zwischenablage kopiert!", "📋");
  } catch (err) {
    showToast("Automatisches Kopieren nicht möglich", "⚠️");
  }
  document.body.removeChild(textarea);
}

let toastTimeout = null;
function showToast(message, icon = '🌿') {
  const toast = document.getElementById('verdant-toast');
  document.getElementById('toast-icon').innerText = icon;
  document.getElementById('toast-message').innerText = message;

  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 2500);
}

function showConfirmDialog(title, message, onConfirm, okLabel = 'Löschen', tone = 'danger') {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-message').innerText = message;

  const cancelBtn = document.getElementById('btn-confirm-cancel');
  const okBtn = document.getElementById('btn-confirm-ok');
  okBtn.innerText = okLabel;
  okBtn.classList.toggle('bg-red-600', tone === 'danger');
  okBtn.classList.toggle('hover:bg-red-700', tone === 'danger');
  okBtn.classList.toggle('bg-brand-600', tone !== 'danger');
  okBtn.classList.toggle('hover:bg-brand-700', tone !== 'danger');

  const cleanup = () => {
    modal.classList.add('hidden');
    cancelBtn.onclick = null;
    okBtn.onclick = null;
  };

  cancelBtn.onclick = cleanup;
  okBtn.onclick = () => {
    cleanup();
    onConfirm();
  };

  modal.classList.remove('hidden');
}
