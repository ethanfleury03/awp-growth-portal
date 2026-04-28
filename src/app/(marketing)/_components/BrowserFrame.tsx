import type { ReactNode } from 'react';

export function BrowserFrame({
  url = 'app.plumber.os',
  children,
  className = '',
}: {
  url?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`chrome-browser ${className}`}>
      <div className="chrome-bar">
        <span className="chrome-dot" style={{ background: '#ff5f56' }} />
        <span className="chrome-dot" style={{ background: '#ffbd2e' }} />
        <span className="chrome-dot" style={{ background: '#27c93f' }} />
        <span className="chrome-url">{url}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`phone-frame ${className}`}>
      <div className="phone-frame-inner">{children}</div>
    </div>
  );
}
