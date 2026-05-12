export const clerkMarketingAppearance = {
  variables: {
    colorPrimary: '#2f6b4f',
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
    card: 'bg-white border border-slate-200 shadow-lg shadow-slate-200/60',
    header: 'hidden',
    headerTitle: 'text-slate-950',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButton:
      'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-sm',
    dividerLine: 'bg-slate-200',
    dividerText: 'text-slate-500',
    formFieldLabel: 'text-slate-700',
    formFieldInput:
      'bg-white text-slate-950 border-slate-300 placeholder:text-slate-400 focus:border-[#2f6b4f] focus:ring-[#2f6b4f]',
    formButtonPrimary:
      'bg-[#2f6b4f] text-white shadow-none hover:bg-[#24553f]',
    footer: 'bg-slate-50 border-t border-slate-200',
    footerActionText: 'text-slate-600',
    footerActionLink: 'text-[#2f6b4f] font-semibold hover:text-[#24553f]',
    identityPreviewText: 'text-slate-900',
    formFieldInputShowPasswordButton: 'text-slate-500',
  },
} as const;
