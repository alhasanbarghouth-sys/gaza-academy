"use client";

import { useRef } from "react";
import { updateUserRole } from "../actions";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import type { UserRole } from "@/types/database";

export default function RoleSelectForm({ userId, currentRole, roles }: { userId: string; currentRole: UserRole; roles: UserRole[] }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateUserRole} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        onChange={() => formRef.current?.requestSubmit()}
        className="input py-1 text-xs"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS_AR[r]}
          </option>
        ))}
      </select>
    </form>
  );
}
