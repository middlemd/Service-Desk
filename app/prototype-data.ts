import type { AppRole, Priority as ApiPriority, TicketRecord, TicketStatus as ApiStatus } from "@/lib/types";

export type Role = AppRole;
export type View = "overview" | "tickets" | "users" | "settings" | "audit";
export type TicketStatus = "Новая" | "В работе" | "Ждёт ответа" | "Решена" | "Закрыта" | "Отменена";
export type Priority = "Низкий" | "Средний" | "Высокий" | "Критический";

export type TicketHistoryItem = {
  id: string;
  title: string;
  actor: string;
  occurredAt: string;
  body?: string;
  isInternal?: boolean;
};

export type Ticket = {
  recordId: string;
  id: string;
  subject: string;
  description: string;
  category: string;
  categoryId: string;
  priority: Priority;
  status: TicketStatus;
  author: string;
  owner: string;
  due: string;
  risk: boolean;
  created: string;
  history?: TicketHistoryItem[];
};

export type CategoryOption = { id: string; name: string; isActive: boolean };

export const roleConfig: Record<Role, { label: string; description: string }> = {
  user: { label: "Пользователь", description: "Личные заявки и публичные комментарии" },
  specialist: { label: "Специалист", description: "Только назначенные категории" },
  admin: { label: "Администратор", description: "Настройки, пользователи и аудит" },
};

export const navByRole: Record<Role, { id: View; label: string; symbol: string }[]> = {
  user: [{ id: "overview", label: "Обзор", symbol: "О" }, { id: "tickets", label: "Мои заявки", symbol: "З" }],
  specialist: [{ id: "overview", label: "Обзор", symbol: "О" }, { id: "tickets", label: "Очередь", symbol: "З" }],
  admin: [
    { id: "overview", label: "Обзор", symbol: "О" },
    { id: "tickets", label: "Все заявки", symbol: "З" },
    { id: "users", label: "Пользователи", symbol: "П" },
    { id: "settings", label: "Категории и SLA", symbol: "С" },
    { id: "audit", label: "Журнал действий", symbol: "Ж" },
  ],
};

export const chartData = [
  { day: "Пн", total: 14, resolved: 9 }, { day: "Вт", total: 19, resolved: 12 },
  { day: "Ср", total: 16, resolved: 13 }, { day: "Чт", total: 24, resolved: 17 },
  { day: "Пт", total: 21, resolved: 18 }, { day: "Сб", total: 8, resolved: 6 },
  { day: "Вс", total: 11, resolved: 8 },
];

export const statusClass: Record<TicketStatus, string> = {
  Новая: "status-new", "В работе": "status-progress", "Ждёт ответа": "status-waiting",
  Решена: "status-resolved", Закрыта: "status-closed", Отменена: "status-closed",
};

export const priorityClass: Record<Priority, string> = {
  Низкий: "priority-low", Средний: "priority-medium", Высокий: "priority-high", Критический: "priority-critical",
};

const statusLabels: Record<ApiStatus, TicketStatus> = {
  new: "Новая", in_progress: "В работе", waiting_for_user: "Ждёт ответа",
  resolved: "Решена", closed: "Закрыта", cancelled: "Отменена",
};

const priorityLabels: Record<ApiPriority, Priority> = {
  low: "Низкий", medium: "Средний", high: "Высокий", critical: "Критический",
};

const eventLabels: Record<string, string> = {
  "ticket.created": "Заявка создана",
  "ticket.updated": "Данные заявки обновлены",
  "ticket.claimed": "Заявка взята в работу",
  "ticket.status.in_progress": "Статус изменён на «В работе»",
  "ticket.status.waiting_for_user": "Статус изменён на «Ждёт ответа»",
  "ticket.status.resolved": "Статус изменён на «Решена»",
  "ticket.status.closed": "Статус изменён на «Закрыта»",
  "ticket.status.cancelled": "Статус изменён на «Отменена»",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function fallbackActor(actorId: string, ticket: TicketRecord, author: string, owner: string) {
  if (actorId === ticket.author_id) return author;
  if (actorId === ticket.assignee_id && owner !== "Назначен специалисту") return owner;
  return "Специалист поддержки";
}

function buildHistory(ticket: TicketRecord, author: string, owner: string): TicketHistoryItem[] {
  const events: Array<TicketHistoryItem & { timestamp: number }> = (ticket.ticket_events ?? [])
    .filter((event) => !event.action.startsWith("comment."))
    .map((event) => ({
      id: `event-${event.id}`,
      title: eventLabels[event.action] ?? "Заявка обновлена",
      actor: event.actor?.display_name ?? fallbackActor(event.actor_id, ticket, author, owner),
      occurredAt: formatDate(event.occurred_at),
      timestamp: Date.parse(event.occurred_at),
    }));
  const comments: Array<TicketHistoryItem & { timestamp: number }> = (ticket.comments ?? []).map((comment) => ({
    id: `comment-${comment.id}`,
    title: comment.visibility === "internal" ? "Внутренний комментарий" : "Комментарий добавлен",
    actor: comment.author?.display_name ?? fallbackActor(comment.author_id, ticket, author, owner),
    occurredAt: formatDate(comment.created_at),
    body: comment.body,
    isInternal: comment.visibility === "internal",
    timestamp: Date.parse(comment.created_at),
  }));
  const history = [...events, ...comments]
    .sort((left, right) => right.timestamp - left.timestamp)
    .map((entry) => {
      const item: TicketHistoryItem = {
        id: entry.id,
        title: entry.title,
        actor: entry.actor,
        occurredAt: entry.occurredAt,
      };
      if (entry.body) item.body = entry.body;
      if (entry.isInternal) item.isInternal = true;
      return item;
    });

  return history.length ? history : [{
    id: `created-${ticket.id}`,
    title: "Заявка создана",
    actor: author,
    occurredAt: formatDate(ticket.created_at),
  }];
}

export function toUiTicket(ticket: TicketRecord): Ticket {
  const resolutionDue = ticket.resolution_due_at ? new Date(ticket.resolution_due_at) : null;
  const remainingMinutes = resolutionDue ? Math.round((resolutionDue.getTime() - Date.now()) / 60000) : null;
  const isClosed = ["resolved", "closed", "cancelled"].includes(ticket.status);
  const author = ticket.author?.display_name ?? "Пользователь";
  const owner = ticket.assignee?.display_name ?? (ticket.assignee_id ? "Назначен специалисту" : "Не назначен");
  return {
    recordId: ticket.id,
    id: `SD-${ticket.number}`,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.categories?.name ?? "Без категории",
    categoryId: ticket.category_id,
    priority: priorityLabels[ticket.priority],
    status: statusLabels[ticket.status],
    author,
    owner,
    due: isClosed ? "В срок" : remainingMinutes === null ? "Не рассчитан" : remainingMinutes <= 0 ? "Просрочено" : remainingMinutes < 60 ? `${remainingMinutes} мин` : `${Math.floor(remainingMinutes / 60)} ч ${remainingMinutes % 60} мин`,
    risk: !isClosed && remainingMinutes !== null && remainingMinutes <= 60,
    created: formatDate(ticket.created_at),
    history: buildHistory(ticket, author, owner),
  };
}
