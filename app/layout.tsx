import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteNavbar } from "@/components/navigation/site-navbar";

const ramboia = localFont({
  src: "../RamboiaTest-Regular.otf",
  variable: "--font-ramboia",
  display: "swap",
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
      <body className={`${ramboia.variable} min-h-screen`}>
        <SiteNavbar />
        {children}
      </body>
    </html>
  );
}
