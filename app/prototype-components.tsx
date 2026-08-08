"use client";

import { CSSProperties, FormEvent, RefObject, useEffect, useState } from "react";
import {
  chartData,
  CategoryOption,
  Priority,
  priorityClass,
  Role,
  statusClass,
  Ticket,
  TicketStatus,
} from "./prototype-data";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status-badge ${statusClass[status]}`}>{status}</span>;
}

export function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span className={`priority-mark ${priorityClass[priority]}`}>
      <span aria-hidden="true" />
      {priority}
    </span>
  );
}

function MetricCard({ label, value, trend, tone }: { label: string; value: string; trend: string; tone: string }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top"><span>{label}</span><span className="metric-icon" aria-hidden="true">↗</span></div>
      <strong>{value}</strong>
      <small>{trend}</small>
    </article>
  );
}

export function TicketTable({ tickets, onOpen }: { tickets: Ticket[]; onOpen: (ticket: Ticket) => void }) {
  return (
    <div className="table-scroll">
      <table className="tickets-table">
        <thead><tr><th>Заявка</th><th>Статус</th><th>Приоритет</th><th>Исполнитель</th><th>SLA</th><th><span className="sr-only">Открыть</span></th></tr></thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td data-label="Заявка"><button className="ticket-link" type="button" onClick={() => onOpen(ticket)}><strong>{ticket.subject}</strong><small>{ticket.id} · {ticket.category}</small></button></td>
              <td data-label="Статус"><StatusBadge status={ticket.status} /></td>
              <td data-label="Приоритет"><PriorityMark priority={ticket.priority} /></td>
              <td data-label="Исполнитель"><span className="owner"><span aria-hidden="true">{ticket.owner === "Не назначен" ? "—" : ticket.owner.split(" ").map((part) => part[0]).join("")}</span>{ticket.owner}</span></td>
              <td data-label="SLA"><span className={ticket.risk ? "due at-risk" : "due"}>{ticket.risk && <i aria-hidden="true" />} {ticket.due}</span></td>
              <td><button className="row-action" type="button" aria-label={`Открыть заявку ${ticket.id}`} onClick={() => onOpen(ticket)}>→</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Overview({ role, tickets, onCreate, onOpenTicket, onShowTickets }: {
  role: Role;
  tickets: Ticket[];
  onCreate: () => void;
  onOpenTicket: (ticket: Ticket) => void;
  onShowTickets: () => void;
}) {
  const openCount = tickets.filter((ticket) => !["Закрыта", "Решена"].includes(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => ["Закрыта", "Решена"].includes(ticket.status)).length;
  const riskCount = tickets.filter((ticket) => ticket.risk).length;
  const greeting = role === "user" ? "Ваши обращения" : role === "specialist" ? "Рабочая очередь" : "Состояние сервиса";

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">7 августа · четверг</span>
          <h1>{greeting}</h1>
          <p>{role === "user" ? "Следите за решениями и дополняйте свои заявки." : role === "specialist" ? "Приоритеты на сегодня и контроль сроков SLA." : "Общая картина обращений, команды и качества обслуживания."}</p>
        </div>
        {role === "user" ? <button className="primary-button" type="button" onClick={onCreate}><span aria-hidden="true">＋</span> Создать заявку</button> : <button className="secondary-button" type="button" onClick={onShowTickets}>Открыть список <span aria-hidden="true">→</span></button>}
      </section>

      <section className="metric-grid" aria-label="Ключевые показатели">
        <MetricCard label={role === "user" ? "Активные" : "В очереди"} value={String(openCount)} trend="На 2 меньше, чем вчера" tone="blue" />
        <MetricCard label="Под риском SLA" value={String(riskCount)} trend={riskCount ? "Требует внимания" : "Рисков нет"} tone={riskCount ? "amber" : "teal"} />
        <MetricCard label="Решено за неделю" value={String(resolvedCount + 31)} trend="83% в целевой срок" tone="teal" />
        <MetricCard label="Среднее время" value="2ч 14м" trend="−18 мин за неделю" tone="neutral" />
      </section>

      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-header">
            <div><h2>Динамика заявок</h2><p>Создано и решено за последние 7 дней</p></div>
            <div className="chart-legend" aria-hidden="true"><span><i className="legend-total" />Создано</span><span><i className="legend-resolved" />Решено</span></div>
          </div>
          <div className="chart" role="img" aria-label="Столбчатый график: максимум 24 созданных заявки в четверг">
            <div className="chart-guides" aria-hidden="true"><span /><span /><span /><span /></div>
            {chartData.map((item) => (
              <div className="chart-column" key={item.day} title={`${item.day}: создано ${item.total}, решено ${item.resolved}`}>
                <div className="bars"><span className="bar total" style={{ "--bar": `${item.total * 4}%` } as CSSProperties} /><span className="bar resolved" style={{ "--bar": `${item.resolved * 4}%` } as CSSProperties} /></div>
                <small>{item.day}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel sla-panel">
          <div className="panel-header"><div><h2>Контроль SLA</h2><p>Ближайшие контрольные сроки</p></div><button className="text-button" type="button" onClick={onShowTickets}>Все заявки</button></div>
          <div className="sla-list">
            {tickets.slice(0, 3).map((ticket) => (
              <button type="button" className="sla-item" key={ticket.id} onClick={() => onOpenTicket(ticket)}>
                <span className={`sla-time ${ticket.risk ? "at-risk" : ""}`}>{ticket.due}</span>
                <span><strong>{ticket.subject}</strong><small>{ticket.id} · {ticket.category}</small></span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <div className="sla-footer"><span aria-hidden="true">●</span> SLA учитывает рабочий календарь · Europe/Moscow</div>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-header"><div><h2>{role === "user" ? "Последние заявки" : "Требуют внимания"}</h2><p>Актуальные обращения в вашей области доступа</p></div><button className="secondary-button compact" type="button" onClick={onShowTickets}>Смотреть все</button></div>
        <TicketTable tickets={tickets.slice(0, 4)} onOpen={onOpenTicket} />
      </section>
    </>
  );
}

export function TicketsView({ role, tickets, categories, total, search, statusFilter, categoryFilter, onSearch, onStatus, onCategory, onOpen, onCreate, onReset }: {
  role: Role;
  tickets: Ticket[];
  categories: CategoryOption[];
  total: number;
  search: string;
  statusFilter: "Все статусы" | TicketStatus;
  categoryFilter: string;
  onSearch: (value: string) => void;
  onStatus: (value: "Все статусы" | TicketStatus) => void;
  onCategory: (value: string) => void;
  onOpen: (ticket: Ticket) => void;
  onCreate: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <section className="page-heading list-heading">
        <div><span className="eyebrow">{total} обращений в области доступа</span><h1>{role === "user" ? "Мои заявки" : role === "specialist" ? "Очередь заявок" : "Все заявки"}</h1><p>Поиск, фильтры и контроль текущего состояния.</p></div>
        {role === "user" && <button className="primary-button" type="button" onClick={onCreate}><span aria-hidden="true">＋</span> Создать заявку</button>}
      </section>
      <section className="panel ticket-list-panel">
        <div className="filter-bar">
          <label className="search-field"><span className="sr-only">Поиск по номеру, теме или автору</span><span aria-hidden="true">⌕</span><input value={search} maxLength={80} onChange={(event) => onSearch(event.target.value)} placeholder="Поиск по номеру, теме или автору" />{search && <button type="button" aria-label="Очистить поиск" onClick={() => onSearch("")}>×</button>}</label>
          <label className="select-field"><span className="sr-only">Статус</span><select value={statusFilter} onChange={(event) => onStatus(event.target.value as "Все статусы" | TicketStatus)}><option>Все статусы</option><option>Новая</option><option>В работе</option><option>Ждёт ответа</option><option>Решена</option><option>Закрыта</option></select></label>
          <label className="select-field"><span className="sr-only">Категория</span><select value={categoryFilter} onChange={(event) => onCategory(event.target.value)}><option>Все категории</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id}>{category.name}</option>)}</select></label>
          <button className="filter-reset" type="button" onClick={onReset}>Сбросить</button>
        </div>
        {tickets.length ? <><TicketTable tickets={tickets} onOpen={onOpen} /><div className="table-footer"><span>Показано {tickets.length} из {total}</span><div className="pagination" aria-label="Пагинация"><button type="button" disabled aria-label="Предыдущая страница">←</button><button type="button" className="current" aria-current="page">1</button><button type="button" disabled aria-label="Следующая страница">→</button></div></div></> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h2>Ничего не найдено</h2><p>Измените запрос или сбросьте фильтры — данные остались на месте.</p><button className="secondary-button" type="button" onClick={onReset}>Сбросить фильтры</button></div>}
      </section>
    </>
  );
}

export function CreateTicketModal({ categories, closeButtonRef, onClose, onSubmit }: { categories: CategoryOption[]; closeButtonRef: RefObject<HTMLButtonElement | null>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const [description, setDescription] = useState("");
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="modal-header"><div><span className="eyebrow">Новое обращение</span><h2 id="create-title">Создать заявку</h2><p>Опишите задачу — команда увидит её в своей очереди.</p></div><button ref={closeButtonRef} className="close-button" type="button" aria-label="Закрыть окно" onClick={onClose}>×</button></div>
        <form onSubmit={onSubmit}>
          <div className="form-body">
            <label className="form-field"><span>Тема <b aria-hidden="true">*</b></span><input name="subject" required minLength={5} maxLength={80} placeholder="Коротко опишите проблему" autoComplete="off" /></label>
            <div className="form-row">
              <label className="form-field"><span>Категория <b aria-hidden="true">*</b></span><select name="category" required defaultValue=""><option value="" disabled>Выберите категорию</option>{categories.filter((category) => category.isActive).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label className="form-field"><span>Приоритет</span><select name="priority" defaultValue="Средний"><option>Низкий</option><option>Средний</option><option>Высокий</option></select></label>
            </div>
            <label className="form-field"><span>Описание <b aria-hidden="true">*</b></span><textarea name="description" required minLength={10} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что произошло и какой результат вы ожидаете?" /><small className="field-count">{description.length} / 500</small></label>
            <div className="safety-note"><span aria-hidden="true">!</span><p><strong>Не указывайте пароли и конфиденциальные данные.</strong> Текст заявки сохраняется в рабочей базе и доступен только по правилам вашей роли.</p></div>
          </div>
          <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" type="submit">Создать заявку</button></div>
        </form>
      </section>
    </div>
  );
}

export function TicketDrawer({ closeButtonRef, role, ticket, onClose, onTake, onTransition, onComment }: { closeButtonRef: RefObject<HTMLButtonElement | null>; role: Role; ticket: Ticket; onClose: () => void; onTake: () => void | Promise<void>; onTransition: (status: "in_progress" | "waiting_for_user" | "resolved" | "closed") => Promise<void>; onComment: (body: string, visibility: "public" | "internal") => Promise<boolean> }) {
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const history = ticket.history ?? [{ id: `created-${ticket.recordId}`, title: "Заявка создана", actor: ticket.author, occurredAt: ticket.created }];
  const commentsClosed = ["Закрыта", "Отменена"].includes(ticket.status);
  const submitComment = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (await onComment(comment, visibility)) setComment(""); };
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ticket-drawer" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
        <div className="drawer-header"><div><span className="ticket-number">{ticket.id}</span><h2 id="ticket-title">{ticket.subject}</h2><div className="drawer-badges"><StatusBadge status={ticket.status} /><PriorityMark priority={ticket.priority} /></div></div><button ref={closeButtonRef} className="close-button" type="button" aria-label="Закрыть карточку" onClick={onClose}>×</button></div>
        <div className="drawer-body">
          <div className="ticket-meta"><div><span>Категория</span><strong>{ticket.category}</strong></div><div><span>Автор</span><strong>{ticket.author}</strong></div><div><span>Исполнитель</span><strong>{ticket.owner}</strong></div><div><span>Срок SLA</span><strong className={ticket.risk ? "text-danger" : ""}>{ticket.due}</strong></div></div>
          {role === "specialist" && ticket.owner === "Не назначен" && <button className="primary-button full-width" type="button" onClick={onTake}>Взять в работу</button>}
          {role === "specialist" && ticket.owner !== "Не назначен" && ticket.status === "В работе" && <div className="drawer-actions"><button className="secondary-button" type="button" onClick={() => onTransition("waiting_for_user")}>Ждать ответа</button><button className="primary-button" type="button" onClick={() => onTransition("resolved")}>Отметить решённой</button></div>}
          {role === "specialist" && ticket.status === "Ждёт ответа" && <button className="primary-button full-width" type="button" onClick={() => onTransition("in_progress")}>Вернуть в работу</button>}
          {role === "user" && ticket.status === "Решена" && <div className="drawer-actions"><button className="secondary-button" type="button" onClick={() => onTransition("in_progress")}>Проблема осталась</button><button className="primary-button" type="button" onClick={() => onTransition("closed")}>Подтвердить решение</button></div>}
          <section className="drawer-section"><h3>Описание</h3><p className="description-text">{ticket.description}</p></section>
          <section className="drawer-section"><div className="section-heading"><h3>История</h3><span>{history.length} событий</span></div><ol className="timeline">{history.map((item, index) => <li className={index === 0 ? "current" : undefined} key={item.id}><span className="timeline-dot" aria-hidden="true" /><div><strong>{item.title}{item.isInternal ? " · только специалистам" : ""}</strong>{item.body && <p className="timeline-body">{item.body}</p>}<p>{item.actor} · {item.occurredAt}</p></div></li>)}</ol></section>
          {role !== "admin" && !commentsClosed && <section className="drawer-section comment-section"><h3>Добавить комментарий</h3><form onSubmit={submitComment}><label><span className="sr-only">Текст комментария</span><textarea required minLength={2} maxLength={300} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Напишите уточнение без паролей и конфиденциальных данных" /></label><div className="comment-actions"><span>{comment.length} / 300</span>{role === "specialist" && <label className="visibility-select"><span className="sr-only">Видимость</span><select aria-label="Видимость комментария" value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "internal")}><option value="public">Публичный</option><option value="internal">Внутренний</option></select></label>}<button className="primary-button compact" type="submit">Отправить</button></div></form></section>}
          {role !== "admin" && commentsClosed && <section className="drawer-section closed-comment-note"><h3>Комментарии закрыты</h3><p>После закрытия заявки новые комментарии недоступны.</p></section>}
        </div>
      </section>
    </div>
  );
}

type AdminUser = { id: string; display_name: string; email: string; role: Role; state: "invited" | "active" | "blocked"; category_ids: string[] };
type AdminCategory = { id: string; name: string; is_active: boolean; first_response_minutes: number; resolution_minutes: number };
type AuditEvent = { id: number; action: string; object_type: string; result: "success" | "denied" | "failure"; occurred_at: string; actor?: { display_name: string } | null };

const stateLabels = { invited: "Приглашён", active: "Активен", blocked: "Заблокирован" };

export function UsersView({ csrfToken }: { csrfToken: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/admin/users", { cache: "no-store" }), fetch("/api/categories", { cache: "no-store" })])
      .then(async ([usersResponse, categoriesResponse]) => {
        if (!usersResponse.ok || !categoriesResponse.ok) throw new Error("load failed");
        const usersPayload = (await usersResponse.json()) as { users: AdminUser[] };
        const categoriesPayload = (await categoriesResponse.json()) as { categories: AdminCategory[] };
        setUsers(usersPayload.users);
        setCategories(categoriesPayload.categories);
      })
      .catch(() => setMessage("Не удалось загрузить административные данные."));
  }, []);

  const updateRole = async (user: AdminUser, role: Role) => {
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ role }) });
    if (!response.ok) return setMessage("Не удалось изменить роль.");
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role, category_ids: role === "specialist" ? item.category_ids : [] } : item));
    setMessage("Роль пользователя обновлена.");
  };

  const updateCategories = async (event: FormEvent<HTMLFormElement>, user: AdminUser) => {
    event.preventDefault();
    const categoryIds = new FormData(event.currentTarget).getAll("categoryIds").map(String);
    const response = await fetch(`/api/admin/users/${user.id}/categories`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ categoryIds }),
    });
    if (!response.ok) return setMessage("Не удалось обновить доступ к очередям.");
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, category_ids: categoryIds } : item));
    setMessage("Доступ специалиста к очередям обновлён.");
  };

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = String(form.get("role")) as Role;
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ email: form.get("email"), displayName: form.get("displayName"), role, categoryIds: role === "specialist" ? form.getAll("categoryIds") : [] }),
    });
    if (!response.ok) return setMessage("Приглашение не отправлено. Проверьте данные и настройки Auth0.");
    const payload = (await response.json()) as { user: AdminUser };
    setUsers((current) => [payload.user, ...current]);
    setShowInvite(false);
    setMessage("Пользователь приглашён через Auth0.");
  };

  return <>
    <section className="page-heading list-heading"><div><span className="eyebrow">Администрирование</span><h1>Пользователи</h1><p>Аккаунты создаются только администратором через Auth0.</p></div><button className="primary-button" type="button" onClick={() => setShowInvite((value) => !value)}>Пригласить пользователя</button></section>
    {showInvite && <form className="panel inline-admin-form" onSubmit={invite}><label className="form-field"><span>Имя</span><input name="displayName" minLength={2} maxLength={80} required /></label><label className="form-field"><span>Email</span><input name="email" type="email" maxLength={254} required /></label><label className="form-field"><span>Роль</span><select name="role" defaultValue="user"><option value="user">Пользователь</option><option value="specialist">Специалист</option><option value="admin">Администратор</option></select></label><fieldset><legend>Категории специалиста</legend>{categories.filter((item) => item.is_active).map((category) => <label key={category.id}><input type="checkbox" name="categoryIds" value={category.id} /> {category.name}</label>)}</fieldset><div className="safety-note"><span aria-hidden="true">!</span><p><strong>Не используйте реальные данные в учебной среде.</strong> Пароль задаётся пользователем на стороне Auth0.</p></div><button className="primary-button" type="submit">Отправить приглашение</button></form>}
    {message && <p className="inline-message" role="status">{message}</p>}
    <section className="panel admin-list">{users.length === 0 ? <div className="compact-empty">Пользователи пока не загружены</div> : users.map((user) => <div className="admin-row" key={user.id}><span className="avatar light" aria-hidden="true">{user.display_name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{user.display_name}</strong><small>{user.email}</small></span><label className="admin-role"><span className="sr-only">Роль: {user.display_name}</span><select value={user.role} onChange={(event) => updateRole(user, event.target.value as Role)}><option value="user">Пользователь</option><option value="specialist">Специалист</option><option value="admin">Администратор</option></select></label><span className={user.state === "blocked" ? "active-state blocked" : "active-state"}><i aria-hidden="true" />{stateLabels[user.state]}</span>{user.role === "specialist" && <form className="queue-access" onSubmit={(event) => updateCategories(event, user)}><fieldset><legend>Разрешённые очереди</legend>{categories.filter((item) => item.is_active).map((category) => <label key={category.id}><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={user.category_ids.includes(category.id)} /> {category.name}</label>)}</fieldset><button className="secondary-button compact" type="submit">Сохранить очереди</button></form>}</div>)}</section>
  </>;
}

export function SettingsView({ csrfToken }: { csrfToken: string }) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/categories", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as { categories: AdminCategory[] };
      setCategories(payload.categories);
    }).catch(() => setMessage("Не удалось загрузить категории."));
  }, []);

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/categories", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ name: form.get("name"), firstResponseMinutes: Number(form.get("firstResponseMinutes")), resolutionMinutes: Number(form.get("resolutionMinutes")), isActive: true }) });
    if (!response.ok) return setMessage("Не удалось создать категорию.");
    const payload = (await response.json()) as { category: AdminCategory };
    setCategories((current) => [...current, payload.category]);
    setShowForm(false);
    setMessage("Категория создана и записана в аудит.");
  };

  return <><section className="page-heading list-heading"><div><span className="eyebrow">Рабочий календарь · Europe/Moscow</span><h1>Категории и SLA</h1><p>Целевые сроки считаются по расписанию и исключают праздники.</p></div><button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>Добавить категорию</button></section>{showForm && <form className="panel inline-admin-form compact-form" onSubmit={createCategory}><label className="form-field"><span>Название</span><input name="name" minLength={2} maxLength={80} required /></label><label className="form-field"><span>Первый ответ, мин</span><input name="firstResponseMinutes" type="number" min={5} max={10080} defaultValue={60} required /></label><label className="form-field"><span>Решение, мин</span><input name="resolutionMinutes" type="number" min={15} max={43200} defaultValue={240} required /></label><button className="primary-button" type="submit">Создать</button></form>}{message && <p className="inline-message" role="status">{message}</p>}<section className="settings-grid">{categories.map((category) => <article className="panel category-card" key={category.id}><div><span className="category-icon" aria-hidden="true">{category.name[0]}</span><span className="active-state"><i aria-hidden="true" />{category.is_active ? "Активна" : "Отключена"}</span></div><h2>{category.name}</h2><p>Доступ выдаётся специалистам явно</p><dl><div><dt>Первый ответ</dt><dd>{category.first_response_minutes} мин</dd></div><div><dt>Решение</dt><dd>{category.resolution_minutes} мин</dd></div></dl></article>)}</section></>;
}

export function AuditView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/admin/audit", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as { events: AuditEvent[] };
      setEvents(payload.events);
    }).catch(() => setFailed(true));
  }, []);
  return <><section className="page-heading list-heading"><div><span className="eyebrow">Только для чтения</span><h1>Журнал действий</h1><p>Критичные события без текстов заявок и лишних персональных данных.</p></div></section><section className="panel audit-list">{failed || events.length === 0 ? <div className="compact-empty">{failed ? "Не удалось загрузить журнал" : "Событий пока нет"}</div> : events.map((event) => <div className="audit-row" key={event.id}><span className={event.result === "success" ? "audit-icon" : "audit-icon denied"} aria-hidden="true">{event.result === "success" ? "✓" : "!"}</span><span><strong>{event.action}</strong><small>{event.actor?.display_name ?? "Системное событие"} · {event.object_type}</small></span><time>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.occurred_at))}</time><span className={event.result === "success" ? "audit-result" : "audit-result denied"}>{event.result === "success" ? "Успешно" : "Отклонено"}</span></div>)}</section></>;
}
