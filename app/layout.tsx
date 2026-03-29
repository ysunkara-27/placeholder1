import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoApply — Apply once. Get hired faster.",
  description:
    "Build your profile once. Get alerted when jobs drop. Apply with one reply.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
