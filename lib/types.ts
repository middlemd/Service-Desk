export const APP_ROLES = ["user", "specialist", "admin"] as const;
export const USER_STATES = ["invited", "active", "blocked"] as const;
export const TICKET_STATUSES = ["new", "in_progress", "waiting_for_user", "resolved", "closed", "cancelled"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const COMMENT_VISIBILITIES = ["public", "internal"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type UserState = (typeof USER_STATES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export type Profile = {
  id: string;
  auth_subject: string;
  display_name: string;
  email: string;
  role: AppRole;
  state: UserState;
  created_at: string;
};

export type TicketCommentRecord = {
  id: string;
  author_id: string;
  body: string;
  visibility: CommentVisibility;
  created_at: string;
  author?: { display_name: string } | null;
};

export type TicketEventRecord = {
  id: number;
  actor_id: string;
  action: string;
  occurred_at: string;
  actor?: { display_name: string } | null;
};

export type TicketRecord = {
  id: string;
  number: number;
  subject: string;
  description: string;
  category_id: string;
  priority: Priority;
  status: TicketStatus;
  author_id: string;
  assignee_id: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
  author?: { display_name: string } | null;
  assignee?: { display_name: string } | null;
  comments?: TicketCommentRecord[];
  ticket_events?: TicketEventRecord[];
};

export type CategoryRecord = {
  id: string;
  name: string;
  is_active: boolean;
  first_response_minutes: number;
  resolution_minutes: number;
  calendar_id: string;
};

export type Viewer = {
  subject: string;
  sessionId: string;
  idToken: string;
  profile: Profile;
};
