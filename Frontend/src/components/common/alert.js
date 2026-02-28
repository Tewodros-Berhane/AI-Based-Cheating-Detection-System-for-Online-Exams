import { Modal } from 'antd-compat';

export default function Alert(s = 'warning', h, b) {
  const type = ['success', 'error', 'warning'].includes(s) ? s : 'warning';
  const modalMethod = Modal[type] || Modal.warning;
  const statusLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const title = h || `${statusLabel}!`;

  return modalMethod({
    title,
    content: b,
    className: `modern-alert modern-alert-${type}`,
    okText: 'Okay'
  });
}

