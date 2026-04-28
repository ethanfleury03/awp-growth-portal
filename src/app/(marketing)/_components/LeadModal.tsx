'use client';

import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { LeadForm, type LeadField, type LeadKind } from './LeadForm';

export function LeadModal({
  kind,
  title,
  description,
  triggerLabel,
  triggerClassName,
  fields,
  defaultTrade,
}: {
  kind: LeadKind;
  title: string;
  description?: string;
  triggerLabel: string;
  triggerClassName?: string;
  fields?: LeadField[];
  defaultTrade?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(8,17,29,0.58)] p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="marketing-dialog p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 id={titleId} className="text-xl font-bold text-[var(--brand-ink)]">
                  {title}
                </h3>
                {description ? <p className="text-sm text-[var(--brand-slate)] mt-1">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-[var(--brand-slate-muted)] transition-colors hover:bg-[var(--brand-cream-2)] hover:text-[var(--brand-ink)]"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <LeadForm
              kind={kind}
              fields={fields}
              defaultTrade={defaultTrade}
              submitLabel="Submit"
              onSuccess={() => {
                window.setTimeout(() => setOpen(false), 1000);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
