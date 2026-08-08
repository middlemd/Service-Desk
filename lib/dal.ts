import "server-only";

import { cache } from "react";
import { getAuth0Client } from "./auth0";
import { canReadTicket } from "./authz";
import { AppError } from "./errors";
import { createUserSupabaseClient } from "./supabase";
import type { CategoryRecord, Profile, TicketRecord, Viewer } from "./types";

const ticketColumns = "id,number,subject,description,category_id,priority,status,author_id,assignee_id,first_response_due_at,resolution_due_at,created_at,updated_at,categories(name),author:profiles!tickets_author_id_fkey(display_name),assignee:profiles!tickets_assignee_id_fkey(display_name)";

export const requireViewer = cache(async (): Promise<Viewer> => {
  const session = await getAuth0Client().getSession();
  const subject = session?.user?.sub;
  const idToken = session?.tokenSet?.idToken;
  if (!subject || !idToken) throw new AppError(401, "UNAUTHENTICATED", "Missing session");

  const supabase = createUserSupabaseClient(idToken);
  const { data, error } = await supabase
    .from("profiles")
    .select("id,auth_subject,display_name,email,role,state,created_at")
    .eq("auth_subject", subject)
    .maybeSingle();

  if (error) {
    console.error("Supabase profile lookup failed", {
      code: error.code,
      message: error.message.slice(0, 200),
    });
    throw new AppError(403, "FORBIDDEN", "Profile unavailable");
  }
  if (!data) {
    console.error("Supabase profile lookup returned no accessible row");
    throw new AppError(403, "FORBIDDEN", "Profile unavailable");
  }
  if (data.state === "blocked") throw new AppError(403, "FORBIDDEN", "Profile unavailable");
  if (data.state === "invited") {
    const { error: activationError } = await supabase.rpc("activate_own_profile");
    if (activationError) throw new AppError(403, "FORBIDDEN", "Profile activation failed");
    data.state = "active";
  }
  return { subject, sessionId: session.internal.sid, idToken, profile: data as Profile };
});

export async function getTickets(viewer: Viewer) {
  const supabase = createUserSupabaseClient(viewer.idToken);
  const { data, error } = await supabase
    .from("tickets")
    .select(ticketColumns)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new AppError(500, "INTERNAL", "Ticket query failed");
  const tickets = (data ?? []) as unknown as TicketRecord[];
  if (viewer.profile.role === "admin") return tickets;
  if (viewer.profile.role === "user") {
    return tickets.filter((ticket) => canReadTicket({ role: "user", profileId: viewer.profile.id, ticketAuthorId: ticket.author_id }));
  }
  const { data: access, error: accessError } = await supabase
    .from("specialist_category_access")
    .select("category_id")
    .eq("specialist_id", viewer.profile.id);
  if (accessError) throw new AppError(500, "INTERNAL", "Queue access query failed");
  const allowedCategories = new Set((access ?? []).map((item) => item.category_id));
  return tickets.filter((ticket) => canReadTicket({ role: "specialist", profileId: viewer.profile.id, categoryAllowed: allowedCategories.has(ticket.category_id) }));
}

export async function getTicket(viewer: Viewer, id: string) {
  const supabase = createUserSupabaseClient(viewer.idToken);
  const { data, error } = await supabase
    .from("tickets")
    .select(`${ticketColumns},comments(id,author_id,body,visibility,created_at,author:profiles!comments_author_id_fkey(display_name)),ticket_events(id,actor_id,action,occurred_at,actor:profiles!ticket_events_actor_id_fkey(display_name))`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AppError(500, "INTERNAL", "Ticket query failed");
  if (!data) throw new AppError(403, "FORBIDDEN", "Ticket unavailable");
  const ticket = data as unknown as TicketRecord;
  let categoryAllowed = false;
  if (viewer.profile.role === "specialist") {
    const { data: access, error: accessError } = await supabase
      .from("specialist_category_access")
      .select("category_id")
      .eq("specialist_id", viewer.profile.id)
      .eq("category_id", ticket.category_id)
      .maybeSingle();
    if (accessError) throw new AppError(500, "INTERNAL", "Queue access query failed");
    categoryAllowed = Boolean(access);
  }
  if (!canReadTicket({
    role: viewer.profile.role,
    profileId: viewer.profile.id,
    ticketAuthorId: ticket.author_id,
    categoryAllowed,
  })) throw new AppError(403, "FORBIDDEN", "Ticket unavailable");
  return data;
}

export async function getCategories(viewer: Viewer) {
  const supabase = createUserSupabaseClient(viewer.idToken);
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,is_active,first_response_minutes,resolution_minutes,calendar_id")
    .order("name");
  if (error) throw new AppError(500, "INTERNAL", "Category query failed");
  return (data ?? []) as CategoryRecord[];
}

export async function recordLogin(viewer: Viewer, requestId: string) {
  const supabase = createUserSupabaseClient(viewer.idToken);
  const { data, error } = await supabase.rpc("record_login", { p_request_id: requestId });
  if (error || data !== true) throw new AppError(500, "INTERNAL", "Login audit failed");
}

export async function enforceRateLimit(viewer: Viewer, action: "ticket.create" | "comment.create") {
  const supabase = createUserSupabaseClient(viewer.idToken);
  const limits = action === "ticket.create" ? { count: 10, seconds: 3600 } : { count: 30, seconds: 600 };
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
    p_limit: limits.count,
    p_window_seconds: limits.seconds,
  });
  if (error) throw new AppError(500, "INTERNAL", "Rate limit unavailable");
  if (data !== true) throw new AppError(429, "RATE_LIMITED", "Rate limit exceeded");
}
