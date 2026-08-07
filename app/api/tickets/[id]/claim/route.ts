import { apiHandler } from "@/lib/api";
import { canClaimTicket } from "@/lib/authz";
import { getTicket, requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    const id = uuidSchema.safeParse((await context.params).id);
    if (!id.success) throw new AppError(400, "INVALID_INPUT", "Invalid id");
    const ticket = await getTicket(viewer, id.data);
    if (!canClaimTicket({ role: viewer.profile.role, profileId: viewer.profile.id, categoryAllowed: true, ticketAssigneeId: ticket.assignee_id, ticketStatus: ticket.status })) {
      throw new AppError(403, "FORBIDDEN", "Ticket claim rejected");
    }
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.rpc("claim_ticket", { p_ticket_id: id.data, p_request_id: requestId });
    if (error || !data) throw new AppError(403, "FORBIDDEN", "Ticket claim rejected");
    return Response.json({ ticket: data });
  });
}
