'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Search,
  Bell,
  Calendar,
  FileText,
  Link2,
  CreditCard,
  Plus,
  X,
  Trash2,
  Pencil,
  GripVertical,
} from 'lucide-react';

type CustomerOption = { id: string; name: string; phone?: string | null; email?: string | null };

type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
};

type DraftLine = {
  key: string;
  /** '' | '__custom__' | catalog id */
  catalogId: string;
  customName: string;
  quantity: string;
  unitPriceStr: string;
  description: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function emptyDraftLine(): DraftLine {
  return {
    key:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random()}`,
    catalogId: '',
    customName: '',
    quantity: '1',
    unitPriceStr: '',
    description: '',
  };
}

function lineUnitCents(line: DraftLine, catalogServices: CatalogService[]): number {
  const s = line.unitPriceStr.trim();
  if (s !== '') {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
  }
  if (line.catalogId && line.catalogId !== '__custom__') {
    const svc = catalogServices.find((x) => x.id === line.catalogId);
    return svc ? svc.unit_price_cents : 0;
  }
  return 0;
}

function lineDisplayName(line: DraftLine, catalogServices: CatalogService[]): string {
  if (line.catalogId === '__custom__') return line.customName.trim();
  if (line.catalogId) {
    const svc = catalogServices.find((x) => x.id === line.catalogId);
    return (svc?.name || line.customName).trim();
  }
  return line.customName.trim();
}

type InvoiceLineItemApi = {
  name: string;
  line_total_cents: number;
  quantity: number;
  unit_price_cents?: number;
  description?: string | null;
  catalog_service_id?: string | null;
};

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id?: string | null;
  public_pay_token?: string | null;
  customers?: { name?: string; email?: string; phone?: string } | null;
  service_type?: string | null;
  issue_date: string;
  amount: number;
  tax?: number | null;
  total?: number | null;
  total_cents?: number | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  line_items?: InvoiceLineItemApi[];
}

type InvoiceModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; invoice: Invoice };

function invoiceTotalDollars(inv: Invoice) {
  if (inv.total_cents != null && Number.isFinite(Number(inv.total_cents))) {
    return Number(inv.total_cents) / 100;
  }
  return Number(inv.total ?? inv.amount ?? 0);
}

function draftLinesFromInvoice(inv: Invoice, catalogServices: CatalogService[]): DraftLine[] {
  const items = inv.line_items;
  if (items && items.length > 0) {
    return items.map((li) => {
      const key =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `line-${Date.now()}-${Math.random()}`;
      const catId = li.catalog_service_id ?? null;
      const catalogMatch = Boolean(catId && catalogServices.some((s) => s.id === catId));
      const unitCents = li.unit_price_cents ?? Math.round(li.line_total_cents / Math.max(li.quantity, 0.0001));
      if (catalogMatch && catId) {
        const svc = catalogServices.find((s) => s.id === catId);
        return {
          key,
          catalogId: catId,
          customName: svc?.name || li.name,
          quantity: String(li.quantity),
          unitPriceStr: (unitCents / 100).toFixed(2),
          description: (li.description ?? svc?.description ?? '').trim(),
        };
      }
      return {
        key,
        catalogId: '__custom__',
        customName: li.name,
        quantity: String(li.quantity),
        unitPriceStr: (unitCents / 100).toFixed(2),
        description: (li.description ?? '').trim(),
      };
    });
  }
  const key =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `line-${Date.now()}-${Math.random()}`;
  const subtotal =
    inv.amount ??
    (inv.total != null && inv.tax != null ? Number(inv.total) - Number(inv.tax) : invoiceTotalDollars(inv));
  return [
    {
      key,
      catalogId: '__custom__',
      customName: inv.service_type || 'Service',
      quantity: '1',
      unitPriceStr: Number(subtotal).toFixed(2),
      description: '',
    },
  ];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

function InvoiceCard({
  inv,
  formatCurrency,
  formatDate,
  onCopyLink,
  onStaffCheckout,
  onEdit,
  onDelete,
  dragHandle,
}: {
  inv: Invoice;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onCopyLink: () => void;
  onStaffCheckout: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dragHandle?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {dragHandle}
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{inv.invoice_number}</p>
              <p className="text-xs text-gray-500 truncate">{inv.customers?.name || 'Unknown customer'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Edit invoice"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Delete invoice"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColors[inv.status] || 'bg-gray-100 text-gray-700'}`}
          >
            {statusLabels[inv.status] || inv.status}
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-800 line-clamp-2">{inv.service_type || 'General Service'}</p>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Calendar className="w-3 h-3 shrink-0" />
        {formatDate(inv.issue_date)}
      </div>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(invoiceTotalDollars(inv))}</p>
      {inv.status !== 'paid' && inv.status !== 'cancelled' ? (
        <div className="flex gap-1 pt-1 border-t border-gray-100">
          <button
            type="button"
            title="Copy customer payment link"
            onClick={onCopyLink}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Link2 className="w-3.5 h-3.5" />
            Link
          </button>
          <button
            type="button"
            title="Open Stripe Checkout"
            onClick={onStaffCheckout}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Pay
          </button>
        </div>
      ) : null}
    </article>
  );
}

