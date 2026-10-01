"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Shows a pending state on submit without useFormStatus/useFormState — this
 * project's React (18.3, stable channel) doesn't export either; both only
 * exist on React's canary channel pre-19. Instead, listen for the native
 * `submit` event on the button's own form. Every action this is used with
 * ends in redirect() (success or error), which remounts the page, so there's
 * no need to ever set pending back to false by hand.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = () => setPending(true);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <button ref={ref} type="submit" disabled={pending} className={clsx(className ?? "btn-primary", "gap-2")}>
      {pending && (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? pendingLabel ?? "جارٍ الحفظ..." : children}
    </button>
  );
}
