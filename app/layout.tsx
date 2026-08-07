import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StayEngine",
  description: "Booking engines for independent hotels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
