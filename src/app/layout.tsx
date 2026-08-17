import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { getServerSession } from "next-auth";
import { Providers } from "@/components/Providers";
import { authOptions } from "@/lib/auth";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Chay Ops | SE-BIOP",
  description:
    "Small Enterprise Business Intelligence & Operations Platform for Philippine businesses.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Chay Ops",
  },
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
