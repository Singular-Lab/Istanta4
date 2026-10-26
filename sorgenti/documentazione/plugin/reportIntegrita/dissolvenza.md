# dissolvenza.js

**Cosa è:** i conti della dissolvenza delle righe del report. Nasce con I20-981 (Lotto 4a); da
I20-1007 sta in `reportIntegrita/`, accanto a [pannelli.js](pannelli.md), l'unico che la usa.

In UXP la proprietà `opacity` viene accettata nello stile ma **non ridisegnata**: il collaudo ha
mostrato dieci passi scritti e riletti dal motore senza che a schermo cambiasse niente. I colori
invece si ridisegnano, e il Plugin lo sa già — il lampo verde della copia, il bordo arancione dei
duplicati. Quindi la dissolvenza porta a zero l'alfa dei colori di testo e sfondo, e le immagini,
che colore non hanno, le spegne a metà strada. Qui non c'è né DOM né InDesign.

## Variabili globali

| nome | valore | perché |
|---|---|---|
| `DURATA_MS` | `300` | breve, perché l'operatore aspetta |
| `PASSO_MS` | `50` | non troppo fitto: UXP ridisegna quando il ciclo degli eventi glielo concede, e un timer serrato non gli lascerebbe spazio |
| `COLORE_TESTO_DI_BASE` | `{17,17,17,1}` | il colore quando il motore non lo dice; il report scrive scuro su chiaro |
| `SOGLIA_IMMAGINI` | `0.5` | sotto questa alfa le immagini si spengono, perché non hanno un colore da attenuare |

## Funzioni

- `numeroDiPassi(durata, passo)` → quanti passi fa la dissolvenza.
- `alfaAlPasso(passo, passi)` → l'alfa da applicare, da 1 escluso a 0 compreso, in modo lineare.
- `analizzaColore(testo)` → legge `rgb()`, `rgba()`, `#rgb`, `#rrggbb`, `#rrggbbaa`. Torna `null`
  per quello che non è un colore pieno — `transparent`, nomi, valori vuoti — perché lì non c'è
  niente da attenuare.
- `coloreConAlfa(colore, alfa)` → l'alfa di partenza si **moltiplica**, così un colore già
  semitrasparente sfuma dal suo livello e non da uno pieno.
- `immaginiSpente(alfa)` → se a questo punto le immagini vanno spente.

**Test:** `node --test tests/plugin/dissolvenza.test.js`