const KANBAN_STATUSES: Invoice['status'][] = ['pending', 'paid', 'overdue', 'cancelled'];

function KanbanDroppableColumn({
  id,
  label,
  hint,
  count,
  children,
}: {
  id: Invoice['status'];
  label: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-100/80">
      <div className="rounded-t-xl border-b border-gray-200/80 bg-white/90 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
          <span className="text-xs font-medium tabular-nums text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-3 p-3 overflow-y-auto max-h-[min(65vh,520px)] min-h-[200px] rounded-b-xl transition-colors ${
          isOver ? 'bg-blue-50/90 ring-2 ring-blue-200/80 ring-inset' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function DraggableKanbanCard({
  inv,
  formatCurrency,
  formatDate,
  onCopyLink,
  onStaffCheckout,
  onEdit,
  onDelete,
}: {
  inv: Invoice;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onCopyLink: () => void;
  onStaffCheckout: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: inv.id,
    data: { invoice: inv },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <InvoiceCard
        inv={inv}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        onCopyLink={onCopyLink}
        onStaffCheckout={onStaffCheckout}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 touch-none"
            aria-label="Drag to change column"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        }
      />
    </div>
  );
}

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalState>({ open: false });
  const [statusDraft, setStatusDraft] = useState<Invoice['status']>('pending');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([emptyDraftLine()]);
  const [taxStr, setTaxStr] = useState('0');
  const [activeDrag, setActiveDrag] = useState<Invoice | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/invoices?limit=200');
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setInvoices(data.invoices || []);
    } catch {
      setError('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (!invoiceModal.open) return;
    let cancelled = false;
    (async () => {
      try {
        const [custRes, catRes] = await Promise.all([
          fetch('/api/customers?limit=500'),
          fetch('/api/estimates/catalog-services'),
        ]);
        const custData = await custRes.json();
        const catData = await catRes.json();
        if (!cancelled && custData.customers) {
          setCustomers(
            (custData.customers as Record<string, unknown>[]).map((c) => ({
              id: String(c.id),
              name: String(c.name || ''),
              phone: c.phone != null ? String(c.phone) : null,
              email: c.email != null ? String(c.email) : null,
            })),
          );
        }
        if (!cancelled && catData.services) {
          setCatalogServices((catData.services as CatalogService[]) || []);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceModal.open]);

  useEffect(() => {
    if (!invoiceModal.open || invoiceModal.mode !== 'edit') return;
    const inv = invoiceModal.invoice;
    setFormError('');
    setCustomerMode('existing');
    setCustomerId(inv.customer_id || '');
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setTaxStr(String(inv.tax ?? 0));
    setStatusDraft(inv.status);
    setLines(draftLinesFromInvoice(inv, catalogServices));
  }, [invoiceModal, catalogServices]);

  function resetNewForm() {
    setFormError('');
    setCustomerMode('existing');
    setCustomerId('');
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setLines([emptyDraftLine()]);
    setTaxStr('0');
    setStatusDraft('pending');
  }

  function setLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onLineCatalogChange(key: string, catalogId: string) {
    if (catalogId === '' || catalogId === '__custom__') {
      setLine(key, {
        catalogId,
        customName: catalogId === '__custom__' ? '' : '',
        unitPriceStr: '',
        description: '',
      });
      return;
    }
    const svc = catalogServices.find((s) => s.id === catalogId);
    if (!svc) return;
    setLine(key, {
      catalogId,
      customName: svc.name,
      unitPriceStr: (svc.unit_price_cents / 100).toFixed(2),
      description: svc.description?.trim() || '',
    });
  }

  const draftSubtotalCents = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = Math.max(0.0001, parseFloat(line.quantity) || 1);
      const unit = lineUnitCents(line, catalogServices);
      return sum + Math.round(qty * unit);
    }, 0);
  }, [lines, catalogServices]);

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceModal.open || saving) return;
    setFormError('');
    const tax = Number(taxStr);
    if (!Number.isFinite(tax) || tax < 0) {
      setFormError('Tax must be zero or positive.');
      return;
    }
    if (invoiceModal.mode === 'create') {
      if (customerMode === 'existing') {
        if (!customerId) {
          setFormError('Select a customer or switch to “New customer”.');
          return;
        }
      } else if (!newName.trim()) {
        setFormError('Customer name is required.');
        return;
      }
    } else if (!customerId) {
      setFormError('Select a customer.');
      return;
    }

    const lineItems: Array<{
      name: string;
      description: string | null;
      quantity: number;
      unit_price_cents: number;
      catalog_service_id: string | null;
    }> = [];

    for (const line of lines) {
      const qty = Math.max(0.0001, parseFloat(line.quantity) || 1);
      const unitCents = lineUnitCents(line, catalogServices);
      const name = lineDisplayName(line, catalogServices);
      if (!name || unitCents <= 0) continue;

      let description: string | null = null;
      let catalog_service_id: string | null = null;
      if (line.catalogId && line.catalogId !== '__custom__') {
        const svc = catalogServices.find((s) => s.id === line.catalogId);
        description = svc?.description?.trim() || null;
        catalog_service_id = line.catalogId;
      } else {
        description = line.description.trim() || null;
      }

      lineItems.push({
        name,
        description,
        quantity: qty,
        unit_price_cents: unitCents,
        catalog_service_id,
      });
    }

    if (lineItems.length === 0) {
      setFormError('Add at least one line with a service and price (catalog or custom).');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        line_items: lineItems,
        tax,
      };

      if (customerMode === 'existing') {
        body.customer_id = customerId;
      } else {
        body.customer_name = newName.trim();
        body.customer_phone = newPhone.trim() || 'Unknown';
        body.customer_email = newEmail.trim() || null;
      }

      if (invoiceModal.mode === 'create') {
        body.status = 'pending';
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || 'Could not create invoice');
          return;
        }
      } else {
        body.id = invoiceModal.invoice.id;
        body.status = statusDraft;
        const res = await fetch('/api/invoices', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || 'Could not update invoice');
          return;
        }
      }

      setInvoiceModal({ open: false });
      resetNewForm();
      await loadInvoices();
    } catch {
      setFormError('Request failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(inv: Invoice) {
    if (!window.confirm(`Delete ${inv.invoice_number}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/invoices?id=${encodeURIComponent(inv.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not delete invoice');
        return;
      }
      await loadInvoices();
    } catch {
      alert('Could not delete invoice');
    }
  }

  const searchFiltered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return invoices.filter((inv) => {
      const customerName = inv.customers?.name || '';
      if (!q) return true;
      return (
        customerName.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.service_type || '').toLowerCase().includes(q)
      );
    });
  }, [invoices, search]);

  const kanbanColumns = useMemo(() => {
    const pending = searchFiltered.filter((i) => i.status === 'pending');
    const paid = searchFiltered.filter((i) => i.status === 'paid');
    const overdue = searchFiltered.filter((i) => i.status === 'overdue');
    const cancelled = searchFiltered.filter((i) => i.status === 'cancelled');
    return [
      { id: 'pending' as const, label: 'Pending', items: pending, hint: 'Awaiting payment' },
      { id: 'paid' as const, label: 'Paid', items: paid, hint: 'Completed' },
      { id: 'overdue' as const, label: 'Overdue', items: overdue, hint: 'Past due' },
      { id: 'cancelled' as const, label: 'Cancelled', items: cancelled, hint: 'Voided' },
    ];
  }, [searchFiltered]);

  const stats = useMemo(() => {
    const sumByStatus = (status: Invoice['status']) =>
      invoices
        .filter((invoice) => invoice.status === status)
        .reduce((sum, invoice) => sum + invoiceTotalDollars(invoice), 0);

    const countByStatus = (status: Invoice['status']) =>
      invoices.filter((invoice) => invoice.status === status).length;

    return {
      total: invoices.length,
      pending: { count: countByStatus('pending'), amount: sumByStatus('pending') },
      paid: { count: countByStatus('paid'), amount: sumByStatus('paid') },
      overdue: { count: countByStatus('overdue'), amount: sumByStatus('overdue') },
    };
  }, [invoices]);

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  async function copyPayLink(inv: Invoice) {
    const token = inv.public_pay_token;
    if (!token) {
      alert('This invoice has no public pay link yet.');
      return;
    }
    const url = `${window.location.origin}/pay/invoice/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Customer payment link copied to clipboard.');
    } catch {
      prompt('Copy this link:', url);
    }
  }

  async function openStaffCheckout(inv: Invoice) {
    try {
      const res = await fetch(`/api/invoices/${inv.id}/checkout`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error || 'Could not start checkout');
        return;
      }
      if (j.url) window.open(j.url as string, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Could not start checkout');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const inv = event.active.data.current?.invoice as Invoice | undefined;
    setActiveDrag(inv ?? null);
  }

  function handleDragCancel() {
    setActiveDrag(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const invId = String(active.id);
    const newStatus = over.id as string;
    if (!KANBAN_STATUSES.includes(newStatus as Invoice['status'])) return;
    const nextStatus = newStatus as Invoice['status'];

    const inv = invoices.find((i) => i.id === invId);
    if (!inv || inv.status === nextStatus) return;

    const previousInvoices = invoices;
    setInvoices((prev) =>
      prev.map((i) => (i.id === invId ? { ...i, status: nextStatus } : i)),
    );

    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invId, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update status');
      if (data.invoice) {
        setInvoices((prev) =>
          prev.map((i) => {
            if (i.id !== invId) return i;
            const merged = { ...i, ...data.invoice } as Invoice;
            return merged.customers ? merged : { ...merged, customers: i.customers };
          }),
        );
      }
    } catch (e) {
      setInvoices(previousInvoices);
      alert(e instanceof Error ? e.message : 'Could not move invoice');
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
      <main className="flex-1 min-h-0 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
            <p className="text-gray-500 text-sm">Manage and track your invoices</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                resetNewForm();
                setInvoiceModal({ open: true, mode: 'create' });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" />
              New invoice
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm w-64 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <div className="p-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-sm">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.total}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-sm">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{loading ? '...' : formatCurrency(stats.pending.amount)}</p>
              <p className="text-xs text-gray-500">{loading ? '...' : stats.pending.count} invoices</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-sm">Paid</p>
              <p className="text-2xl font-bold text-green-600">{loading ? '...' : formatCurrency(stats.paid.amount)}</p>
              <p className="text-xs text-gray-500">{loading ? '...' : stats.paid.count} invoices</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-gray-500 text-sm">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{loading ? '...' : formatCurrency(stats.overdue.amount)}</p>
              <p className="text-xs text-gray-500">{loading ? '...' : stats.overdue.count} invoices</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Kanban */}
          {loading ? (
            <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm text-center text-gray-500">
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-gray-200 bg-white">
              <p className="text-gray-600 mb-4">No invoices yet.</p>
              <button
                type="button"
                onClick={() => {
                  resetNewForm();
                  setInvoiceModal({ open: true, mode: 'create' });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                <Plus className="w-4 h-4" />
                Create invoice
              </button>
            </div>
          ) : searchFiltered.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-gray-200 bg-white text-gray-600">
              No invoices match your search.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={(e) => void handleDragEnd(e)}
              onDragCancel={handleDragCancel}
            >
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 min-h-[min(70vh,560px)]">
                {kanbanColumns.map((col) => (
                  <KanbanDroppableColumn
                    key={col.id}
                    id={col.id}
                    label={col.label}
                    hint={col.hint}
                    count={col.items.length}
                  >
                    {col.items.map((inv) => (
                      <DraggableKanbanCard
                        key={inv.id}
                        inv={inv}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                        onCopyLink={() => void copyPayLink(inv)}
                        onStaffCheckout={() => void openStaffCheckout(inv)}
                        onEdit={() => setInvoiceModal({ open: true, mode: 'edit', invoice: inv })}
                        onDelete={() => void deleteInvoice(inv)}
                      />
                    ))}
                    {col.items.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-6 px-2">No invoices — drop here</p>
                    ) : null}
                  </KanbanDroppableColumn>
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xl max-w-[260px] pointer-events-none">
                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                      {activeDrag.invoice_number}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {activeDrag.customers?.name || 'Unknown customer'}
                    </p>
                    <p className="text-lg font-bold text-gray-900 tabular-nums mt-2">
                      {formatCurrency(invoiceTotalDollars(activeDrag))}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>

      {invoiceModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {invoiceModal.mode === 'create' ? 'New invoice' : 'Edit invoice'}
              </h2>
              <button
                type="button"
                onClick={() => setInvoiceModal({ open: false })}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitInvoice} className="p-6 space-y-4">
              {invoiceModal.mode === 'create' ? (
                <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium rounded-md ${
                      customerMode === 'existing' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                    }`}
                    onClick={() => setCustomerMode('existing')}
                  >
                    Existing customer
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium rounded-md ${
                      customerMode === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                    }`}
                    onClick={() => setCustomerMode('new')}
                  >
                    New customer
                  </button>
                </div>
              ) : null}

              {invoiceModal.mode === 'edit' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value as Invoice['status'])}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ) : null}

              {customerMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    required={customerMode === 'existing'}
                  >
                    <option value="">Select…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 ? (
                    <p className="text-xs text-amber-700 mt-1">
                      No customers found. Add one under Customers or use “New customer”.
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                        placeholder="(555) …"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                        placeholder="optional"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">Line items</label>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/crm/service-catalog"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setInvoiceModal({ open: false })}
                    >
                      Manage catalog
                    </Link>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => [...prev, emptyDraftLine()])}
                      className="text-xs font-medium text-gray-700 hover:text-gray-900 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add line
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[min(52vh,420px)] overflow-y-auto pr-1">
                  {lines.map((line, idx) => (
                    <div
                      key={line.key}
                      className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-500">Line {idx + 1}</span>
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                            className="p-1 rounded text-gray-500 hover:bg-gray-200 hover:text-red-600"
                            title="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                      <select
                        value={line.catalogId}
                        onChange={(e) => onLineCatalogChange(line.key, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white"
                      >
                        <option value="">Select catalog service…</option>
                        {catalogServices.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({formatMoney(s.unit_price_cents)})
                          </option>
                        ))}
                        <option value="__custom__">Custom service…</option>
                      </select>
                      {line.catalogId === '__custom__' ? (
                        <input
                          value={line.customName}
                          onChange={(e) => setLine(line.key, { customName: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white"
                          placeholder="Service name"
                        />
                      ) : null}
                      {line.catalogId && line.catalogId !== '__custom__' && line.description ? (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{line.description}</p>
                      ) : null}
                      {line.catalogId === '__custom__' ? (
                        <textarea
                          value={line.description}
                          onChange={(e) => setLine(line.key, { description: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800 bg-white min-h-[48px]"
                          placeholder="Optional details"
                        />
                      ) : null}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] uppercase text-gray-500">Qty</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={line.quantity}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 font-mono bg-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase text-gray-500">Unit price (USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitPriceStr}
                            onChange={(e) => setLine(line.key, { unitPriceStr: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 font-mono bg-white"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {catalogServices.length === 0 && invoiceModal.open ? (
                  <p className="text-xs text-amber-700 mt-2">
                    No catalog items yet.{' '}
                    <Link href="/crm/service-catalog" className="underline" onClick={() => setInvoiceModal({ open: false })}>
                      Add services
                    </Link>{' '}
                    or use Custom on each line.
                  </p>
                ) : null}
                <div className="mt-3 flex justify-between text-sm border-t border-gray-200 pt-3">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-mono font-medium text-gray-900">{formatMoney(draftSubtotalCents)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxStr}
                  onChange={(e) => setTaxStr(e.target.value)}
                  className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Total due:{' '}
                  <span className="font-mono font-semibold text-gray-900">
                    {formatMoney(draftSubtotalCents + Math.round((Number(taxStr) || 0) * 100))}
                  </span>
                </p>
              </div>

              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInvoiceModal({ open: false })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving
                    ? invoiceModal.mode === 'create'
                      ? 'Creating…'
                      : 'Saving…'
                    : invoiceModal.mode === 'create'
                      ? 'Create invoice'
                      : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
