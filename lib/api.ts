import "server-only";

import { errorResponse } from "./errors";
import { requestId } from "./security";

export async function apiHandler(request: Request, handler: (requestId: string) => Promise<Response>) {
  const id = requestId(request);
  try {
    const response = await handler(id);
    response.headers.set("x-request-id", id);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    const response = errorResponse(error, id);
    response.headers.set("cache-control", "no-store");
    return response;
  }
}
