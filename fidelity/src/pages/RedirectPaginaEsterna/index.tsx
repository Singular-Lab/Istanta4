import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import SchermataStato from "@/components/SchermataStato";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const RedirectPaginaEsterna = () => {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");

  useEffect(() => {
    if (url) {
      const timer = setTimeout(() => {
        window.open(url, "_blank", "noopener,noreferrer");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [url]);

  return (
    <SchermataStato
      icona="ExternalLink"
      titolo="Entra nella beta di Competitor Analyzer"
      descrizione="Verrai reindirizzato a una pagina esterna."
      azioni={
        url ? (
          <Button
            as="a"
            variant="primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            rounded
            className="px-5 py-2.5"
          >
            <Lucide icon="ExternalLink" aria-hidden="true" className="mr-2 h-4 w-4" />
            Apri ora
          </Button>
        ) : undefined
      }
    >
      {url && <p className="break-all text-sm text-slate-400">{url}</p>}
    </SchermataStato>
  );
};

export default RedirectPaginaEsterna;
