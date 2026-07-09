import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Light Clock — See Time Dilation",
  description: "An interactive photon-clock experiment that makes relativistic time dilation visible.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
