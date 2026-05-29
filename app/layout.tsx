import "./globals.css";

export const metadata = {
  title: "東京フラワーポート㈱ 発注アプリ",
  description: "スマホ発注システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}