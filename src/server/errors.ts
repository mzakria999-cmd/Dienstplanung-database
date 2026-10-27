export class AppError extends Error {
  constructor(
    public de: string,
    public en: string = de,
    public data?: unknown,
  ) {
    super(de);
  }
}

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string; data?: unknown };
