import Lucide from "@/components/Base/Lucide";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../../components/Base/Button";

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 ">
      <div className="bg-white dark:bg-darkmode-600 rounded-md  p-8 w-full">
        <Lucide icon="ExternalLink" className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h1 className="text-2xl font-bold mb-2">Entra nella beta di Competitor Analyzer</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Verrai reindirizzato a una pagina esterna.
        </p>
        {url && (
          <>
            <p className="text-sm text-slate-400 mb-4 break-all">{url}</p>
            <Button
              as={"a"}
              variant="primary"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              Apri ora
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default RedirectPaginaEsterna;
