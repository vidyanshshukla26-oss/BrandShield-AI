import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "BrandShield AI", description: "Protect your brand before you publish." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
