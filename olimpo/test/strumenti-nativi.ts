import { spawnSync } from 'child_process';

/**
 * pikepdf (Python) legge lo spazio colore dei .ai e dei PDF (scripts/pdf_colorspace.py). Nell'immagine
 * Docker e in CI c'e' sempre; in locale puo' mancare, e allora i test che lo richiedono si saltano con
 * un avviso. In CI (CI=true) non si saltano mai: un'installazione rotta deve far fallire i test.
 */
export const PIKEPDF = process.env.CI === 'true' || spawnSync('python3', ['-c', 'import pikepdf'], { stdio: 'ignore' }).status === 0;

if (!PIKEPDF) {
  console.warn(
    'pikepdf non installato: i test sullo spazio colore dei .ai si saltano. Per eseguirli: apt install python3-pikepdf (o pip install pikepdf)'
  );
}

/** `it` per i test che richiedono pikepdf: senza pikepdf in locale diventa `it.skip`. */
export const itConPikepdf: jest.It = PIKEPDF ? it : it.skip;
