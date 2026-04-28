// Shared status color utilities for WNY Automation Portal
// Centralizes all status colors to ensure consistency across the app

export interface StatusColor {
  bg: string;
  text: string;
  border?: string;
}

// Lead status colors
export const leadStatusColors: Record<string, StatusColor> = {
  new: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  qualified: { bg: '#f3e8ff', text: '#7c3aed', border: '#c4b5fd' },
  quoted: { bg: '#fef9c3', text: '#a16207', border: '#fde047' },
  booked: { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  in_progress: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
  completed: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  lost: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
};

// Job status colors
export const jobStatusColors: Record<string, StatusColor> = {
  scheduled: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  in_progress: { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
  completed: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  cancelled: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
};

// Invoice status colors
export const invoiceStatusColors: Record<string, StatusColor> = {
  draft: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  sent: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  paid: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  overdue: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
};

// Priority colors
export const priorityColors: Record<number, StatusColor> = {
  1: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' }, // Urgent
  2: { bg: '#ffedd5', text: '#ea580c', border: '#fdba74' }, // Hot
  3: { bg: '#fef9c3', text: '#ca8a04', border: '#fde047' }, // Normal
  4: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' }, // Low
  5: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' }, // Very Low
};

// Source colors
export const sourceColors: Record<string, StatusColor> = {
  website: { bg: '#dbeafe', text: '#1d4ed8' },
  phone: { bg: '#dcfce7', text: '#15803d' },
  thumbtack: { bg: '#fef3c7', text: '#b45309' },
  angi: { bg: '#f3e8ff', text: '#7c3aed' },
  google: { bg: '#dbeafe', text: '#1d4ed8' },
  referral: { bg: '#ffedd5', text: '#c2410c' },
};

// Helper function to get style object for a status
export function getStatusStyle(status: string, type: 'lead' | 'job' | 'invoice' = 'lead'): React.CSSProperties {
  const colors = type === 'lead' ? leadStatusColors : type === 'job' ? jobStatusColors : invoiceStatusColors;
  const color = colors[status] || { bg: '#f3f4f6', text: '#6b7280' };
  return {
    backgroundColor: color.bg,
    color: color.text,
    borderColor: color.border || color.bg,
  };
}

// Helper function to get Tailwind classes for a status
export function getStatusClasses(status: string, type: 'lead' | 'job' | 'invoice' = 'lead'): string {
  const classMap: Record<string, Record<string, string>> = {
    lead: {
      new: 'bg-blue-100 text-blue-700 border-blue-200',
      qualified: 'bg-purple-100 text-purple-700 border-purple-200',
      quoted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      booked: 'bg-orange-100 text-orange-700 border-orange-200',
      in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      lost: 'bg-red-100 text-red-700 border-red-200',
    },
    job: {
      scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
      in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    },
    invoice: {
      draft: 'bg-gray-100 text-gray-700 border-gray-200',
      sent: 'bg-blue-100 text-blue-700 border-blue-200',
      paid: 'bg-green-100 text-green-700 border-green-200',
      overdue: 'bg-red-100 text-red-700 border-red-200',
      cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    },
  };
  
  return classMap[type][status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

// Status labels
export const leadStatusLabels: Record<string, string> = {
  new: 'New',
  qualified: 'Qualified',
  quoted: 'Quoted',
  booked: 'Booked',
  in_progress: 'In Progress',
  completed: 'Completed',
  lost: 'Lost',
};

export const jobStatusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const invoiceStatusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

// Source labels with icons
export const sourceLabels: Record<string, { label: string; icon: string }> = {
  website: { label: 'Website', icon: '🌐' },
  phone: { label: 'Phone', icon: '📞' },
  thumbtack: { label: 'Thumbtack', icon: '🔧' },
  angi: { label: 'Angi', icon: '🏠' },
  google: { label: 'Google', icon: '🔍' },
  referral: { label: 'Referral', icon: '👥' },
};

// Priority labels
export const priorityLabels: Record<number, { label: string; icon: string }> = {
  1: { label: 'Urgent', icon: '⚡' },
  2: { label: 'Hot', icon: '🔥' },
  3: { label: 'Normal', icon: '' },
  4: { label: 'Low', icon: '' },
  5: { label: 'Very Low', icon: '' },
};
