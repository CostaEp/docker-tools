/* ── Toast ──────────────────────────────────────────────────────────
   Lightweight notification system
   ─────────────────────────────────────────────────────────────────── */

const ICONS = {
  success: 'ph-check-circle',
  error:   'ph-x-circle',
  info:    'ph-info',
  warning: 'ph-warning',
};

export function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="ph ${ICONS[type] || ICONS.info}"></i><span>${message}</span>`;
  container.appendChild(el);

  const remove = () => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

export default toast;
