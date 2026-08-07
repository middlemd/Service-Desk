import { apiHandler } from "@/lib/api";
import { canCreateTicket } from "@/lib/authz";
import { getTickets, enforceRateLimit, requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { createTicketSchema, parseJson } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiHandler(request, async () => {
    const viewer = await requireViewer();
    return Response.json({ tickets: await getTickets(viewer) });
  });
}

export async function POST(request: Request) {
  return apiHandler(request, async (id) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    if (!canCreateTicket(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Role cannot create tickets");
    await enforceRateLimit(viewer, "ticket.create");
    const parsed = createTicketSchema.safeParse(await parseJson(request));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT", "Invalid ticket");

    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        subject: parsed.data.subject,
        description: parsed.data.description,
        category_id: parsed.data.categoryId,
        priority: parsed.data.priority,
        author_id: viewer.profile.id,
      })
      .select("id,number,subject,description,category_id,priority,status,author_id,assignee_id,first_response_due_at,resolution_due_at,created_at,updated_at")
      .single();
    if (error) throw new AppError(400, "INVALID_INPUT", "Ticket insert rejected");
    await supabase.rpc("write_ticket_event", { p_ticket_id: data.id, p_action: "ticket.created", p_request_id: id });
    return Response.json({ ticket: data }, { status: 201 });
  });
}
