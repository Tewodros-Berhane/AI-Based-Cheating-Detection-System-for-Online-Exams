import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from 'antd-compat';
import './app-modal.css';

function AppModal({ open, title, subtitle, onClose, children, width = 720 }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="app-modal-backdrop" onMouseDown={onClose}>
      <section
        className="app-modal-panel"
        style={{ maxWidth: `${width}px` }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <div className="app-modal-title-wrap">
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="app-modal-close" type="button" onClick={onClose} aria-label="Close dialog">
            <Icon type="close" />
          </button>
        </header>
        <div className="app-modal-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}

export default AppModal;
