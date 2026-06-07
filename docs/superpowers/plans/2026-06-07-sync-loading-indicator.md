# Sync Loading Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact accessible loading indicator to the existing Google Drive sync status UI while the app is signing in or syncing.

**Architecture:** Keep the indicator inside `SyncStatus` because that component already owns sync status rendering and button disabled states. Use the existing `SyncStatus.kind` values (`signing-in`, `syncing`) and existing `isBusy` variable; do not add new sync state or storage behavior. Style the indicator in `src/index.css` using CSS variables and a lightweight CSS animation.

**Tech Stack:** React 18, TypeScript 5.6, Vitest, React Testing Library, single global stylesheet `src/index.css`.

---

## Scope Check

This is one focused UI enhancement. It does not change Google Drive provider behavior, sync orchestration, IndexedDB persistence, or automatic sync triggers. It only improves feedback during existing busy states.

## File Structure

- Modify `src/components/SyncStatus.tsx`: render an inline spinner and accessible status text when `status.kind` is `signing-in` or `syncing`.
- Modify `src/components/SyncStatus.test.tsx`: add tests for the loading indicator in both busy states and verify the sign-in/sync buttons remain disabled.
- Modify `src/index.css`: add spinner layout, animation, and reduced-motion styling.

## Shared Test Commands

Run targeted tests after the component change:

```powershell
npm run test -- src/components/SyncStatus.test.tsx --run
```

Run full project verification before finishing:

```powershell
npm run test -- --run
npm run build
```

Expected final result: targeted tests pass, full Vitest suite passes, and production build passes.

---

### Task 1: Add Accessible Busy Indicator To SyncStatus

**Files:**
- Modify: `src/components/SyncStatus.test.tsx`
- Modify: `src/components/SyncStatus.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing tests for busy states**

Append these tests inside the existing `describe('SyncStatus', () => { ... })` block in `src/components/SyncStatus.test.tsx`:

```tsx
  it('shows a loading indicator while signing in', () => {
    render(
      <SyncStatus
        status={status({ kind: 'signing-in' })}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSyncNow={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: 'Accesso in corso...' })).not.toBeNull()
    expect(screen.getByText('Accesso in corso...')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Accedi a Google Drive' })).toHaveProperty('disabled', true)
  })

  it('shows a loading indicator while syncing', () => {
    render(
      <SyncStatus
        status={status({
          kind: 'syncing',
          account: { id: '1', email: 'student@example.com', provider: 'google-drive' },
        })}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSyncNow={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: 'Sincronizzazione in corso...' })).not.toBeNull()
    expect(screen.getByText(/student@example.com/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Sincronizza ora' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Esci' })).toHaveProperty('disabled', true)
  })
```

- [ ] **Step 2: Run the failing component tests**

Run:

```powershell
npm run test -- src/components/SyncStatus.test.tsx --run
```

Expected: FAIL because no element with `role="status"` exists yet.

- [ ] **Step 3: Render the busy indicator in SyncStatus**

Modify `src/components/SyncStatus.tsx`.

Inside the component, keep the existing `isBusy` variable and add:

```tsx
  const label = statusLabel(status)
```

Replace the current status text block:

```tsx
        <p className="sync-status__text">
          {status.account ? `${status.account.email} - ${statusLabel(status)}` : statusLabel(status)}
        </p>
```

with:

```tsx
        <p className="sync-status__text">
          {status.account ? `${status.account.email} - ${label}` : label}
        </p>
        {isBusy && (
          <div className="sync-status__busy" role="status" aria-label={label}>
            <span className="sync-status__spinner" aria-hidden="true" />
            <span>{label}</span>
          </div>
        )}
```

The resulting component body should still use the existing `isBusy` value for button disabled states:

```tsx
export function SyncStatus({ status, onSignIn, onSignOut, onSyncNow, onResolveConflict }: SyncStatusProps) {
  const isBusy = status.kind === 'signing-in' || status.kind === 'syncing'
  const label = statusLabel(status)

  return (
    <section className="sync-status" aria-label="Sincronizzazione">
      <div>
        <p className="sync-status__title">Google Drive</p>
        <p className="sync-status__text">
          {status.account ? `${status.account.email} - ${label}` : label}
        </p>
        {isBusy && (
          <div className="sync-status__busy" role="status" aria-label={label}>
            <span className="sync-status__spinner" aria-hidden="true" />
            <span>{label}</span>
          </div>
        )}
      </div>
      <div className="sync-status__actions">
        {status.account ? (
          <>
            <button type="button" disabled={isBusy} onClick={() => void onSyncNow()}>
              Sincronizza ora
            </button>
            <button type="button" disabled={isBusy} onClick={() => void onSignOut()}>
              Esci
            </button>
          </>
        ) : (
          <button type="button" disabled={isBusy} onClick={() => void onSignIn()}>
            Accedi a Google Drive
          </button>
        )}
      </div>
      {status.kind === 'conflict' && status.conflicts.length > 0 && (
        <div className="sync-status__conflicts">
          <ul>
            {status.conflicts.map((conflict) => (
              <li key={`${conflict.kind}-${conflict.id}`}>
                {conflict.id}: {conflict.kind}
              </li>
            ))}
          </ul>
          {onResolveConflict && (
            <div className="sync-status__conflict-actions">
              <button type="button" onClick={() => void onResolveConflict('keep-remote')}>
                Mantieni remoto
              </button>
              <button type="button" onClick={() => void onResolveConflict('keep-local')}>
                Mantieni locale
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Add spinner styles**

Append this CSS after the existing `.sync-status__text` rule in `src/index.css`:

```css
.sync-status__busy {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.45rem;
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 600;
}

.sync-status__spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: sync-status-spin 0.8s linear infinite;
}

@keyframes sync-status-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sync-status__spinner {
    animation: none;
  }
}
```

- [ ] **Step 5: Run component tests**

Run:

```powershell
npm run test -- src/components/SyncStatus.test.tsx --run
```

Expected: PASS. The two new tests should find `role="status"` and confirm disabled buttons.

- [ ] **Step 6: Run full verification**

Run:

```powershell
npm run test -- --run
npm run build
```

Expected:
- Vitest passes.
- TypeScript and Vite production build pass.
- Vite may still print the existing chunk-size warning; that warning does not fail the build.

- [ ] **Step 7: Commit**

```powershell
git add src/components/SyncStatus.tsx src/components/SyncStatus.test.tsx src/index.css
git commit -m "feat: show sync loading indicator"
```

---

## Manual Verification

After implementation, verify in the app:

1. Start the web app:

   ```powershell
   npm run dev
   ```

2. On the Home page, click `Accedi a Google Drive`.
3. Confirm the Google Drive status shows a spinner and `Accesso in corso...` while sign-in is pending.
4. After sign-in completes and sync starts, confirm the status shows a spinner and `Sincronizzazione in corso...`.
5. Confirm the spinner disappears when the status changes to `Sincronizzato`.
6. Confirm buttons are disabled only while signing in or syncing.

For Tauri:

```powershell
npm run tauri:dev
```

Repeat the same sign-in and sync status checks in the desktop shell.

## Self-Review Checklist

- Spec coverage: The plan adds a visible loading indicator for `signing-in` and `syncing`, keeps existing failure/conflict behavior, and avoids changing sync orchestration.
- Placeholder scan: No `TBD`, `TODO`, or unspecified "add tests" steps remain.
- Type consistency: Uses existing `SyncStatus.kind`, existing `statusLabel()`, existing `isBusy`, and existing CSS naming pattern `sync-status__*`.
- Scope check: Single focused component/CSS/test change; no provider, storage, route, or sync-service changes are included.
