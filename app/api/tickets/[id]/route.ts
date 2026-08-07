import { apiHandler } from "@/lib/api";
import { canEditOwnTicket } from "@/lib/authz";
import { getTicket, requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { parseJson, updateOwnTicketSchema, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return apiHandler(request, async () => {
    const viewer = await requireViewer();
    const id = uuidSchema.safeParse((await context.params).id);
    if (!id.success) throw new AppError(400, "INVALID_INPUT", "Invalid id");
    return Response.json({ ticket: await getTicket(viewer, id.data) });
  });
}

export async function PATCH(request: Request, context: Context) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    const id = uuidSchema.safeParse((await context.params).id);
    const payload = updateOwnTicketSchema.safeParse(await parseJson(request));
    if (!id.success || !payload.success) throw new AppError(400, "INVALID_INPUT", "Invalid ticket update");
    const ticket = await getTicket(viewer, id.data);
    if (!canEditOwnTicket({ role: viewer.profile.role, profileId: viewer.profile.id, ticketAuthorId: ticket.author_id, ticketAssigneeId: ticket.assignee_id, ticketStatus: ticket.status })) {
      throw new AppError(403, "FORBIDDEN", "Ticket update rejected");
    }
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.rpc("update_own_ticket", {
      p_ticket_id: id.data,
      p_subject: payload.data.subject,
      p_description: payload.data.description,
      p_category_id: payload.data.categoryId,
      p_priority: payload.data.priority,
      p_request_id: requestId,
    });
    if (error || !data) throw new AppError(403, "FORBIDDEN", "Ticket update rejected");
    return Response.json({ ticket: data });
  });
}
