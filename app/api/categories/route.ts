import { apiHandler } from "@/lib/api";
import { getCategories, requireViewer } from "@/lib/dal";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiHandler(request, async () => {
    const viewer = await requireViewer();
    return Response.json({ categories: await getCategories(viewer) });
  });
}
