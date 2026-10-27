import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import { AUDIT_SEVERITY_LABELS, AuditSeverity } from "../../../lib/auditTypes";

/** Tono della severità di un evento di audit: lo stesso nel registro e nella dashboard Superadmin. */
export const TONO_SEVERITA: Record<string, TonoStato> = {
  [AuditSeverity.CRITICAL]: "danger",
  [AuditSeverity.HIGH]: "warning",
  [AuditSeverity.MEDIUM]: "info",
  [AuditSeverity.LOW]: "neutral",
};

/** Esito di un evento di audit: etichetta, tono e icona del badge. */
export const ESITI_AUDIT: Record<string, { etichetta: string; tono: TonoStato; icona: string }> = {
  SUCCESS: { etichetta: "Successo", tono: "success", icona: "Check" },
  FAILURE: { etichetta: "Fallito", tono: "danger", icona: "X" },
  PARTIAL: { etichetta: "Parziale", tono: "warning", icona: "TriangleAlert" },
};

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <StatusBadge
      tono={TONO_SEVERITA[severity] ?? "neutral"}
      etichetta={AUDIT_SEVERITY_LABELS[severity as AuditSeverity] ?? severity}
      className={className}
    />
  );
}

export function EsitoBadge({ result }: { result: string }) {
  const esito = ESITI_AUDIT[result];
  return esito ? (
    <StatusBadge tono={esito.tono} etichetta={esito.etichetta} icon={esito.icona} />
  ) : (
    <StatusBadge tono="neutral" etichetta={result} icon="Minus" />
  );
}
