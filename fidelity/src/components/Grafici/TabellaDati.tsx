/**
 * I dati del grafico in una tabella per le tecnologie assistive (nascosta alla vista): ogni
 * valore che il grafico mostra con un segno o con il tooltip si raggiunge anche da qui.
 * La nasconde un contenitore: una tabella non scende sotto la larghezza del suo contenuto, e con
 * sr-only addosso sporgerebbe dalla pagina facendola scorrere in orizzontale.
 */
export function TabellaDati({ titolo, colonne, righe }: { titolo: string; colonne: string[]; righe: Array<Array<string | number>> }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{titolo}</caption>
        <thead>
          <tr>
            {colonne.map((colonna, i) => (
              <th key={i} scope="col">
                {colonna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righe.map((riga, i) => (
            <tr key={i}>
              {riga.map((cella, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cella}
                  </th>
                ) : (
                  <td key={j}>{cella}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TabellaDati;
