import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface EmployeeAction { label: string; group: string; onSelect: () => void; destructive?: boolean }

export default function EmployeeActions({ name, actions }: { name: string; actions: EmployeeAction[] }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => { setPosition(null); trigger.current?.focus({ preventScroll: true }); };
  const open = () => {
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({ top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 410)), left: Math.max(12, Math.min(rect.right - 260, window.innerWidth - 272)) });
  };
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const scroll = () => setPosition(null);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', scroll);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', scroll); };
  }, [position]);
  const groups = [...new Set(actions.map(action => action.group))];
  return <>
    <button ref={trigger} type="button" aria-label={`إجراءات ${name}`} aria-haspopup="menu" aria-expanded={!!position} onClick={() => position ? close() : open()} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); open(); } }} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold">
      إجراءات <ChevronDown size={15} aria-hidden="true" />
    </button>
    {position && createPortal(<div ref={menu} role="menu" aria-label={`إجراءات ${name}`} className="employee-actions-menu" style={position} onKeyDown={event => {
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || []) as HTMLButtonElement[];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); close(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); (event.key === 'Home' ? items[0] : items.at(-1))?.focus(); }
    }}>
      <p className="employee-actions-name">{name}</p>
      {groups.map(group => <div role="group" aria-label={group} key={group}><p className="employee-actions-group">{group}</p>{actions.filter(action => action.group === group).map(action => <button key={action.label} role="menuitem" type="button" className={action.destructive ? 'employee-action-danger' : ''} onClick={() => { setPosition(null); action.onSelect(); }}>{action.label}</button>)}</div>)}
    </div>, document.body)}
  </>;
}
