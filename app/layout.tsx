import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visual Atlas — Ideas in Motion",
  description: "Interactive visualizations for physics, computing, and the invisible systems around us.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
