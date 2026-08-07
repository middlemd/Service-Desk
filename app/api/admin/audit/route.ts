import { apiHandler } from "@/lib/api";
import { canAdminister } from "@/lib/authz";
import { requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { createUserSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiHandler(request, async () => {
    const viewer = await requireViewer();
    if (!canAdminister(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Admin required");
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase
      .from("audit_events")
      .select("id,action,object_type,result,occurred_at,actor:profiles!audit_events_actor_id_fkey(display_name)")
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw new AppError(500, "INTERNAL", "Audit query failed");
    return Response.json({ events: data ?? [] });
  });
}
