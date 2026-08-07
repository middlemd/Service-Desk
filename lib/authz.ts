import type { AppRole, CommentVisibility, TicketStatus } from "./types";

export type AuthorizationContext = {
  role: AppRole | null;
  profileId: string;
  ticketAuthorId?: string;
  ticketAssigneeId?: string | null;
  categoryAllowed?: boolean;
  ticketStatus?: TicketStatus;
};

export function canReadTicket(context: AuthorizationContext) {
  if (context.role === "admin") return true;
  if (context.role === "user") return context.ticketAuthorId === context.profileId;
  return context.categoryAllowed === true;
}

export function canCreateTicket(role: AppRole | null) {
  return role === "user";
}

export function canEditOwnTicket(context: AuthorizationContext) {
  return context.role === "user" && context.ticketAuthorId === context.profileId && context.ticketStatus === "new" && !context.ticketAssigneeId;
}

export function canClaimTicket(context: AuthorizationContext) {
  return context.role === "specialist" && context.categoryAllowed === true && !context.ticketAssigneeId && context.ticketStatus === "new";
}

export function canComment(context: AuthorizationContext, visibility: CommentVisibility) {
  if (context.role === "admin") return false;
  if (context.role === "user") return visibility === "public" && context.ticketAuthorId === context.profileId;
  return context.categoryAllowed === true;
}

export function canTransitionTicket(context: AuthorizationContext, nextStatus: TicketStatus) {
  if (context.role === "specialist") {
    const ownsWork = context.ticketAssigneeId === context.profileId && context.categoryAllowed === true;
    return ownsWork && (
      (context.ticketStatus === "in_progress" && ["waiting_for_user", "resolved"].includes(nextStatus))
      || (context.ticketStatus === "waiting_for_user" && nextStatus === "in_progress")
    );
  }
  return context.role === "user"
    && context.ticketAuthorId === context.profileId
    && context.ticketStatus === "resolved"
    && ["closed", "in_progress"].includes(nextStatus);
}

export function canAdminister(role: AppRole | null) {
  return role === "admin";
}
