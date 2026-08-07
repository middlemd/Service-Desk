import { z } from "zod";
import { APP_ROLES, COMMENT_VISIBILITIES, PRIORITIES, TICKET_STATUSES } from "./types.ts";

const plainText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[<>]/.test(value), "HTML-разметка не разрешена");

export const uuidSchema = z.string().uuid();

export const createTicketSchema = z.object({
  subject: plainText(80).min(5),
  description: plainText(500).min(10),
  categoryId: uuidSchema,
  priority: z.enum(PRIORITIES).exclude(["critical"]),
}).strict();

export const updateOwnTicketSchema = z.object({
  subject: plainText(80).min(5),
  description: plainText(500).min(10),
  categoryId: uuidSchema,
  priority: z.enum(PRIORITIES).exclude(["critical"]),
}).strict();

export const commentSchema = z.object({
  body: plainText(300).min(2),
  visibility: z.enum(COMMENT_VISIBILITIES),
}).strict();

export const transitionSchema = z.object({ status: z.enum(TICKET_STATUSES) }).strict();

export const roleChangeSchema = z.object({ role: z.enum(APP_ROLES) }).strict();

export const categoryAssignmentSchema = z.object({ categoryIds: z.array(uuidSchema).max(30) }).strict();

export const inviteUserSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: plainText(80).min(2),
  role: z.enum(APP_ROLES),
  categoryIds: z.array(uuidSchema).max(30).default([]),
}).strict();

export const categorySchema = z.object({
  name: plainText(80).min(2),
  firstResponseMinutes: z.number().int().min(5).max(10080),
  resolutionMinutes: z.number().int().min(15).max(43200),
  isActive: z.boolean().default(true),
}).strict().refine((value) => value.resolutionMinutes >= value.firstResponseMinutes, {
  message: "Срок решения не может быть меньше срока первого ответа",
  path: ["resolutionMinutes"],
});

export async function parseJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new Error("UNSUPPORTED_MEDIA_TYPE");
  try {
    return await request.json() as unknown;
  } catch {
    throw new Error("MALFORMED_JSON");
  }
}
