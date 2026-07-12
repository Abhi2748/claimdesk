import type { Case, DeadlineRule } from "@/types/database";
import {
  addMonthsToDateOnly,
  daysBetweenDateOnly,
  formatDateOnlyParts,
  getTodayDateOnly,
} from "@/lib/utils";

export type DeadlineUrgency = "urgent" | "warning" | "ok" | "pending";

export interface DeadlineDisplay {
  description: string;
  claimBasis: string;
  periodLabel: string;
  deadlineLabel: string;
  daysRemainingLabel: string;
  urgency: DeadlineUrgency;
  statusLabel: string;
  source: string;
  verified: boolean;
  showDemoDisclaimer: boolean;
}

const DEMO_DISCLAIMER =
  "Demo data — verify against current statutes before relying.";

const NFIP_SOURCE = "SFIP VII.O, p.22";
const NFIP_PENDING_NOTE =
  "1 year from written denial — date pending denial letter";

function urgencyFromDaysRemaining(days: number): {
  urgency: DeadlineUrgency;
  statusLabel: string;
} {
  if (days <= 90) {
    return { urgency: "urgent", statusLabel: "URGENT" };
  }
  if (days <= 180) {
    return { urgency: "warning", statusLabel: "MONITOR" };
  }
  return { urgency: "ok", statusLabel: "OK" };
}

function selectApplicableRule(
  caseRow: Case,
  rules: DeadlineRule[]
): DeadlineRule | null {
  if (caseRow.is_nfip) {
    return (
      rules.find((r) => r.jurisdiction === "FEDERAL-NFIP") ?? null
    );
  }
  return rules.find((r) => r.jurisdiction === caseRow.state) ?? null;
}

export function buildDeadlineDisplay(
  caseRow: Case,
  rules: DeadlineRule[]
): DeadlineDisplay | null {
  const rule = selectApplicableRule(caseRow, rules);
  if (!rule) return null;

  const showDemoDisclaimer = !rule.verified;
  const source =
    rule.jurisdiction === "FEDERAL-NFIP"
      ? NFIP_SOURCE
      : rule.source;

  if (caseRow.is_nfip || rule.clock_starts === "written_denial") {
    return {
      description: rule.description,
      claimBasis: rule.claim_basis,
      periodLabel: rule.period_label,
      deadlineLabel: NFIP_PENDING_NOTE,
      daysRemainingLabel: "—",
      urgency: "pending",
      statusLabel: "DATE PENDING",
      source,
      verified: rule.verified,
      showDemoDisclaimer,
    };
  }

  if (!caseRow.date_of_loss || rule.period_months == null) {
    return {
      description: rule.description,
      claimBasis: rule.claim_basis,
      periodLabel: rule.period_label,
      deadlineLabel: "Date of loss required to compute deadline",
      daysRemainingLabel: "—",
      urgency: "pending",
      statusLabel: "DATE PENDING",
      source,
      verified: rule.verified,
      showDemoDisclaimer,
    };
  }

  const deadline = addMonthsToDateOnly(
    caseRow.date_of_loss,
    rule.period_months
  );
  const today = getTodayDateOnly();
  const daysRemaining = daysBetweenDateOnly(today, deadline);
  const { urgency, statusLabel } = urgencyFromDaysRemaining(daysRemaining);

  const daysRemainingLabel =
    daysRemaining < 0
      ? `${Math.abs(daysRemaining)} days past deadline`
      : daysRemaining === 0
        ? "Due today"
        : `${daysRemaining} days remaining`;

  return {
    description: rule.description,
    claimBasis: rule.claim_basis,
    periodLabel: rule.period_label,
    deadlineLabel: formatDateOnlyParts(deadline),
    daysRemainingLabel,
    urgency,
    statusLabel,
    source,
    verified: rule.verified,
    showDemoDisclaimer,
  };
}

export { DEMO_DISCLAIMER };
