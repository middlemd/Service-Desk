"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CreateTicketModal,
  Overview,
  TicketDrawer,
  TicketsView,
} from "./prototype-components";
import {
  CategoryOption,
  navByRole,
  Priority,
  Role,
  roleConfig,
  Ticket,
  TicketStatus,
  View,
} from "./prototype-data";

const ROLE_STORAGE_KEY = "service-desk-lite.demo.role.v1";
const DATA_STORAGE_KEY = "service-desk-lite.demo.data.v1";

const DEMO_CATEGORIES: CategoryOption[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Доступы", isActive: true },
  { id: "22222222-2222-4222-8222-222222222222", name: "Рабочее место", isActive: true },
  { id: "33333333-3333-4333-8333-333333333333", name: "Учебные системы", isActive: true },
  { id: "44444444-4444-4444-8444-444444444444", name: "Корпоративная связь", isActive: true },
];

const DEMO_PROFILES: Record<Role, { displayName: string; email: string }> = {
  user: { displayName: "Мария Примерова", email: "maria.user@example.test" },
  specialist: { displayName: "Алексей Демо", email: "alex.specialist@example.test" },
  admin: { displayName: "Ирина Тестова", email: "irina.admin@example.test" },
};

const DEMO_TICKETS: Ticket[] = [
  {
    recordId: "a1111111-1111-4111-8111-111111111111",
    id: "DEMO-1042",
    subject: "Не открывается учебный портал",
    description: "После демонстрационного входа появляется сообщение о недоступности раздела.",
    category: "Учебные системы",
    categoryId: "33333333-3333-4333-8333-333333333333",
    priority: "Высокий",
    status: "В работе",
    author: "Мария Примерова",
    owner: "Алексей Демо",
    due: "42 мин",
    risk: true,
    created: "7 авг., 09:20",
  },
  {
    recordId: "a2222222-2222-4222-8222-222222222222",
    id: "DEMO-1039",
    subject: "Нужен доступ к тестовой группе",
    description: "Просьба добавить демонстрационного пользователя в учебную группу проекта.",
    category: "Доступы",
    categoryId: "11111111-1111-4111-8111-111111111111",
    priority: "Средний",
    status: "Ждёт ответа",
    author: "Мария Примерова",
    owner: "Алексей Демо",
    due: "3 ч 15 мин",
    risk: false,
    created: "6 авг., 16:45",
  },
  {
    recordId: "a3333333-3333-4333-8333-333333333333",
    id: "DEMO-1036",
    subject: "Не подключается тестовый монитор",
    description: "На демонстрационном рабочем месте второй монитор не определяется системой.",
    category: "Рабочее место",
    categoryId: "22222222-2222-4222-8222-222222222222",
    priority: "Средний",
    status: "Новая",
    author: "Павел Макетов",
    owner: "Не назначен",
    due: "5 ч 40 мин",
    risk: false,
    created: "6 авг., 14:10",
  },
  {
    recordId: "a4444444-4444-4444-8444-444444444444",
    id: "DEMO-1031",
    subject: "Обновить подпись в тестовой почте",
    description: "Нужно заменить демонстрационную должность в подписи учебного аккаунта.",
    category: "Корпоративная связь",
    categoryId: "44444444-4444-4444-8444-444444444444",
    priority: "Низкий",
    status: "Решена",
    author: "Ольга Макетова",
    owner: "Алексей Демо",
    due: "В срок",
    risk: false,
    created: "5 авг., 11:30",
  },
];

const PRIORITIES: Priority[] = ["Низкий", "Средний", "Высокий", "Критический"];
const STATUSES: TicketStatus[] = ["Новая", "В работе", "Ждёт ответа", "Решена", "Закрыта", "Отменена"];

function isRole(value: unknown): value is Role {
  return value === "user" || value === "specialist" || value === "admin";
}

function isStoredTicket(value: unknown): value is Ticket {
  if (!value || typeof value !== "object") return false;
  const ticket = value as Partial<Ticket>;
  return typeof ticket.recordId === "string" && ticket.recordId.length <= 64
    && typeof ticket.id === "string" && ticket.id.length <= 30
    && typeof ticket.subject === "string" && ticket.subject.length >= 5 && ticket.subject.length <= 80
    && typeof ticket.description === "string" && ticket.description.length >= 10 && ticket.description.length <= 500
    && typeof ticket.categoryId === "string" && DEMO_CATEGORIES.some((category) => category.id === ticket.categoryId)
    && typeof ticket.category === "string" && ticket.category.length <= 80
    && PRIORITIES.includes(ticket.priority as Priority)
    && STATUSES.includes(ticket.status as TicketStatus)
    && typeof ticket.author === "string" && ticket.author.length <= 80
    && typeof ticket.owner === "string" && ticket.owner.length <= 80
    && typeof ticket.due === "string" && ticket.due.length <= 40
    && typeof ticket.created === "string" && ticket.created.length <= 80
    && typeof ticket.risk === "boolean";
}

