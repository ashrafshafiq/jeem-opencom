import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@opencom/ui/globals.css";
import { BRAND_NAME } from "@opencom/ui";
import { ConvexClientProvider } from "@/components/convex-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Dashboard`,
  description: "Class reminders and customer messaging, powered by Aya",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
