import { redirect } from "next/navigation";
import { DemoServiceDeskApp } from "./demo-service-desk-app";
import { ServiceDeskApp } from "./service-desk-app";
import { toUiTicket } from "./prototype-data";
import { getCategories, getTickets, recordLogin, requireViewer } from "@/lib/dal";
import { isAppConfigured } from "@/lib/env";
import { isDemoMode } from "@/lib/demo-mode";
import { issueCsrfToken } from "@/lib/security";

export const dynamic = "force-dynamic";

function ConfigurationRequired() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="brand-mark" aria-hidden="true">S</span>
        <p className="eyebrow">Настройка окружения</p>
        <h1>Service Desk Lite готов к подключению</h1>
        <p>Добавьте переменные Auth0 и Supabase из файла <code>.env.example</code>, примените миграцию и перезапустите приложение.</p>
        <div className="safety-note"><span aria-hidden="true">!</span><p><strong>Секреты не вводятся в интерфейсе.</strong> Храните их только в локальном окружении или Vercel Environment Variables.</p></div>
      </section>
    </main>
  );
}

export default async function Page() {
  if (isDemoMode()) return <DemoServiceDeskApp />;
  if (!isAppConfigured()) return <ConfigurationRequired />;

  let viewer;
  try {
    viewer = await requireViewer();
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/auth/login?returnTo=/");
    throw error;
  }

  const requestId = crypto.randomUUID();
  const [ticketRecords, categoryRecords] = await Promise.all([getTickets(viewer), getCategories(viewer)]);
  await recordLogin(viewer, requestId);

  return (
    <ServiceDeskApp
      initialTickets={ticketRecords.map(toUiTicket)}
      categories={categoryRecords.map((category) => ({ id: category.id, name: category.name, isActive: category.is_active }))}
      viewer={{ id: viewer.profile.id, displayName: viewer.profile.display_name, email: viewer.profile.email, role: viewer.profile.role }}
      csrfToken={issueCsrfToken(viewer.subject)}
    />
  );
}
