import { apiHandler } from "@/lib/api";
import { canTransitionTicket } from "@/lib/authz";
import { getTicket, requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { parseJson, transitionSchema, uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    const id = uuidSchema.safeParse((await context.params).id);
    const payload = transitionSchema.safeParse(await parseJson(request));
    if (!id.success || !payload.success) throw new AppError(400, "INVALID_INPUT", "Invalid transition");
    const ticket = await getTicket(viewer, id.data);
    if (!canTransitionTicket({ role: viewer.profile.role, profileId: viewer.profile.id, ticketAuthorId: ticket.author_id, ticketAssigneeId: ticket.assignee_id, categoryAllowed: viewer.profile.role === "specialist", ticketStatus: ticket.status }, payload.data.status)) {
      throw new AppError(403, "FORBIDDEN", "Transition rejected");
    }
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.rpc("transition_ticket", { p_ticket_id: id.data, p_status: payload.data.status, p_request_id: requestId });
    if (error || !data) throw new AppError(403, "FORBIDDEN", "Transition rejected");
    return Response.json({ ticket: data });
  });
}
