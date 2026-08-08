import { apiHandler } from "@/lib/api";
import { createAuth0Invitation, deleteAuth0User } from "@/lib/auth0-management";
import { canAdminister } from "@/lib/authz";
import { requireViewer } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { assertSafeMutation } from "@/lib/security";
import { createServiceSupabaseClient, createUserSupabaseClient } from "@/lib/supabase";
import { inviteUserSchema, parseJson } from "@/lib/validation";

export const dynamic = "force-dynamic";

function logInvitationFailure(stage: "profile_provisioning" | "queue_assignment" | "audit", error: { code?: string; message?: string } | null) {
  console.error("Supabase invitation operation failed", {
    stage,
    code: error?.code ?? "",
    message: error?.message?.slice(0, 200) ?? "No provider error returned",
  });
}

function logUserListFailure(error: { code?: string; message?: string }) {
  console.error("Supabase admin user list failed", {
    code: error.code ?? "",
    message: error.message?.slice(0, 200) ?? "No provider error returned",
  });
}

export async function GET(request: Request) {
  return apiHandler(request, async () => {
    const viewer = await requireViewer();
    if (!canAdminister(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Admin required");
    const supabase = createUserSupabaseClient(viewer.idToken);
    const { data, error } = await supabase.from("profiles").select("id,display_name,email,role,state,created_at,specialist_category_access(category_id)").order("created_at", { ascending: false });
    if (error) {
      logUserListFailure(error);
      throw new AppError(500, "INTERNAL", "Profile query failed");
    }
    return Response.json({ users: (data ?? []).map((profile) => {
      const access = Array.isArray(profile.specialist_category_access) ? profile.specialist_category_access : [];
      return {
        ...profile,
        category_ids: access.map((item) => item.category_id),
        specialist_category_access: undefined,
      };
    }) });
  });
}

export async function POST(request: Request) {
  return apiHandler(request, async (requestId) => {
    const viewer = await requireViewer();
    assertSafeMutation(request, viewer.subject);
    if (!canAdminister(viewer.profile.role)) throw new AppError(403, "FORBIDDEN", "Admin required");
    const payload = inviteUserSchema.safeParse(await parseJson(request));
    if (!payload.success) throw new AppError(400, "INVALID_INPUT", "Invalid invitation");

    const authSubject = await createAuth0Invitation(payload.data.email, payload.data.displayName);
    const service = createServiceSupabaseClient();
    const { data: profile, error } = await service
      .from("profiles")
      .insert({
        auth_subject: authSubject,
        display_name: payload.data.displayName,
        email: payload.data.email.toLowerCase(),
        role: payload.data.role,
        state: "invited",
      })
      .select("id,display_name,email,role,state,created_at")
      .single();
    if (error || !profile) {
      logInvitationFailure("profile_provisioning", error);
      await deleteAuth0User(authSubject).catch(() => undefined);
      throw new AppError(500, "INTERNAL", "Profile provisioning failed");
    }
    if (payload.data.role === "specialist" && payload.data.categoryIds.length) {
      const rows = payload.data.categoryIds.map((categoryId) => ({ specialist_id: profile.id, category_id: categoryId, granted_by: viewer.profile.id }));
      const { error: accessError } = await service.from("specialist_category_access").insert(rows);
      if (accessError) {
        logInvitationFailure("queue_assignment", accessError);
        await service.from("profiles").delete().eq("id", profile.id);
        await deleteAuth0User(authSubject).catch(() => undefined);
        throw new AppError(500, "INTERNAL", "Queue assignment failed");
      }
    }
    const userClient = createUserSupabaseClient(viewer.idToken);
    const { data: auditWritten, error: auditError } = await userClient.rpc("write_admin_audit", { p_action: "user.invited", p_object_type: "profile", p_object_id: profile.id, p_request_id: requestId });
    if (auditError || auditWritten !== true) {
      logInvitationFailure("audit", auditError);
      await service.from("profiles").delete().eq("id", profile.id);
      await deleteAuth0User(authSubject).catch(() => undefined);
      throw new AppError(500, "INTERNAL", "Invitation audit failed");
    }
    return Response.json({ user: { ...profile, category_ids: payload.data.role === "specialist" ? payload.data.categoryIds : [] } }, { status: 201 });
  });
}
