import { Font } from "@react-pdf/renderer";
import corsivo from "@/assets/fonts/report/NotoSans-Italic.ttf?url";
import regolare from "@/assets/fonts/report/NotoSans-Regular.ttf?url";
import seminero from "@/assets/fonts/report/NotoSans-SemiBold.ttf?url";
import { FAMIGLIA_REPORT } from "./misure";

/**
 * Noto Sans (SIL Open Font License 1.1, src/assets/fonts/report/OFL.txt) per il report PDF del
 * volantino: tre pesi, serviti come file da Vite e scaricati solo quando si genera il report.
 *
 * La sillabazione automatica non si cambia qui con Font.registerHyphenationCallback, che varrebbe
 * per tutti i PDF dell'applicazione (anche il report dei tracciati): il documento la toglie testo
 * per testo (componenti.tsx, Testo).
 */

let registrata = false;

export function registraFontReport(): void {
  if (registrata) return;
  Font.register({
    family: FAMIGLIA_REPORT,
    fonts: [
      { src: regolare, fontWeight: 400 },
      { src: corsivo, fontWeight: 400, fontStyle: "italic" },
      { src: seminero, fontWeight: 600 },
    ],
  });
  registrata = true;
}
