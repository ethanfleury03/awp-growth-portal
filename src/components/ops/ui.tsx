'use client';

import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/ops';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--ops-brand)] text-white shadow-[0_12px_28px_-16px_rgba(33,105,255,0.72)] hover:bg-[var(--ops-brand-strong)]',
  secondary:
    'bg-[var(--ops-surface-strong)] text-[var(--ops-text)] border border-[var(--ops-border-strong)] hover:bg-[var(--ops-surface-subtle)]',
  ghost: 'bg-transparent text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]',
  danger: 'bg-[var(--ops-danger)] text-white hover:bg-[#be3952]',
  warning: 'bg-[var(--ops-warning)] text-[#271504] hover:bg-[#b67a19]',
  subtle:
    'bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] text-[var(--ops-text)] border border-[var(--ops-border)] hover:border-[var(--ops-border-strong)]',
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
};

const toneClasses = {
  brand: 'bg-[var(--ops-brand-soft)] text-[var(--ops-brand-ink)] border-[var(--ops-brand-soft-border)]',
  success: 'bg-[var(--ops-success-soft)] text-[var(--ops-success-ink)] border-[var(--ops-success-soft-border)]',
  warning: 'bg-[var(--ops-warning-soft)] text-[var(--ops-warning-ink)] border-[var(--ops-warning-soft-border)]',
  danger: 'bg-[var(--ops-danger-soft)] text-[var(--ops-danger-ink)] border-[var(--ops-danger-soft-border)]',
  neutral: 'bg-[var(--ops-surface-subtle)] text-[var(--ops-text)] border-[var(--ops-border)]',
  muted: 'bg-[var(--ops-shell-soft)] text-[var(--ops-shell-muted)] border-[var(--ops-shell-border)]',
  violet: 'bg-[var(--ops-violet-soft)] text-[var(--ops-violet-ink)] border-[var(--ops-violet-soft-border)]',
  sky: 'bg-[var(--ops-sky-soft)] text-[var(--ops-sky-ink)] border-[var(--ops-sky-soft-border)]',
} as const;

type Tone = keyof typeof toneClasses;

export function opsButtonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ops-focus-ring)] disabled:pointer-events-none disabled:opacity-50',
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
  );
}

export function OpsButton({
  className,
  variant = 'secondary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={cn(opsButtonClass(variant, size), className)} {...props} />;
}

export function OpsInput({
  className,
  icon: Icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  return (
    <label
      className={cn(
        'flex h-11 items-center gap-3 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3.5 text-sm text-[var(--ops-text)] shadow-[var(--ops-shadow-inset)] transition-colors focus-within:border-[var(--ops-border-strong)] focus-within:ring-4 focus-within:ring-[var(--ops-focus-ring)]',
        className,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 text-[var(--ops-muted)]" aria-hidden /> : null}
      <input
        className="min-w-0 flex-1 bg-transparent text-[var(--ops-text)] placeholder:text-[var(--ops-muted)] outline-none"
        {...props}
      />
    </label>
  );
}

export function OpsSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3.5 text-sm text-[var(--ops-text)] shadow-[var(--ops-shadow-inset)] outline-none transition-colors focus:border-[var(--ops-border-strong)] focus:ring-4 focus:ring-[var(--ops-focus-ring)]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function OpsTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[112px] w-full rounded-3xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-text)] shadow-[var(--ops-shadow-inset)] outline-none transition-colors placeholder:text-[var(--ops-muted)] focus:border-[var(--ops-border-strong)] focus:ring-4 focus:ring-[var(--ops-focus-ring)]',
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({
  tone = 'neutral',
  mono = false,
  className,
  children,
}: {
  tone?: Tone;
  mono?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]',
        toneClasses[tone],
        mono && 'font-mono tracking-normal',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AppPageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-[32px] border border-[var(--ops-border-strong)] bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] px-6 py-6 shadow-[var(--ops-shadow-soft)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(33,105,255,0.38),transparent)]" />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ops-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex items-start gap-4">
            {Icon ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] border border-[rgba(33,105,255,0.18)] bg-[linear-gradient(180deg,rgba(33,105,255,0.1),rgba(33,105,255,0.04))] text-[var(--ops-brand)]">
                <Icon className="h-7 w-7" aria-hidden />
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.75rem,3vw,2.45rem)] font-semibold tracking-[-0.03em] text-[var(--ops-text)]">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ops-muted)]">{description}</p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}

export function ConsolePanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-[var(--ops-border)] bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] shadow-[var(--ops-shadow-soft)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="h-5 w-5 text-[var(--ops-brand)]" aria-hidden /> : null}
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[var(--ops-text)]">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm text-[var(--ops-muted)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn('px-5 py-5', contentClassName)}>{children}</div>
    </section>
  );
}

