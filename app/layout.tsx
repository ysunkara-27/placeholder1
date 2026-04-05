import type { Metadata } from "next";
import localFont from "next/font/local";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { SiteNavbar } from "@/components/navigation/site-navbar";

const ramboia = localFont({
  src: "../RamboiaTest-Regular.otf",
  variable: "--font-ramboia",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Twin — Your application agent for internship season.",
  description:
    "Build your profile once. Get text updates when jobs drop. Queue applications from your dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${ramboia.variable} ${fraunces.variable} min-h-screen`}>
        <SiteNavbar />
        {children}
      </body>
    </html>
  );
}
