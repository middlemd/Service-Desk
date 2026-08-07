import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const rawHost = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost) ? rawHost : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "https" ? "https" : host.startsWith("localhost") ? "http" : "https";
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    title: "Service Desk Lite — внутренние заявки",
    description: "Защищённая система внутренних заявок с очередями и SLA.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Service Desk Lite",
      description: "Внутренние заявки под контролем",
      images: [{ url: socialImage, width: 1734, height: 907, alt: "Service Desk Lite — интерфейс системы заявок" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Service Desk Lite",
      description: "Внутренние заявки под контролем",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
