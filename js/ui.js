// --- SHARED UI UTILITIES: TOASTS, CONFIRM DIALOG, SQL COPY ---

function copySqlScript() {
  const scriptText = cachedSqlScript || document.getElementById('sql-script-text').innerText;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(scriptText).then(() => {
      showToast("SQL setup script copied to clipboard!", "📋");
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
    showToast("SQL setup script copied to clipboard!", "📋");
  } catch (err) {
    showToast("Unable to copy automatically", "⚠️");
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

function showConfirmDialog(title, message, onConfirm) {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-message').innerText = message;

  const cancelBtn = document.getElementById('btn-confirm-cancel');
  const okBtn = document.getElementById('btn-confirm-ok');

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
