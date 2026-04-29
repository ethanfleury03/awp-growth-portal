export const clerkMarketingAppearance = {
  variables: {
    colorPrimary: '#f26a1f',
    colorBackground: '#ffffff',
    colorText: '#101828',
    colorTextSecondary: '#667085',
    colorInputBackground: '#ffffff',
    colorInputText: '#101828',
    colorNeutral: '#667085',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    card: 'bg-white border border-slate-200 shadow-2xl shadow-slate-200/80',
    header: 'hidden',
    headerTitle: 'text-slate-950',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButton:
      'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-sm',
    dividerLine: 'bg-slate-200',
    dividerText: 'text-slate-500',
    formFieldLabel: 'text-slate-700',
    formFieldInput:
      'bg-white text-slate-950 border-slate-300 placeholder:text-slate-400 focus:border-[#f26a1f] focus:ring-[#f26a1f]',
    formButtonPrimary:
      'bg-gradient-to-r from-[#f26a1f] to-[#d95614] text-white shadow-lg shadow-orange-200/70 hover:from-[#e45f19] hover:to-[#c94e12]',
    footer: 'bg-slate-50 border-t border-slate-200',
    footerActionText: 'text-slate-600',
    footerActionLink: 'text-[#d95614] font-semibold hover:text-[#a93d0d]',
    identityPreviewText: 'text-slate-900',
    formFieldInputShowPasswordButton: 'text-slate-500',
  },
} as const;
