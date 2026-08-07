"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AuditView,
  CreateTicketModal,
  Overview,
  SettingsView,
  TicketDrawer,
  TicketsView,
  UsersView,
} from "./prototype-components";
import {
  navByRole,
  CategoryOption,
  Role,
  roleConfig,
  Ticket,
  TicketStatus,
  View,
} from "./prototype-data";
import type { Priority as ApiPriority, TicketRecord } from "@/lib/types";
import { toUiTicket } from "./prototype-data";

type ViewerInfo = { id: string; displayName: string; email: string; role: Role };

export function ServiceDeskApp({ initialTickets, categories, viewer, csrfToken }: { initialTickets: Ticket[]; categories: CategoryOption[]; viewer: ViewerInfo; csrfToken: string }) {
  const role = viewer.role;
  const [view, setView] = useState<View>("overview");
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Все статусы" | TicketStatus>("Все статусы");
  const [categoryFilter, setCategoryFilter] = useState("Все категории");
  const [toast, setToast] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogKey = isCreateOpen ? "create" : selectedTicket?.recordId ?? "";

  const scopedTickets = tickets;
  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ru");
    return scopedTickets.filter((ticket) => {
      const matchesSearch = !normalizedSearch || `${ticket.id} ${ticket.subject} ${ticket.author}`.toLocaleLowerCase("ru").includes(normalizedSearch);
      const matchesStatus = statusFilter === "Все статусы" || ticket.status === statusFilter;
      const matchesCategory = categoryFilter === "Все категории" || ticket.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, scopedTickets, search, statusFilter]);

  useEffect(() => {
    if (!dialogKey) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = closeButtonRef.current?.closest<HTMLElement>('[role="dialog"]');
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTicket(null);
        setCreateOpen(false);
        return;
      }
      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [dialogKey]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const priorityMap: Record<string, ApiPriority> = { Низкий: "low", Средний: "medium", Высокий: "high" };
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({
        subject: String(form.get("subject") || ""),
        description: String(form.get("description") || ""),
        categoryId: String(form.get("category") || ""),
        priority: priorityMap[String(form.get("priority"))] ?? "medium",
      }),
    });
    if (!response.ok) {
      setToast("Не удалось создать заявку. Проверьте поля.");
      return;
    }
    const payload = (await response.json()) as { ticket: TicketRecord };
    const category = categories.find((item) => item.id === payload.ticket.category_id);
    const nextTicket = toUiTicket({ ...payload.ticket, categories: { name: category?.name ?? "Без категории" }, author: { display_name: viewer.displayName }, assignee: null });
    setTickets((current) => [nextTicket, ...current]);
    setCreateOpen(false);
    setView("tickets");
    setToast(`Заявка ${nextTicket.id} создана`);
  };

  const takeTicket = async (ticket: Ticket) => {
    const response = await fetch(`/api/tickets/${ticket.recordId}/claim`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: "{}" });
    if (!response.ok) {
      setToast("Не удалось взять заявку в работу.");
      return;
    }
    const updated = { ...ticket, owner: viewer.displayName, status: "В работе" as const };
    setTickets((current) => current.map((item) => item.id === ticket.id ? updated : item));
    setSelectedTicket(updated);
    setToast(`Заявка ${ticket.id} назначена вам`);
  };

  const transitionTicket = async (ticket: Ticket, status: "in_progress" | "waiting_for_user" | "resolved" | "closed") => {
    const response = await fetch(`/api/tickets/${ticket.recordId}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setToast("Переход статуса отклонён.");
      return;
    }
    const statusLabels: Record<typeof status, TicketStatus> = { in_progress: "В работе", waiting_for_user: "Ждёт ответа", resolved: "Решена", closed: "Закрыта" };
    const updated = { ...ticket, status: statusLabels[status] };
    setTickets((current) => current.map((item) => item.recordId === ticket.recordId ? updated : item));
    setSelectedTicket(updated);
    setToast(`Статус ${ticket.id} обновлён`);
  };

  const viewTitle = view === "overview"
    ? "Обзор"
    : view === "tickets"
      ? role === "user" ? "Мои заявки" : role === "specialist" ? "Очередь заявок" : "Все заявки"
      : view === "users" ? "Пользователи" : view === "settings" ? "Категории и SLA" : "Журнал действий";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span><strong>Service Desk</strong><small>Lite</small></span>
        </div>

        <nav className="main-nav" aria-label="Основная навигация">
          <p className="nav-kicker">Рабочее пространство</p>
          {navByRole[role].map((item) => (
            <button className={view === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => setView(item.id)} type="button">
              <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
              {item.label}
              {item.id === "tickets" && <span className="nav-count">{scopedTickets.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-note"><span aria-hidden="true">✓</span><p><strong>Защищённая сессия</strong>Роль и доступ проверяются сервером и политиками базы данных.</p></div>
          <div className="role-switcher">
            <div className="profile-button">
              <span className="avatar" aria-hidden="true">{viewer.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
              <span className="profile-copy"><strong>{viewer.displayName}</strong><small>{roleConfig[role].label}</small></span>
              <a className="logout-link" href="/auth/logout" aria-label="Выйти">↗</a>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark" aria-hidden="true">S</span><strong>Service Desk Lite</strong></div>
          <div className="breadcrumb"><span>Рабочее пространство</span><span aria-hidden="true">/</span><strong>{viewTitle}</strong></div>
          <div className="top-actions">
            <span className="demo-chip">{roleConfig[role].label}</span>
            {role === "user" && <button className="primary-button compact" type="button" onClick={() => setCreateOpen(true)}><span aria-hidden="true">＋</span> Новая заявка</button>}
          </div>
        </header>

        <div className="page-content">
          {view === "overview" && <Overview role={role} tickets={scopedTickets} onCreate={() => setCreateOpen(true)} onOpenTicket={setSelectedTicket} onShowTickets={() => setView("tickets")} />}
          {view === "tickets" && <TicketsView role={role} tickets={filteredTickets} categories={categories} total={scopedTickets.length} search={search} statusFilter={statusFilter} categoryFilter={categoryFilter} onSearch={setSearch} onStatus={setStatusFilter} onCategory={setCategoryFilter} onOpen={setSelectedTicket} onCreate={() => setCreateOpen(true)} onReset={() => { setSearch(""); setStatusFilter("Все статусы"); setCategoryFilter("Все категории"); }} />}
          {view === "users" && <UsersView csrfToken={csrfToken} />}
          {view === "settings" && <SettingsView csrfToken={csrfToken} />}
          {view === "audit" && <AuditView />}
        </div>
      </main>

      {isCreateOpen && <CreateTicketModal categories={categories} closeButtonRef={closeButtonRef} onClose={() => setCreateOpen(false)} onSubmit={handleCreateTicket} />}
      {selectedTicket && <TicketDrawer closeButtonRef={closeButtonRef} role={role} ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onTake={() => takeTicket(selectedTicket)} onTransition={(status) => transitionTicket(selectedTicket, status)} onComment={async (body, visibility) => {
        const response = await fetch(`/api/tickets/${selectedTicket.recordId}/comments`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ body, visibility }) });
        setToast(response.ok ? "Комментарий добавлен" : "Не удалось добавить комментарий");
        return response.ok;
      }} />}
      <div className={toast ? "toast visible" : "toast"} role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>
    </div>
  );
}
