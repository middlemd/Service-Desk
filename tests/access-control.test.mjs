import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdminister,
  canClaimTicket,
  canComment,
  canCreateTicket,
  canEditOwnTicket,
  canReadTicket,
  canTransitionTicket,
} from "../lib/authz.ts";

const ownTicket = {
  role: "user",
  profileId: "user-a",
  ticketAuthorId: "user-a",
  ticketAssigneeId: null,
  ticketStatus: "new",
};

test("анонимный субъект не получает ни чтение, ни изменяющие разрешения", () => {
  const anonymous = { ...ownTicket, role: null };
  assert.equal(canReadTicket(anonymous), false);
  assert.equal(canCreateTicket(null), false);
  assert.equal(canEditOwnTicket(anonymous), false);
  assert.equal(canClaimTicket(anonymous), false);
  assert.equal(canComment(anonymous, "public"), false);
  assert.equal(canAdminister(null), false);
});

test("пользователь читает свою заявку, но не чужую при прямом обращении по ID", () => {
  assert.equal(canReadTicket(ownTicket), true);
  assert.equal(canReadTicket({ ...ownTicket, ticketAuthorId: "user-b" }), false);
  assert.equal(canEditOwnTicket(ownTicket), true);
  assert.equal(canEditOwnTicket({ ...ownTicket, ticketAssigneeId: "specialist-a" }), false);
});

test("специалист видит и берёт заявки только из разрешённой категории", () => {
  const specialist = { role: "specialist", profileId: "specialist-a", categoryAllowed: true, ticketAssigneeId: null, ticketStatus: "new" };
  assert.equal(canReadTicket(specialist), true);
  assert.equal(canClaimTicket(specialist), true);
  assert.equal(canComment(specialist, "internal"), true);
  assert.equal(canReadTicket({ ...specialist, categoryAllowed: false }), false);
  assert.equal(canClaimTicket({ ...specialist, categoryAllowed: false }), false);
  assert.equal(canComment({ ...specialist, categoryAllowed: false }, "public"), false);
});

test("только администратор управляет ролями и справочниками", () => {
  assert.equal(canAdminister("admin"), true);
  assert.equal(canAdminister("specialist"), false);
  assert.equal(canAdminister("user"), false);
});

test("пользователь пишет только публичный комментарий к собственной заявке", () => {
  assert.equal(canComment(ownTicket, "public"), true);
  assert.equal(canComment(ownTicket, "internal"), false);
  assert.equal(canComment({ ...ownTicket, ticketAuthorId: "user-b" }, "public"), false);
});

test("переходы статусов ограничены ролью, владением и текущим статусом", () => {
  assert.equal(canTransitionTicket({ role: "specialist", profileId: "specialist-a", ticketAssigneeId: "specialist-a", categoryAllowed: true, ticketStatus: "in_progress" }, "resolved"), true);
  assert.equal(canTransitionTicket({ role: "specialist", profileId: "specialist-b", ticketAssigneeId: "specialist-a", categoryAllowed: true, ticketStatus: "in_progress" }, "resolved"), false);
  assert.equal(canTransitionTicket({ ...ownTicket, ticketStatus: "resolved" }, "closed"), true);
  assert.equal(canTransitionTicket({ ...ownTicket, ticketStatus: "new" }, "closed"), false);
  assert.equal(canTransitionTicket({ ...ownTicket, role: "admin", ticketStatus: "resolved" }, "closed"), false);
});
