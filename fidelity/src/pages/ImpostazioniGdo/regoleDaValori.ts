import type { RegolaMenabo, ValoreSuggerito } from "../../../lib/impostazioniGdo/tipi";

const chiaveNome = (nome: string) => nome.toLocaleLowerCase("it-IT").replace(/\s+/g, "");

export interface RegoleGenerate {
  regole: RegolaMenabo[];
  /** Quanti gruppi si sono saltati perché c'è già una regola con lo stesso titolo. */
  saltate: number;
}

/**
 * Le regole di partenza dai valori reali del campo del menabò (per Conad CNO la mastro): una regola per ogni
 * nome leggibile, con tutti i valori che lo danno (condizione «è uno di», o «è uguale a» se è uno solo) e il nome
 * proposto dalla libreria agenzia. I valori che non sono una sezione (la pagina bianca) vanno in una regola «non è
 * una sezione». Le regole escono dalla più usata; chi le ha generate le corregge, e non si salvano da sole.
 * Una regola con lo stesso titolo di una già presente non si ripete.
 */
export function regoleDaValori(
  campo: string,
  valori: readonly ValoreSuggerito[],
  esistenti: readonly RegolaMenabo[],
  idNuovo: () => string
): RegoleGenerate {
  interface Gruppo { nome: string | null; valori: string[]; referenze: number }
  const gruppi = new Map<string, Gruppo>();
  for (const voce of valori) {
    const nome = voce.nomeLeggibile === undefined ? voce.valore : voce.nomeLeggibile;
    const chiave = nome === null ? "\u0000non-sezione" : chiaveNome(nome);
    const gruppo = gruppi.get(chiave) ?? { nome: nome === null ? null : nome, valori: [], referenze: 0 };
    gruppo.valori.push(voce.valore);
    gruppo.referenze += voce.referenze;
    gruppi.set(chiave, gruppo);
  }
  const titoliEsistenti = new Set(esistenti.map((regola) => regola.titolo).filter((titolo): titolo is string => !!titolo));
  const regole: RegolaMenabo[] = [];
  let saltate = 0;
  for (const gruppo of [...gruppi.values()].sort((a, b) => b.referenze - a.referenze)) {
    const titolo = gruppo.nome === null ? `Da ${campo}: non è una sezione` : `Da ${campo}: ${gruppo.nome}`;
    if (titoliEsistenti.has(titolo)) {
      saltate += 1;
      continue;
    }
    const unico = gruppo.valori.length === 1;
    regole.push({
      id: idNuovo(),
      titolo,
      livello: "box",
      sezione: gruppo.nome,
      colore: null,
      condizione: {
        tipo: "gruppo",
        logica: "tutte",
        figli: [{
          tipo: "condizione",
          campo,
          operatore: unico ? "uguale" : "uno_di",
          valore: unico ? gruppo.valori[0] : "",
          valori: unico ? [] : gruppo.valori,
        }],
      },
    });
  }
  return { regole, saltate };
}
