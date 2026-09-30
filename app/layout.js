import "./globals.css";
import { Fraunces, Figtree } from "next/font/google";
import Providers from "./providers";
const head = Fraunces({ subsets: ["latin"], variable: "--font-head" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
export const metadata = { title: "Family Finance", description: "Income, expenses and savings for our household" };
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${head.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
