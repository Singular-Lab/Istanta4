import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";

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

  const copyCode = () => {
    navigator.clipboard.writeText(pluginCode);
  };

  return (
    <div className="box p-6">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Nome Template</label>
          <p className="text-base">{template.nome}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Slug (identificatore runtime)</label>
          <code className="block p-2 bg-slate-100 rounded text-sm mt-1">{template.slug}</code>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Snippet di integrazione</label>
          <div className="relative">
            <pre className="p-4 bg-slate-900 text-slate-100 rounded text-xs overflow-x-auto">{pluginCode}</pre>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={copyCode}
              className="absolute top-2 right-2"
            >
              <Lucide icon="Copy" className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PluginConfigPanel;
