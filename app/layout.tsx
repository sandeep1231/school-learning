import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import Header from "@/components/layout/Header";
import SiteFooter from "@/components/layout/SiteFooter";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import ConsentBanner from "@/components/analytics/ConsentBanner";
import { RouteProgress } from "@/components/ui/Spinner";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Sikhya Sathi · BSE Odisha Class 9 AI Tutor",
    template: "%s · Sikhya Sathi",
  },
  description:
    "Daily AI home-tutor for BSE Odisha Class 9 students, grounded in the official syllabus. Lessons, practice, and spaced-repetition review in Odia, Hindi, and English.",
  applicationName: "Sikhya Sathi",
  keywords: [
    "BSE Odisha",
    "Class 9",
    "AI tutor",
    "Odia learning",
    "Sikhya Sathi",
    "Madhyamik",
    "Board exam preparation",
  ],
  authors: [{ name: "Sikhya Sathi" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sikhya Sathi",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Sikhya Sathi",
    title: "Sikhya Sathi · BSE Odisha Class 9 AI Tutor",
    description:
      "Daily AI home-tutor grounded in the BSE Odisha Class 9 syllabus.",
    locale: "or_IN",
    alternateLocale: ["en_IN", "hi_IN"],
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Sikhya Sathi",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Sikhya Sathi · BSE Odisha Class 9 AI Tutor",
    description:
      "Daily AI home-tutor grounded in the BSE Odisha Class 9 syllabus.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <head>
        {/*
          Phase 15 — pre-hydration theme script. Runs before React mounts
          so dark-mode users never see a white flash. Reads localStorage
          (sikhya.theme = light|dark|system, default system) and toggles
          the `dark` class on <html>.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('sikhya.theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <RouteProgress />
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Header />
          <div id="main-content" tabIndex={-1} className="outline-none">
            {children}
          </div>
          <SiteFooter />
          <RegisterServiceWorker />
          <AnalyticsProvider />
          <ConsentBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
