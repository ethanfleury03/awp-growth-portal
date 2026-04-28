'use client';

import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { FAQ_ITEMS } from './faq-data';

export function FAQ() {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function toggle(idx: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const max = FAQ_ITEMS.length - 1;
    const next = event.key === 'ArrowDown' ? (idx >= max ? 0 : idx + 1) : (idx <= 0 ? max : idx - 1);
    buttonRefs.current[next]?.focus();
  }

  return (
    <section id="faq" className="py-24 bg-[var(--brand-cream-2)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="eyebrow">FAQ</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Questions we hear on every sales call.
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open.has(i);
            const panelId = `faq-panel-${i}`;
            const buttonId = `faq-button-${i}`;
            return (
              <div
                key={item.q}
                className={`brand-card p-0 overflow-hidden transition-all ${
                  isOpen ? 'shadow-[var(--brand-shadow-md)]' : ''
                }`}
              >
                <button
                  ref={(el) => {
                    buttonRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => toggle(i)}
                  onKeyDown={(event) => onKeyDown(event, i)}
                  className="w-full flex items-center justify-between text-left px-6 py-5"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  id={buttonId}
                >
                  <span className="font-semibold text-[var(--brand-ink)] text-base pr-6">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-[var(--brand-slate)] flex-shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-6 pb-6 text-[var(--brand-slate)] leading-relaxed border-t border-slate-100 pt-4"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
