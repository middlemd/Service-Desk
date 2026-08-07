import { apiHandler } from "@/lib/api";
import { canComment } from "@/lib/authz";
import { enforceRateLimit, getTicket, requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { commentSchema, parseJson, uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    const id = uuidSchema.safeParse((await context.params).id);
    if (!id.success) throw new AppError(400, "INVALID_INPUT", "Invalid comment");
    await enforceRateLimit(viewer, "comment.create");
    const payload = commentSchema.safeParse(await parseJson(request));
    if (!payload.success) throw new AppError(400, "INVALID_INPUT", "Invalid comment");
    const ticket = await getTicket(viewer, id.data);
    if (!canComment({ role: viewer.profile.role, profileId: viewer.profile.id, ticketAuthorId: ticket.author_id, categoryAllowed: viewer.profile.role === "specialist" }, payload.data.visibility)) {
      throw new AppError(403, "FORBIDDEN", "Comment rejected");
    }
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase
      .from("comments")
      .insert({ ticket_id: id.data, author_id: viewer.profile.id, body: payload.data.body, visibility: payload.data.visibility })
      .select("id,ticket_id,author_id,body,visibility,created_at")
      .single();
    if (error) throw new AppError(403, "FORBIDDEN", "Comment rejected");
    await supabase.rpc("write_ticket_event", { p_ticket_id: id.data, p_action: `comment.${payload.data.visibility}`, p_request_id: requestId });
    return Response.json({ comment: data }, { status: 201 });
  });
}
