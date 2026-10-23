import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTO_DISSINCRONIA } from "../../lib/dissincronia";
import { ascoltaDissincronia, INTERVALLO_AVVISO_DISSINCRONIA_MS, registraNotifica } from "./erroriServizi";

// In development Istanta irraggiungibile: l'utente vede solo un avviso di dissincronia, non un errore

describe("ascoltaDissincronia", () => {
  afterEach(() => registraNotifica(null));

  it("mostra un avviso giallo e ne raggruppa gli eventi ravvicinati", () => {
    const notifica = vi.fn();
    registraNotifica(notifica);
    const bersaglio = new EventTarget();
    let adesso = 1000;
    const smetti = ascoltaDissincronia(bersaglio, () => adesso);

    bersaglio.dispatchEvent(new CustomEvent(EVENTO_DISSINCRONIA, { detail: "/ACPV/eliminaArea" }));
    bersaglio.dispatchEvent(new CustomEvent(EVENTO_DISSINCRONIA, { detail: "/ACPV/eliminaArea" }));
    adesso += INTERVALLO_AVVISO_DISSINCRONIA_MS;
    bersaglio.dispatchEvent(new CustomEvent(EVENTO_DISSINCRONIA, { detail: "/ACPV/salvaPV" }));

    expect(notifica).toHaveBeenCalledTimes(2);
    expect(notifica.mock.calls[0][1]).toMatchObject({ variant: "warning" });

    smetti();
    adesso += INTERVALLO_AVVISO_DISSINCRONIA_MS;
    bersaglio.dispatchEvent(new CustomEvent(EVENTO_DISSINCRONIA, { detail: "/ACPV/salvaPV" }));
    expect(notifica).toHaveBeenCalledTimes(2);
  });
});
