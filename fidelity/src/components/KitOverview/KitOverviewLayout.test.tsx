// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_LAVORAZIONE } from "../../../lib/enums";
import type { OrigineStorico, RUNTIME_KIT } from "../../../lib/types";

// Il dettaglio produttivo del kit: file, stato e anomalie della lavorazione. Gli insight del
// volantino stanno nel verticale Volantini e qui non si chiedono né si mostrano.

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));
vi.mock("@/hooks/useProductionTimer", () => ({ useProductionTimer: () => ({ formattedDuration: null, isLive: false }) }));
vi.mock("./ActionPanel", () => ({ default: () => null }));
vi.mock("./FileSection", () => ({ default: () => <section aria-label="File della lavorazione" /> }));
vi.mock("./components", () => ({
  CorreggoCard: () => null,
  HeroBanner: () => null,
  InfoBadges: () => null,
  KitInfo: () => null,
  StatsGrid: () => null,
  Timeline: () => null,
  buildTimelineEvents: () => [],
  ReportStoricoBox: ({ origineStorico }: { origineStorico: OrigineStorico }) => <div>Report import {origineStorico.nomeFile}</div>,
}));

import KitOverviewLayout from "./KitOverviewLayout";

const ORIGINE_STORICO: OrigineStorico = {
  importatoIl: "2026-10-30T10:00:00.000Z",
  nomeFile: "volantino-ottobre.json",
  nonImpaginate: [],
  lasciapassareNonImpaginate: false,
  totaleFuoriListino: 1,
  fuoriListinoIgnorati: 0,
  boxFuoriListino: [],
};

const lavorazione = (dati: Partial<RUNTIME_KIT> = {}) =>
  ({
    guidId: "k1",
    titolo: "Volantino ottobre",
    stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
    files: [],
    ...dati,
  }) as RUNTIME_KIT;

const apri = (kit: RUNTIME_KIT, tipoLavorazione = TIPO_LAVORAZIONE.VOLANTINO) =>
  render(
    <KitOverviewLayout
      lavorazione={kit}
      exportTypes={["Volantino"]}
      exportCodes={[EXPORT_DI_SISTEMA.VOL]}
      tipiDiExportInKit={[]}
      tipoLavorazione={tipoLavorazione}
    />
  );

describe("Dettaglio produttivo del kit", () => {
  beforeEach(() => {
    finti.get.mockReset();
  });

  it("non chiede né mostra gli insight del volantino", () => {
    apri(lavorazione());

    expect(screen.getByRole("region", { name: "File della lavorazione" })).toBeInTheDocument();
    expect(screen.queryByText(/Referenze in volantino/)).not.toBeInTheDocument();
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("il report dell'import da storico resta in produzione e arriva con il kit", () => {
    apri(lavorazione({ origineStorico: ORIGINE_STORICO }));

    expect(screen.getByText("Report import volantino-ottobre.json")).toBeInTheDocument();
    expect(finti.get).not.toHaveBeenCalled();
  });

  it("un kit POP non mostra il report dello storico", () => {
    apri(lavorazione({ origineStorico: ORIGINE_STORICO }), TIPO_LAVORAZIONE.POP);

    expect(screen.queryByText(/Report import/)).not.toBeInTheDocument();
  });
});
