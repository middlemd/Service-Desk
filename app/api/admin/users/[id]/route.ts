import { apiHandler } from "@/lib/api";
import { canAdminister } from "@/lib/authz";
import { requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { parseJson, roleChangeSchema, uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    if (!canAdminister(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Admin required");
    const id = uuidSchema.safeParse((await context.params).id);
    const payload = roleChangeSchema.safeParse(await parseJson(request));
    if (!id.success || !payload.success || id.data === viewer.profile.id) throw new AppError(400, "INVALID_INPUT", "Invalid role update");
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.rpc("admin_update_role", { p_profile_id: id.data, p_role: payload.data.role, p_request_id: requestId });
    if (error || !data) throw new AppError(403, "FORBIDDEN", "Role update rejected");
    return Response.json({ user: data });
  });
}
