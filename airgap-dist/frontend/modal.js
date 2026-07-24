/* ── Modal ──────────────────────────────────────────────────────────
   Generic modal with open/close + custom content
   ─────────────────────────────────────────────────────────────────── */

const overlay = document.getElementById('modal-overlay');
const container = document.getElementById('modal-container');

export function openModal({ title, icon = 'ph-package', body, footer }) {
  container.innerHTML = `
    <div class="modal-header">
      <div class="modal-title"><i class="ph ${icon}"></i>${title}</div>
      <button class="icon-btn" id="modal-close-btn" title="Close"><i class="ph ph-x"></i></button>
    </div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  `;
  overlay.classList.remove('hidden');

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); }, { once: true });

  // Return the container so callers can attach additional event listeners
  return container;
}

export function closeModal() {
  overlay.classList.add('hidden');
  container.innerHTML = '';
}

export function confirmModal({ title, message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
  const el = openModal({
    title,
    icon: 'ph-warning',
    body: `<p style="color:var(--text-secondary);font-size:14px;">${message}</p>`,
    footer: `
      <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
      <button class="btn ${confirmClass}" id="confirm-ok">${confirmText}</button>
    `,
  });

  el.querySelector('#confirm-cancel').addEventListener('click', closeModal);
  el.querySelector('#confirm-ok').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

export default { openModal, closeModal, confirmModal };
