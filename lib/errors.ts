export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const neutralMessages: Record<string, string> = {
  UNAUTHENTICATED: "Требуется вход в систему.",
  FORBIDDEN: "Операция недоступна.",
  INVALID_INPUT: "Проверьте заполнение полей.",
  RATE_LIMITED: "Слишком много запросов. Повторите позже.",
  CSRF_REJECTED: "Не удалось подтвердить запрос. Обновите страницу.",
  NOT_CONFIGURED: "Сервис ещё не настроен.",
  INTERNAL: "Не удалось выполнить операцию. Повторите позже.",
};

export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof AppError) {
    return Response.json({ error: error.code, message: neutralMessages[error.code] ?? error.message, requestId }, { status: error.status });
  }
  if (error instanceof Error && error.message === "UNSUPPORTED_MEDIA_TYPE") {
    return Response.json({ error: "INVALID_INPUT", message: neutralMessages.INVALID_INPUT, requestId }, { status: 415 });
  }
  if (error instanceof Error && error.message === "MALFORMED_JSON") {
    return Response.json({ error: "INVALID_INPUT", message: neutralMessages.INVALID_INPUT, requestId }, { status: 400 });
  }
  return Response.json({ error: "INTERNAL", message: neutralMessages.INTERNAL, requestId }, { status: 500 });
}
