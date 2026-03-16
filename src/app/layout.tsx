import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flower Proposal System",
  description: "花き提案回収システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}