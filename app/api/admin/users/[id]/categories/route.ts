import { apiHandler } from "@/lib/api";
import { canAdminister } from "@/lib/authz";
import { requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { categoryAssignmentSchema, parseJson, uuidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    if (!canAdminister(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Admin required");
    const id = uuidSchema.safeParse((await params).id);
    const payload = categoryAssignmentSchema.safeParse(await parseJson(request));
    if (!id.success || !payload.success) throw new AppError(400, "INVALID_INPUT", "Invalid queue assignment");

    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.rpc("admin_set_specialist_categories", {
      p_profile_id: id.data,
      p_category_ids: payload.data.categoryIds,
      p_request_id: requestId,
    });
    if (error || data !== true) throw new AppError(403, "FORBIDDEN", "Queue assignment rejected");
    return Response.json({ categoryIds: payload.data.categoryIds });
  });
}
