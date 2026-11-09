import { prisma } from "@/server/db";
import type { Actor } from "@/server/access";
import { changePasswordAction, confirmMfaAction, disableMfaAction, revokeSessionAction } from "@/server/actions/auth";
import { ActionForm, SubmitButton } from "./ActionForm";
import { MfaSetup } from "./MfaSetup";
import { Card, Field } from "./ui";
import { fmtDateTime } from "@/shared/format";

export async function SecuritySettings({ actor, mustChange }: { actor: Actor; mustChange?: boolean }) {
  const [user, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: actor.id } }),
    prisma.session.findMany({ where: { userId: actor.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Change password">
        {(mustChange || user.mustChangePassword) && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">You are using a temporary password. Please set a new one now.</p>}
        <ActionForm action={changePasswordAction} resetOnSuccess>
          <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className="input" /></Field>
          <Field label="New password" hint="At least 10 characters with letters and numbers"><input name="next" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
          <Field label="Confirm new password"><input name="confirm" type="password" required autoComplete="new-password" className="input" /></Field>
          <SubmitButton>Change password</SubmitButton>
        </ActionForm>
      </Card>
      <Card title="Two-step verification (authenticator app)">
        {user.mfaEnabled ? (
          <ActionForm action={disableMfaAction}>
            <p className="text-sm text-brand-800">Enabled. A 6-digit code is required at every sign-in.</p>
            <Field label="Confirm with your password to disable"><input name="password" type="password" required className="input" /></Field>
            <SubmitButton className="btn-outline">Disable</SubmitButton>
          </ActionForm>
        ) : (
          <MfaSetup confirmAction={confirmMfaAction} />
        )}
      </Card>
      <Card title="Active sessions" className="lg:col-span-2">
        <ul className="divide-y divide-slate-100 text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {s.userAgent?.slice(0, 80) ?? "Unknown device"} {s.id === actor.sessionId && <b className="text-brand-700">(this session)</b>}
                <br />
                <span className="text-xs text-slate-500">IP {s.ip ?? "—"} · signed in {fmtDateTime(s.createdAt)} · last active {fmtDateTime(s.lastSeenAt)}</span>
              </span>
              {s.id !== actor.sessionId && (
                <form action={revokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn-outline btn-sm">Sign out</button></form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
