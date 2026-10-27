import { CodeBlock } from "@/pages/Documentazione/DocsCondivisi";

interface PluginConfigPanelProps {
  template: any;
  templates: any[];
}
// clearOnEmptyAttribute ?: {
//   name: string;
//   value: string;
// };
function PluginConfigPanel({ template, templates }: PluginConfigPanelProps) {
  const pluginCode = `<!-- Elementi HTML -->
<h2 fp-${template.slug}>Le nostre offerte</h2>
<p fp-${template.slug}>Scopri le promozioni attive</p>
<div id="fp-plugin"></div>

<script src="https://cdn.istn.it/1.0.0/index.global.js"></script>
<script>
  (async () => {
    const fp = new FP();

    await fp.init({
      url: '${window.location.origin}/api',
      container: document.getElementById('fp-plugin'),
      slug: '${template.slug}',
      // Opzioni di stile (opzionali)
      styles: {
        gap: '12px',
        padding: '16px',
        grid: {
          columns: 'auto-fill',
          minItemWidth: '280px'
        }
      }
    });

    await fp.render();
  })();
</script>`;

  return (
    <dl className="space-y-4">
      <div>
        <dt className="text-sm font-medium text-slate-700">Nome template</dt>
        <dd className="mt-1 text-slate-800">{template.nome}</dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-slate-700">Slug (identificatore runtime)</dt>
        <dd className="mt-1">
          <code className="block rounded-control bg-slate-100 p-2 font-mono text-sm">{template.slug}</code>
        </dd>
      </div>

      <div>
        <dt className="mb-1 text-sm font-medium text-slate-700">Snippet di integrazione</dt>
        <dd>
          <CodeBlock language="HTML" code={pluginCode} />
        </dd>
      </div>
    </dl>
  );
}

export default PluginConfigPanel;
