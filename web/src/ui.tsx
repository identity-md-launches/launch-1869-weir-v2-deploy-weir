import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAddress, type Address } from "viem";
import { useRuntime, type TxState } from "./data";
import { errorText, short } from "./domain";

export function External({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
export function AddressView({
  value,
  full = false,
}: {
  value: Address;
  full?: boolean;
}) {
  const r = useRuntime();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="address">
      <External href={`${r.deployment.network.explorer}/address/${value}`}>
        <span title={getAddress(value)}>
          {full ? getAddress(value) : short(getAddress(value))}
        </span>
      </External>
      <button
        type="button"
        className="copy"
        aria-label={`Copy address ${getAddress(value)}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(getAddress(value));
            setCopied(true);
            setError("");
          } catch {
            setError("Copy failed. Select the full address to copy it.");
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      {error && <small role="status">{error}</small>}
    </span>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={error ? "notice error" : "notice"}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
export function QueryState({
  query,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}) {
  if (query.isError)
    return (
      <div className="query-error">
        <Notice error>{errorText(query.error)}</Notice>
        <button onClick={() => query.refetch()}>Try again</button>
      </div>
    );
  if (query.isPending)
    return (
      <p role="status" className="muted">
        Reading the chain…
      </p>
    );
  return null;
}
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-describedby":
          [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
            .filter(Boolean)
            .join(" ") || undefined,
        "aria-invalid": !!error,
      })
    : children;
  return (
    <label className="field">
      <span>{label}</span>
      {control}
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function TxFeedback({ state }: { state: TxState }) {
  const r = useRuntime();
  return (
    <div className="tx-feedback" role="status" aria-live="polite">
      {state.phase === "error" && <p className="field-error">{state.error}</p>}
      {state.phase === "success" && <p>Confirmed on-chain.</p>}
      {state.hash && (
        <External href={`${r.deployment.network.explorer}/tx/${state.hash}`}>
          View transaction
        </External>
      )}
    </div>
  );
}
export function TxButton({
  label,
  pending,
  phase,
  disabled,
  onClick,
  primary = false,
  danger = false,
}: {
  label: string;
  pending: boolean;
  phase: TxState["phase"];
  disabled?: boolean;
  onClick: () => unknown;
  primary?: boolean;
  danger?: boolean;
}) {
  const detail =
    phase === "checking"
      ? "Checking…"
      : phase === "signing"
        ? "Confirm in wallet…"
        : phase === "refreshing"
          ? "Refreshing…"
          : "Confirming…";
  return (
    <button
      type="button"
      className={primary ? "primary" : danger ? "danger" : ""}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={onClick}
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      {label}
      {pending ? ` · ${detail}` : ""}
    </button>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current!;
    const before = document.activeElement as HTMLElement;
    el.showModal();
    return () => {
      el.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      className="dialog"
      ref={ref}
      aria-labelledby={id}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const items = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length > 0);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Title({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="title-row">
      <h1 tabIndex={-1}>{children}</h1>
      {aside}
    </div>
  );
}
