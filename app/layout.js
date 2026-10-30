import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata = {
  title: "Veri Burada",
  description: "Veri Burada yönetim ve müşteri paneli",
  icons: {
    icon: "/logo-tek.webp",
    apple: "/logo-tek.webp",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
