import { apiHandler } from "@/lib/api";
import { canAdminister } from "@/lib/authz";
import { requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createUserSupabaseClient } from "@/lib/supabase";
import { categorySchema, parseJson } from "@/lib/validation";

export async function POST(request: Request) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    if (!canAdminister(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Admin required");
    const payload = categorySchema.safeParse(await parseJson(request));
    if (!payload.success) throw new AppError(400, "INVALID_INPUT", "Invalid category");
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.rpc("admin_create_category", {
      p_name: payload.data.name,
      p_first_response_minutes: payload.data.firstResponseMinutes,
      p_resolution_minutes: payload.data.resolutionMinutes,
      p_is_active: payload.data.isActive,
      p_request_id: requestId,
    });
    if (error || !data) throw new AppError(403, "FORBIDDEN", "Category creation rejected");
    return Response.json({ category: data }, { status: 201 });
  });
}
