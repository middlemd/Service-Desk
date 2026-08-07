import test from "node:test";
import assert from "node:assert/strict";
import {
  categorySchema,
  commentSchema,
  createTicketSchema,
  inviteUserSchema,
  parseJson,
  roleChangeSchema,
} from "../lib/validation.ts";
import { errorResponse } from "../lib/errors.ts";

const validTicket = {
  subject: "Не открывается учебный портал",
  description: "После входа появляется нейтральная ошибка доступа.",
  categoryId: "11111111-1111-4111-8111-111111111111",
  priority: "medium",
};

test("серверная схема принимает корректную заявку", () => {
  assert.equal(createTicketSchema.safeParse(validTicket).success, true);
});

test("серверная схема отклоняет HTML, лишние поля, неверные enum и длины", () => {
  assert.equal(createTicketSchema.safeParse({ ...validTicket, subject: "<b>ошибка</b>" }).success, false);
  assert.equal(createTicketSchema.safeParse({ ...validTicket, secret: "extra" }).success, false);
  assert.equal(createTicketSchema.safeParse({ ...validTicket, priority: "urgent" }).success, false);
  assert.equal(createTicketSchema.safeParse({ ...validTicket, description: "a".repeat(501) }).success, false);
  assert.equal(commentSchema.safeParse({ body: "ok", visibility: "private" }).success, false);
});

test("административные схемы используют белые списки и связанные ограничения", () => {
  assert.equal(roleChangeSchema.safeParse({ role: "owner" }).success, false);
  assert.equal(inviteUserSchema.safeParse({ email: "not-email", displayName: "Иван", role: "user", categoryIds: [] }).success, false);
  assert.equal(categorySchema.safeParse({ name: "Почта", firstResponseMinutes: 60, resolutionMinutes: 30, isActive: true }).success, false);
});

test("JSON parser отклоняет неверный Content-Type", async () => {
  const request = new Request("https://desk.example/api/tickets", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  await assert.rejects(parseJson(request), /UNSUPPORTED_MEDIA_TYPE/);
});

test("JSON parser отклоняет malformed JSON как ошибку ввода", async () => {
  const request = new Request("https://desk.example/api/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  const error = await parseJson(request).catch((caught) => caught);
  const response = errorResponse(error, "test-request");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "INVALID_INPUT",
    message: "Проверьте заполнение полей.",
    requestId: "test-request",
  });
});
