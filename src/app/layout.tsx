import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { absoluteUrl, getSiteUrl } from "@/lib/marketing/site";
import { ConsentManager } from "@/components/consent/ConsentManager";

const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to WNY Automation Portal',
      subtitle: 'Use your company account to access the CRM workspace.',
      titleCombined: 'Sign in to WNY Automation Portal',
      subtitleCombined: 'Use your company account to access the CRM workspace.',
    },
    password: {
      title: 'Enter your WNY Automation Portal password',
      subtitle: 'Continue to your secure workspace.',
    },
  },
  signUp: {
    start: {
      title: 'Create your WNY Automation Portal account',
      subtitle: 'Create an account for your company workspace.',
      titleCombined: 'Create your WNY Automation Portal account',
      subtitleCombined: 'Create an account for your company workspace.',
    },
  },
} as const;

const clerkProxyUrl =
  process.env.NEXT_PUBLIC_CLERK_PROXY_URL || "https://wnyautomation.com/clerk-proxy";

const appSans = Manrope({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const appMono = IBM_Plex_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "WNY Automation Portal",
  description:
    "WNY Automation Portal gives clients one secure place to manage automations, leads, workflows, reporting, and account activity.",
  metadataBase: new URL(getSiteUrl()),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "WNY Automation Portal",
    description:
      "Manage WNY Automation workflows, leads, reporting, and account activity.",
    siteName: "WNY Automation Portal",
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "WNY Automation Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WNY Automation Portal",
    description:
      "Manage WNY Automation workflows, leads, reporting, and account activity.",
    images: [absoluteUrl("/twitter-image")],
  },
};

export const viewport: Viewport = {
  themeColor: "#0E1A2B",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${appSans.variable} ${appMono.variable} antialiased min-h-screen flex flex-col bg-white`}
      >
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          localization={clerkLocalization}
          proxyUrl={clerkProxyUrl}
        >
          <div className="flex-1 min-h-0">{children}</div>
          <ConsentManager />
        </ClerkProvider>
      </body>
    </html>
  );
}
