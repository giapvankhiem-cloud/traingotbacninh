import type { ReactNode } from 'react';

export function ContactLink({ children, className, onNavigate }: {
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  return <a href="#lien-he" className={className} onClick={(event) => {
    const section = document.getElementById('lien-he');
    if (!section || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.();
    section.focus({ preventScroll: true });
    section.scrollIntoView();
  }}>{children}</a>;
}
