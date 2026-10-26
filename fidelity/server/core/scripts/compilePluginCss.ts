import CleanCSS from 'clean-css';
import * as fs from 'fs';
import * as path from 'path';
import * as sass from 'sass';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCSS_PATH = path.resolve(__dirname, '../../../src/assets/css/webpliant/stylewp.module.scss');
const BOXREF_SCSS_PATH = path.resolve(__dirname, '../../../src/pages/WebPliant/BoxRef/boxref.module.scss');
const OUTPUT_PATH = path.resolve(__dirname, '../assets/plugin-styles.css');

function compileSass(scssPath: string): string {
  try {
    const result = sass.compile(scssPath, {
      style: 'compressed',
      sourceMap: false,
    });
    return result.css;
  } catch {
    return '';
  }
}

async function main() {
  let finalCss = '';

  if (fs.existsSync(SCSS_PATH)) {
    finalCss += compileSass(SCSS_PATH);
  }

  if (fs.existsSync(BOXREF_SCSS_PATH)) {
    finalCss += compileSass(BOXREF_SCSS_PATH);
  }

  const minifiedCss = new CleanCSS({
    level: {
      1: {
        specialComments: '0',
      },
      2: {},
    },
  }).minify(finalCss).styles;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, minifiedCss, 'utf-8');
}

main().catch(console.error);
