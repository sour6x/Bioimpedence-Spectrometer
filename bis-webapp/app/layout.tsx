import type { Metadata } from "next";
import "./workspace.css";



export const metadata: Metadata = {
  title: "BIS Wearable",
  description: "Bioimpedance Spectroscopy Measurement System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
