import { Trans, useLingui } from "@lingui/react/macro";
import type { DeploymentSettings } from "@rakazo/contracts";
import { SignupAllowlistEntrySchema } from "@rakazo/contracts";
import { Button, Input, Label, Switch } from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type SignupSettings = Pick<
  DeploymentSettings,
  "signupsEnabled" | "signupAllowlist" | "signupAllowlistFromEnv" | "ownerEmailVerified"
>;

export function SignupSettingsPanel() {
  const { t } = useLingui();
  const enabledId = useId();
  const [settings, setSettings] = useState<SignupSettings | null>(null);
  const [entry, setEntry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rpc.deployment
      .get()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err, t`Could not load sign-up settings`));
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function save(input: { signupsEnabled?: boolean; signupAllowlist?: string[] }) {
    setSaving(true);
    setError(null);
    try {
      setSettings(await rpc.deployment.update(input));
      return true;
    } catch (err) {
      setError(errorText(err, t`Could not save sign-up settings`));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    if (!settings || saving) return;
    const parsed = SignupAllowlistEntrySchema.safeParse(entry);
    if (!parsed.success) {
      setError(t`Enter an email address or @domain`);
      return;
    }
    if (settings.signupAllowlist.includes(parsed.data)) {
      setEntry("");
      return;
    }
    if (await save({ signupAllowlist: [...settings.signupAllowlist, parsed.data] })) setEntry("");
  }

  const editable = settings !== null && !settings.signupAllowlistFromEnv && !saving;
  // Emptying the list while sign-ups are on would let anyone register.
  const lastEntryLocked = settings?.signupsEnabled && settings.signupAllowlist.length === 1;

  return (
    <div data-testid="signup-settings" className="pt-1">
      <div className="flex items-center gap-3">
        <Switch
          id={enabledId}
          data-testid="signups-enabled"
          checked={settings?.signupsEnabled ?? false}
          disabled={!settings || saving}
          onCheckedChange={(checked) => void save({ signupsEnabled: checked })}
        />
        <Label htmlFor={enabledId} className="text-[14px] font-normal text-foreground/75">
          <Trans>Allow sign-ups</Trans>
        </Label>
      </div>
      {settings?.signupsEnabled && settings.signupAllowlist.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          <Trans>Anyone can sign up.</Trans>
        </p>
      ) : null}
      {settings?.signupAllowlist.length ? (
        <ul data-testid="signup-allowlist" className="mt-5 space-y-2">
          {settings.signupAllowlist.map((item) => (
            <li
              key={item}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2"
            >
              <span className="min-w-0 truncate text-[13.5px] text-foreground/75">{item}</span>
              {settings.signupAllowlistFromEnv ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  aria-label={t`Remove ${item}`}
                  disabled={!editable || lastEntryLocked}
                  onClick={() =>
                    void save({
                      signupAllowlist: settings.signupAllowlist.filter((other) => other !== item),
                    })
                  }
                >
                  <Trans>Remove</Trans>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {settings?.signupAllowlistFromEnv ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          <Trans>Set by SIGNUP_ALLOWLIST on the server.</Trans>
        </p>
      ) : settings && !settings.ownerEmailVerified && settings.signupAllowlist.length === 0 ? (
        // A first entry would sign out every unverified account, this owner's included.
        <p className="mt-3 text-[13px] text-muted-foreground">
          <Trans>Verify your email address to limit sign-ups.</Trans>
        </p>
      ) : (
        <form className="mt-4 flex gap-2" onSubmit={(event) => void addEntry(event)}>
          <Input
            data-testid="signup-allowlist-entry"
            className="max-w-sm"
            type="text"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            aria-label={t`Email or @domain`}
            placeholder={t`name@example.com or @example.com`}
            value={entry}
            disabled={!editable}
            onChange={(event) => setEntry(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!editable || !entry.trim()}>
            <Trans>Add</Trans>
          </Button>
        </form>
      )}
      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}
