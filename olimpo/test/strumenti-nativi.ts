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

/**
 * Ghostscript disegna le pagine dei PDF. Come per pikepdf: in Docker e in CI c'e' sempre e i test non
 * si saltano mai; in locale, se manca, i test che lo richiedono si saltano con un avviso.
 */
export const GHOSTSCRIPT = process.env.CI === 'true' || spawnSync('gs', ['--version'], { stdio: 'ignore' }).status === 0;

if (!GHOSTSCRIPT) {
  console.warn('Ghostscript non installato: i test che disegnano le pagine dei PDF si saltano. Per eseguirli: apt install ghostscript');
}

/** `it` per i test che richiedono Ghostscript: senza Ghostscript in locale diventa `it.skip`. */
export const itConGhostscript: jest.It = GHOSTSCRIPT ? it : it.skip;