export function KpiStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  meta,
  badge,
  tone = 'neutral',
  icon: Icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-[var(--ops-border)] bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] p-5 shadow-[var(--ops-shadow-soft)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]">{label}</p>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ops-text)]">{value}</div>
            {Icon ? (
              <div
                className={cn(
                  'mb-1 flex h-10 w-10 items-center justify-center rounded-2xl border',
                  toneClasses[tone],
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
            ) : null}
          </div>
          {meta ? <p className="mt-3 text-sm text-[var(--ops-muted)]">{meta}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
    </div>
  );
}

export function SegmentedFilterBar({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-elevated)] p-1 shadow-[var(--ops-shadow-inset)]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
              active
                ? 'bg-[var(--ops-brand)] text-white shadow-[0_10px_24px_-14px_rgba(33,105,255,0.78)]'
                : 'text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]',
            )}
          >
            <span>{option.label}</span>
            {option.count != null ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  active ? 'bg-white/16 text-white' : 'bg-[var(--ops-surface-subtle)] text-[var(--ops-muted)]',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type DataTableColumn = {
  key: string;
  label: ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
};

export function DataTable({
  columns,
  children,
  footer,
  minWidthClassName = 'min-w-[860px]',
  className,
}: {
  columns: DataTableColumn[];
  children: ReactNode;
  footer?: ReactNode;
  minWidthClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-[28px] border border-[var(--ops-border)] bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] shadow-[var(--ops-shadow-soft)]', className)}>
      <div className="overflow-x-auto">
        <table className={cn('w-full text-sm', minWidthClassName)}>
          <thead className="bg-[var(--ops-surface-subtle)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-muted)]',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    (!column.align || column.align === 'left') && 'text-left',
                    column.className,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ops-border)]">{children}</tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-5 py-3 text-xs text-[var(--ops-muted)]">{footer}</div> : null}
    </div>
  );
}

export function ActionCard({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-[var(--ops-border)] bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] p-5 shadow-[var(--ops-shadow-soft)]',
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-[var(--ops-text)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function RightRail({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cn('space-y-4 xl:sticky xl:top-6', className)}>{children}</aside>;
}

export function DetailDrawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[rgba(8,18,35,0.46)] backdrop-blur-sm"
          />
          <motion.aside
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 36 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={cn(
              'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--ops-border-strong)] bg-[linear-gradient(180deg,var(--ops-surface-strong),var(--ops-surface))] shadow-[0_28px_64px_-24px_rgba(8,18,35,0.58)]',
              size === 'lg' ? 'max-w-2xl' : 'max-w-xl',
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--ops-border)] px-6 py-5">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--ops-text)]">{title}</h2>
                {description ? <p className="mt-1 text-sm text-[var(--ops-muted)]">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--ops-border)] text-[var(--ops-muted)] transition-colors hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]"
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
            {footer ? <div className="border-t border-[var(--ops-border)] px-6 py-4">{footer}</div> : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function TimelineList({
  items,
  empty,
}: {
  items: {
    id: string;
    title: ReactNode;
    body?: ReactNode;
    meta?: ReactNode;
    tone?: Tone;
  }[];
  empty?: ReactNode;
}) {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-5 py-7 text-sm text-[var(--ops-muted)]">
        {empty || 'Nothing here yet.'}
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={item.id} className="relative pl-8">
          {index < items.length - 1 ? (
            <span className="absolute left-3 top-7 h-[calc(100%-0.5rem)] w-px bg-[var(--ops-border-strong)]" aria-hidden />
          ) : null}
          <span
            className={cn(
              'absolute left-0 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border',
              toneClasses[item.tone || 'neutral'],
            )}
            aria-hidden
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-70" />
          </span>
          <div className="rounded-[22px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 shadow-[var(--ops-shadow-inset)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--ops-text)]">{item.title}</h3>
              {item.meta ? <div className="text-xs font-mono text-[var(--ops-muted)]">{item.meta}</div> : null}
            </div>
            {item.body ? <div className="mt-2 text-sm leading-6 text-[var(--ops-muted)]">{item.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-[var(--ops-border-strong)] bg-[var(--ops-surface-subtle)] px-6 py-10 text-center shadow-[var(--ops-shadow-inset)]">
      {Icon ? (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--ops-surface-strong)] text-[var(--ops-brand)] shadow-[var(--ops-shadow-soft)]">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ops-text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--ops-muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('animate-pulse rounded-3xl bg-[linear-gradient(90deg,#eef3fb_0%,#f7faff_40%,#eef3fb_100%)]', className)} />;
}

export function SearchField(
  props: InputHTMLAttributes<HTMLInputElement> & {
    className?: string;
  },
) {
  return <OpsInput {...props} icon={Search} className={props.className} />;
}
