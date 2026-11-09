export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Record not found or you do not have access to it.") {
    super(message);
    this.name = "NotFoundError";
  }
}
export function userMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  if (e && typeof e === "object" && "issues" in e) {
    const issues = (e as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
  }
  console.error(e);
  return "An unexpected error occurred. Please try again.";
}
