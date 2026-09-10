// Test standalone per buildCoopfiPolicyFromCodeV2
// Esegui con: node test-coopfi-policy-v2.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const rawCoopfiOrganigramma = require(
  "./server/core/agenzia_lib/coopfi/utility/data/coopfi-organigramma.json"
);

const { aree, ruoli, settori } = rawCoopfiOrganigramma;
const settoriSorted = [...settori].sort((a, b) => b.code.length - a.code.length);
const areeSorted = [...aree].sort((a, b) => b.code.length - a.code.length);
const ruoliSorted = [...ruoli].sort((a, b) => b.code.length - a.code.length);
function buildCoopfiPolicyFromCodeV2(codicePosizione) {
  // basati su esempio di ASS_CATDMASS
  let tree;
  let codicePosizioneDaManipolare = codicePosizione;
  const ruolo = codicePosizioneDaManipolare.split("_")[0].toUpperCase();
  codicePosizioneDaManipolare = codicePosizioneDaManipolare.split("_")[1].toUpperCase();
  //qua facciamo una normalizazione per togliere i numeri per ora
  const foundRuolo = ruoli.find(r => r.code == ruolo) != undefined;
  if (!foundRuolo) {
    throw new Error("Ruolo non trovato: " + ruolo);
  }
  tree = {
    nodeType: "Settore",
    nodeValue: ruolo,
    codificaFICO: ruoli.find(r => r.code == ruolo).codificaFico,
    children: []
  };
  let depthAlbero = 1;
  let repartoCorrente = null;
  console.log(codicePosizioneDaManipolare, "CODICE DOPO CHE è STATO TOLTO IL RUOLO.")
  const costruisciAlberoRecursivo = (_tree, _depthAlbero) => {
    if (codicePosizioneDaManipolare.length == 0) return true;
    console.log(`SIAMO AL DEPTH ${_depthAlbero} & LA STRINGA è ${codicePosizioneDaManipolare}`)
    for (const settore of settoriSorted) {
      if (!codicePosizioneDaManipolare.startsWith(settore.code)) continue;
      console.log("Settore trovato: " + settore.code);
      const savedCodice = codicePosizioneDaManipolare;
      const savedReparto = repartoCorrente;
      if (codicePosizioneDaManipolare.startsWith(settore.code)) {
        codicePosizioneDaManipolare = codicePosizioneDaManipolare.slice(settore.code.length);
        //se rimangono numeri allora vanno tolti es:BYR_BRSTMU2
      }
      console.log("codicePosizioneDaManipolare dopo rimozione " + settore.code + ": " + codicePosizioneDaManipolare);
      _tree.children.push({
        nodeType: "Reparto",
        nodeValue: settore.code,
        codificaFICO: settore.codificaFico,
        children: [],
      });
      repartoCorrente = _tree.children[_tree.children.length - 1];
      if (costruisciAlberoRecursivo(_tree, _depthAlbero + 1)) return true;
      // BACKTRACK settore: il sottoalbero non ha consumato tutto → annullo la scelta
      console.log(`  ↩ BACKTRACK settore "${settore.code}": rimasto "${codicePosizioneDaManipolare}", ripristino "${savedCodice}"`);
      _tree.children.pop();
      codicePosizioneDaManipolare = savedCodice;
      repartoCorrente = savedReparto;
      console.log(`  ↩ Stato ripristinato → codice="${codicePosizioneDaManipolare}", repartoCorrente="${savedReparto?.nodeValue ?? 'null'}"`);
    };
    // for (const ruolo of ruoliSorted) {
    //   if (!codicePosizioneDaManipolare.startsWith(ruolo.code)) continue;
    //   const savedCodice = codicePosizioneDaManipolare;
    //   const savedReparto = repartoCorrente;
    //   console.log("Ruolo trovato: " + ruolo.code)
    //   if (codicePosizioneDaManipolare.startsWith(ruolo.code)) {
    //     codicePosizioneDaManipolare = codicePosizioneDaManipolare.slice(ruolo.code.length);
    //   }
    //   _tree.children.push({
    //     nodeType: "Settore",
    //     nodeValue: ruolo.code,
    //     children: [],
    //     codificaFICO: ""
    //   })
    //   if (costruisciAlberoRecursivo(_tree, _depthAlbero + 1)) return true;
    //   // BACKTRACK ruolo: il sottoalbero non ha consumato tutto → annullo la scelta
    //   console.log(`  ↩ BACKTRACK ruolo "${ruolo.code}": rimasto "${codicePosizioneDaManipolare}", ripristino "${savedCodice}"`);
    //   _tree.children.pop();
    //   codicePosizioneDaManipolare = savedCodice;
    //   repartoCorrente = savedReparto;
    //   console.log(`  ↩ Stato ripristinato → codice="${codicePosizioneDaManipolare}", repartoCorrente="${savedReparto?.nodeValue ?? 'null'}"`);
    // }
    for (const area of areeSorted) {
      if (!codicePosizioneDaManipolare.startsWith(area.code)) continue;
      const savedCodice = codicePosizioneDaManipolare;
      const savedReparto = repartoCorrente;
      console.log("Area trovata: " + area.code);
      if (codicePosizioneDaManipolare.startsWith(area.code)) {
        codicePosizioneDaManipolare = codicePosizioneDaManipolare.slice(area.code.length);
      }
      console.log("codicePosizioneDaManipolare dopo rimozione " + area.code + ": " + codicePosizioneDaManipolare);
      (repartoCorrente ?? _tree).children.push({
        nodeType: "Area",
        nodeValue: area.code,
        codificaFICO: area.codificaFico,
        children: []
      });
      if (costruisciAlberoRecursivo(_tree, _depthAlbero + 1)) return true;
      // BACKTRACK area: il sottoalbero non ha consumato tutto → annullo la scelta
      console.log(`  ↩ BACKTRACK area "${area.code}": rimasto "${codicePosizioneDaManipolare}", ripristino "${savedCodice}"`);
      (repartoCorrente ?? _tree).children.pop();
      codicePosizioneDaManipolare = savedCodice;
      repartoCorrente = savedReparto;
      console.log(`  ↩ Stato ripristinato → codice="${codicePosizioneDaManipolare}", repartoCorrente="${savedReparto?.nodeValue ?? 'null'}"`);
    };


    return false;
  };
  costruisciAlberoRecursivo(tree, depthAlbero);
  return tree;
}

// --- TEST CASES ---
const testCases = [
  "IMP_HD",
  // aggiungi altri input qui:
  // "ALTRO_CODICE",
];

for (const input of testCases) {
  console.log("\n" + "=".repeat(60));
  console.log("INPUT:", input);
  console.log("=".repeat(60));
  try {
    const result = buildCoopfiPolicyFromCodeV2(input);
    console.log("\nRISULTATO:");
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("ERRORE:", e.message);
  }
}