function readStoredTickets() {
  try {
    const raw = window.localStorage.getItem(DATA_STORAGE_KEY);
    if (!raw) return DEMO_TICKETS;
    const parsed = JSON.parse(raw) as { version?: unknown; tickets?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.tickets)) return DEMO_TICKETS;
    const tickets = parsed.tickets.slice(0, 50).filter(isStoredTicket);
    return tickets.length ? tickets : DEMO_TICKETS;
  } catch {
    return DEMO_TICKETS;
  }
}

function DemoLogin({ onLogin }: { onLogin: (role: Role) => void }) {
  return (
    <main className="demo-login-page">
      <section className="demo-login-card" aria-labelledby="demo-login-title">
        <div className="demo-login-brand"><span className="brand-mark" aria-hidden="true">S</span><strong>Service Desk Lite</strong></div>
        <span className="demo-mode-pill">Демонстрационный режим</span>
        <h1 id="demo-login-title">Выберите роль для входа</h1>
        <p>Это локальная демонстрация, а не настоящая авторизация. Все записи вымышлены и остаются только в этом браузере.</p>
        <div className="demo-role-grid" aria-label="Демонстрационные роли">
          {(Object.keys(roleConfig) as Role[]).map((role) => (
            <button type="button" className="demo-role-card" key={role} onClick={() => onLogin(role)}>
              <span className="demo-role-icon" aria-hidden="true">{role === "user" ? "П" : role === "specialist" ? "С" : "А"}</span>
              <span><strong>{roleConfig[role].label}</strong><small>{roleConfig[role].description}</small></span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
        <div className="safety-note"><span aria-hidden="true">!</span><p><strong>Не вводите пароли и конфиденциальные данные.</strong> Демо-данные можно удалить очисткой localStorage для localhost.</p></div>
      </section>
    </main>
  );
}

function DemoUsersView() {
  const users = [
    { initials: "МП", name: "Мария Примерова", email: "maria.user@example.test", role: "Пользователь", state: "Активен" },
    { initials: "АД", name: "Алексей Демо", email: "alex.specialist@example.test", role: "Специалист", state: "Активен" },
    { initials: "ИТ", name: "Ирина Тестова", email: "irina.admin@example.test", role: "Администратор", state: "Активен" },
  ];
  return <><section className="page-heading list-heading"><div><span className="eyebrow">Только просмотр в демо</span><h1>Пользователи</h1><p>Вымышленные учётные записи для проверки ролевого интерфейса.</p></div></section><section className="panel admin-list">{users.map((user) => <div className="admin-row" key={user.email}><span className="avatar light" aria-hidden="true">{user.initials}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><span className="demo-admin-role">{user.role}</span><span className="active-state"><i aria-hidden="true" />{user.state}</span></div>)}</section></>;
}

function DemoSettingsView() {
  return <><section className="page-heading list-heading"><div><span className="eyebrow">Рабочий календарь · Europe/Moscow</span><h1>Категории и SLA</h1><p>Демонстрационные настройки показаны только для просмотра.</p></div></section><section className="settings-grid">{DEMO_CATEGORIES.map((category, index) => <article className="panel category-card" key={category.id}><div><span className="category-icon" aria-hidden="true">{category.name[0]}</span><span className="active-state"><i aria-hidden="true" />Активна</span></div><h2>{category.name}</h2><p>Вымышленная очередь для локальной демонстрации</p><dl><div><dt>Первый ответ</dt><dd>{index < 2 ? 30 : 60} мин</dd></div><div><dt>Решение</dt><dd>{index < 2 ? 240 : 480} мин</dd></div></dl></article>)}</section></>;
}

function DemoAuditView() {
  const events = [
    { id: 1, action: "demo.login", actor: "Ирина Тестова", object: "session", time: "Сегодня, 10:15" },
    { id: 2, action: "queue.previewed", actor: "Алексей Демо", object: "category", time: "Сегодня, 10:08" },
    { id: 3, action: "ticket.previewed", actor: "Мария Примерова", object: "ticket", time: "Сегодня, 09:52" },
  ];
  return <><section className="page-heading list-heading"><div><span className="eyebrow">Вымышленные события</span><h1>Журнал действий</h1><p>Демо-журнал не отправляется на сервер и не содержит текста заявок.</p></div></section><section className="panel audit-list">{events.map((event) => <div className="audit-row" key={event.id}><span className="audit-icon" aria-hidden="true">✓</span><span><strong>{event.action}</strong><small>{event.actor} · {event.object}</small></span><time>{event.time}</time><span className="audit-result">Успешно</span></div>)}</section></>;
}

export function DemoServiceDeskApp() {
  const [role, setRole] = useState<Role | null>(null);
  const [view, setView] = useState<View>("overview");
  const [tickets, setTickets] = useState<Ticket[]>(DEMO_TICKETS);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Все статусы" | TicketStatus>("Все статусы");
  const [categoryFilter, setCategoryFilter] = useState("Все категории");
  const [toast, setToast] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogKey = isCreateOpen ? "create" : selectedTicket?.recordId ?? "";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (isRole(storedRole)) setRole(storedRole);
      setTickets(readStoredTickets());
      setStorageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({ version: 1, tickets }));
  }, [storageReady, tickets]);

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
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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

  const scopedTickets = useMemo(() => {
    if (role === "user") return tickets.filter((ticket) => ticket.author === DEMO_PROFILES.user.displayName);
    if (role === "specialist") return tickets.filter((ticket) => [DEMO_CATEGORIES[0].id, DEMO_CATEGORIES[1].id, DEMO_CATEGORIES[2].id].includes(ticket.categoryId));
    return tickets;
  }, [role, tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ru");
    return scopedTickets.filter((ticket) => {
      const matchesSearch = !normalizedSearch || `${ticket.id} ${ticket.subject} ${ticket.author}`.toLocaleLowerCase("ru").includes(normalizedSearch);
      const matchesStatus = statusFilter === "Все статусы" || ticket.status === statusFilter;
      const matchesCategory = categoryFilter === "Все категории" || ticket.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, scopedTickets, search, statusFilter]);

  const login = (nextRole: Role) => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    setRole(nextRole);
    setView("overview");
  };

  const switchRole = (nextRole: Role) => {
    login(nextRole);
    setRoleMenuOpen(false);
    setSelectedTicket(null);
    setToast(`Роль изменена: ${roleConfig[nextRole].label}`);
  };

  const logout = () => {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
    setRole(null);
    setRoleMenuOpen(false);
    setSelectedTicket(null);
  };

  const createTicket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role) return;
    const form = new FormData(event.currentTarget);
    const categoryId = String(form.get("category") || "");
    const category = DEMO_CATEGORIES.find((item) => item.id === categoryId) ?? DEMO_CATEGORIES[0];
    const priorityMap: Record<string, Priority> = { Низкий: "Низкий", Средний: "Средний", Высокий: "Высокий" };
    const nextNumber = Math.max(...tickets.map((ticket) => Number(ticket.id.replace(/\D/g, "")) || 0), 1042) + 1;
    const newTicket: Ticket = {
      recordId: crypto.randomUUID(),
      id: `DEMO-${nextNumber}`,
      subject: String(form.get("subject") || "").slice(0, 80),
      description: String(form.get("description") || "").slice(0, 500),
      category: category.name,
      categoryId: category.id,
      priority: priorityMap[String(form.get("priority"))] ?? "Средний",
      status: "Новая",
      author: DEMO_PROFILES[role].displayName,
      owner: "Не назначен",
      due: "4 ч 00 мин",
      risk: false,
      created: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date()),
    };
    setTickets((current) => [newTicket, ...current]);
    setCreateOpen(false);
    setView("tickets");
    setToast(`Заявка ${newTicket.id} создана локально`);
  };

  const updateTicket = (ticket: Ticket, update: Partial<Ticket>) => {
    const nextTicket = { ...ticket, ...update };
    setTickets((current) => current.map((item) => item.recordId === ticket.recordId ? nextTicket : item));
    setSelectedTicket(nextTicket);
  };

  if (!role) return <DemoLogin onLogin={login} />;

  const profile = DEMO_PROFILES[role];
  const viewTitle = view === "overview" ? "Обзор" : view === "tickets" ? role === "user" ? "Мои заявки" : role === "specialist" ? "Очередь заявок" : "Все заявки" : view === "users" ? "Пользователи" : view === "settings" ? "Категории и SLA" : "Журнал действий";

  return (
    <div className="app-shell demo-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">S</span><span><strong>Service Desk</strong><small>Lite · Demo</small></span></div>
        <nav className="main-nav" aria-label="Основная навигация">
          <p className="nav-kicker">Рабочее пространство</p>
          {navByRole[role].map((item) => <button className={view === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => setView(item.id)} type="button"><span className="nav-symbol" aria-hidden="true">{item.symbol}</span>{item.label}{item.id === "tickets" && <span className="nav-count">{scopedTickets.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note"><span aria-hidden="true">!</span><p><strong>Демонстрационный режим</strong>Это переключатель интерфейса, а не авторизация. Данные остаются в localStorage.</p></div>
          <div className="role-switcher">
            {roleMenuOpen && <div className="role-menu" role="menu" aria-label="Сменить демонстрационную роль">{(Object.keys(roleConfig) as Role[]).map((itemRole) => <button type="button" role="menuitemradio" aria-checked={role === itemRole} key={itemRole} onClick={() => switchRole(itemRole)}><span className="mini-avatar" aria-hidden="true">{roleConfig[itemRole].label[0]}</span><span><strong>{roleConfig[itemRole].label}</strong><small>{roleConfig[itemRole].description}</small></span><span className="role-check" aria-hidden="true">{role === itemRole ? "✓" : ""}</span></button>)}</div>}
            <button className="profile-button" type="button" aria-haspopup="menu" aria-expanded={roleMenuOpen} onClick={() => setRoleMenuOpen((value) => !value)}><span className="avatar" aria-hidden="true">{profile.displayName.split(" ").map((part) => part[0]).join("")}</span><span className="profile-copy"><strong>{profile.displayName}</strong><small>{roleConfig[role].label}</small></span><span className="chevron" aria-hidden="true">⌃</span></button>
            <button className="demo-logout" type="button" onClick={logout}>Выйти из демо</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="demo-mode-banner" role="status"><strong>Демонстрационный режим</strong><span>Только вымышленные локальные данные · не настоящая авторизация</span></div>
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark" aria-hidden="true">S</span><strong>Service Desk Lite</strong></div>
          <div className="breadcrumb"><span>Рабочее пространство</span><span aria-hidden="true">/</span><strong>{viewTitle}</strong></div>
          <div className="top-actions"><span className="demo-chip">{roleConfig[role].label}</span>{role === "user" && <button className="primary-button compact" type="button" onClick={() => setCreateOpen(true)}><span aria-hidden="true">＋</span> Новая заявка</button>}</div>
        </header>
        <div className="page-content">
          {view === "overview" && <Overview role={role} tickets={scopedTickets} onCreate={() => setCreateOpen(true)} onOpenTicket={setSelectedTicket} onShowTickets={() => setView("tickets")} />}
          {view === "tickets" && <TicketsView role={role} tickets={filteredTickets} categories={DEMO_CATEGORIES} total={scopedTickets.length} search={search} statusFilter={statusFilter} categoryFilter={categoryFilter} onSearch={setSearch} onStatus={setStatusFilter} onCategory={setCategoryFilter} onOpen={setSelectedTicket} onCreate={() => setCreateOpen(true)} onReset={() => { setSearch(""); setStatusFilter("Все статусы"); setCategoryFilter("Все категории"); }} />}
          {view === "users" && <DemoUsersView />}
          {view === "settings" && <DemoSettingsView />}
          {view === "audit" && <DemoAuditView />}
        </div>
      </main>

      {isCreateOpen && <CreateTicketModal categories={DEMO_CATEGORIES} closeButtonRef={closeButtonRef} onClose={() => setCreateOpen(false)} onSubmit={createTicket} />}
      {selectedTicket && <TicketDrawer closeButtonRef={closeButtonRef} role={role} ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onTake={async () => { updateTicket(selectedTicket, { owner: profile.displayName, status: "В работе" }); setToast(`Заявка ${selectedTicket.id} назначена вам`); }} onTransition={async (status) => { const labels: Record<typeof status, TicketStatus> = { in_progress: "В работе", waiting_for_user: "Ждёт ответа", resolved: "Решена", closed: "Закрыта" }; updateTicket(selectedTicket, { status: labels[status], risk: false }); setToast(`Статус ${selectedTicket.id} обновлён локально`); }} onComment={async () => { setToast("Комментарий сохранён только для текущей демонстрации"); return true; }} />}
      <div className={toast ? "toast visible" : "toast"} role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>
    </div>
  );
}
