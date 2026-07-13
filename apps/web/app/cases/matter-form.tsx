"use client";

import Link from "next/link";
import { useActionState } from "react";
import { claimTypeLabels } from "@/components/claim-type-badge";
import type { Case } from "@/types/database";
import { createMatter, updateMatter, type MatterFormState } from "./actions";

const initialState: MatterFormState = {};

const CLAIM_TYPE_OPTIONS: (keyof typeof claimTypeLabels)[] = [
  "flood", "fire", "water", "wind_hail", "denied", "underpaid",
];
const STATUS_OPTIONS: { value: Case["status"]; label: string }[] = [
  { value: "intake", label: "Intake" },
  { value: "investigation", label: "Investigation" },
  { value: "demand", label: "Demand" },
  { value: "litigation", label: "Litigation" },
  { value: "resolved", label: "Resolved" },
];

const inputClass =
  "mt-1 block w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring";
const labelClass = "block text-sm font-medium text-ink-soft";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-flag">{msg}</p>;
}

export function MatterForm({ mode, initial }: { mode: "create" | "edit"; initial?: Case }) {
  const action = mode === "create" ? createMatter : updateMatter;
  const [state, formAction, pending] = useActionState(action, initialState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && initial && <input type="hidden" name="case_id" value={initial.id} />}

      <div>
        <label htmlFor="title" className={labelClass}>Matter title</label>
        <input id="title" name="title" required defaultValue={initial?.title ?? ""}
          className={inputClass} placeholder="Alvarez v. Shield Mutual — Flood Underpayment" />
        <FieldError msg={fe.title} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="client_name" className={labelClass}>Client name</label>
          <input id="client_name" name="client_name" required defaultValue={initial?.client_name ?? ""}
            className={inputClass} placeholder="Maria Alvarez" />
          <FieldError msg={fe.client_name} />
        </div>
        <div>
          <label htmlFor="claim_type" className={labelClass}>Claim type</label>
          <select id="claim_type" name="claim_type" required
            defaultValue={initial?.claim_type ?? "flood"} className={inputClass}>
            {CLAIM_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{claimTypeLabels[t]}</option>
            ))}
          </select>
          <FieldError msg={fe.claim_type} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="state" className={labelClass}>State</label>
          <input id="state" name="state" required maxLength={2} defaultValue={initial?.state ?? ""}
            className={`${inputClass} uppercase`} placeholder="KY" />
          <FieldError msg={fe.state} />
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Status</label>
          <select id="status" name="status" required
            defaultValue={initial?.status ?? "intake"} className={inputClass}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <FieldError msg={fe.status} />
        </div>
        <div>
          <label htmlFor="date_of_loss" className={labelClass}>Date of loss</label>
          <input id="date_of_loss" name="date_of_loss" type="date"
            defaultValue={initial?.date_of_loss ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="insurer" className={labelClass}>
            Insurer <span className="text-ink-mute">(optional)</span>
          </label>
          <input id="insurer" name="insurer" defaultValue={initial?.insurer ?? ""}
            className={inputClass} placeholder="Shield Mutual" />
        </div>
        <div>
          <label htmlFor="policy_number" className={labelClass}>
            Policy number <span className="text-ink-mute">(optional)</span>
          </label>
          <input id="policy_number" name="policy_number" defaultValue={initial?.policy_number ?? ""}
            className={inputClass} placeholder="SM-FL-448291" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="amount_claimed" className={labelClass}>
            Amount claimed <span className="text-ink-mute">(optional)</span>
          </label>
          <input id="amount_claimed" name="amount_claimed" inputMode="decimal"
            defaultValue={initial?.amount_claimed ?? ""} className={inputClass} placeholder="42000" />
          <FieldError msg={fe.amount_claimed} />
        </div>
        <div>
          <label htmlFor="amount_offered" className={labelClass}>
            Amount offered <span className="text-ink-mute">(optional)</span>
          </label>
          <input id="amount_offered" name="amount_offered" inputMode="decimal"
            defaultValue={initial?.amount_offered ?? ""} className={inputClass} placeholder="9000" />
          <FieldError msg={fe.amount_offered} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input id="is_nfip" name="is_nfip" type="checkbox" defaultChecked={initial?.is_nfip ?? false}
          className="h-4 w-4 rounded border-line text-seal focus:ring-seal-ring" />
        <label htmlFor="is_nfip" className="text-sm text-ink-soft">
          NFIP flood policy (applies federal deadline rules)
        </label>
      </div>

      {state.error && (
        <p className="rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="rounded-[10px] bg-seal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50">
          {pending ? "Saving…" : mode === "create" ? "Create matter" : "Save changes"}
        </button>
        <Link href={mode === "edit" && initial ? `/cases/${initial.id}` : "/cases"}
          className="text-sm text-ink-mute transition hover:text-ink-soft">
          Cancel
        </Link>
      </div>
    </form>
  );
}
