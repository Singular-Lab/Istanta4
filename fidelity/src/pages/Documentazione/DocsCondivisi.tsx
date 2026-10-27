import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { twMerge } from "@/utils/twMerge";

/** Percorso dalla Documentazione alla pagina corrente, in cima al contenuto delle guide. */
export function DocsBreadcrumb({ corrente }: { corrente: string }) {
  return (
    <nav aria-label="Percorso" className="mb-6 flex items-center gap-2 text-sm text-slate-500">
      <Link to="/documentazione" className="flex items-center gap-1 hover:text-primary">
        <Lucide icon="BookOpen" aria-hidden="true" className="h-4 w-4" />
        Documentazione
      </Link>
      <Lucide icon="ChevronRight" aria-hidden="true" className="h-4 w-4" />
      <span aria-current="page" className="font-medium text-slate-700">
        {corrente}
      </span>
    </nav>
  );
}

interface CodeBlockProps {
  code: string;
  /** Linguaggio o titolo mostrato nell'intestazione del blocco, per esempio "cURL". */
  language: string;
  className?: string;
}

/** Blocco di codice con intestazione e pulsante "Copia". */
export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Errore nella copia:", err);
    }
  };

  return (
    <div className={twMerge("overflow-hidden rounded-card border border-slate-200", className)}>
      <div className="flex items-center justify-between gap-3 bg-slate-100 px-4 py-2">
        <span className="text-sm font-medium text-slate-700">{language}</span>
        <Button variant="outline-secondary" size="sm" onClick={copyToClipboard}>
          <Lucide icon={copied ? "Check" : "Copy"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
          {copied ? "Copiato!" : "Copia"}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-slate-900 p-4 text-slate-100">
        <code className="font-mono text-sm">{code}</code>
      </pre>
    </div>
  );
}

interface DocsGuidaProps {
  titolo: string;
  descrizione: ReactNode;
  /** Nome della guida nel percorso, per esempio "Guida Rapida". */
  corrente: string;
  children: ReactNode;
}

/**
 * Struttura comune delle guide: intestazione con il ritorno all'indice e un'unica sezione
 * con il percorso in cima e i capitoli uno sotto l'altro.
 */
export function DocsGuida({ titolo, descrizione, corrente, children }: DocsGuidaProps) {
  return (
    <Pagina
      titolo={titolo}
      descrizione={descrizione}
      indietro={{ to: "/documentazione", etichetta: "Torna alla documentazione" }}
    >
      <Sezione aria-label={corrente}>
        <DocsBreadcrumb corrente={corrente} />
        <div className="flex flex-col gap-8">{children}</div>
      </Sezione>
    </Pagina>
  );
}

interface DocsCapitoloProps {
  titolo: ReactNode;
  /** Nome dell'icona Lucide accanto al titolo. */
  icona: string;
  /** Colore dell'icona (classe testo con un token, per esempio "text-success"). */
  coloreIcona?: string;
  className?: string;
  children: ReactNode;
}

/** Capitolo di una guida: titolo h2 con icona; una linea lo separa dal contenuto precedente. */
export function DocsCapitolo({ titolo, icona, coloreIcona = "text-primary", className, children }: DocsCapitoloProps) {
  const idTitolo = useId();

  return (
    <section
      aria-labelledby={idTitolo}
      className={twMerge("border-t border-dashed border-slate-200 pt-8 first:border-t-0 first:pt-0", className)}
    >
      <div className="mb-5 flex items-center gap-3">
        <Lucide icon={icona} aria-hidden="true" className={twMerge("h-5 w-5 flex-none", coloreIcona)} />
        <h2 id={idTitolo} className="title-section">
          {titolo}
        </h2>
      </div>
      {children}
    </section>
  );
}

interface DocsCardProps {
  titolo?: ReactNode;
  icona?: string;
  coloreIcona?: string;
  /** Colore del bordo sinistro in evidenza, per esempio "border-l-success". */
  accento?: string;
  className?: string;
  children?: ReactNode;
}

/** Riquadro dentro un capitolo (card annidata), con titolo h3 facoltativo. */
export function DocsCard({ titolo, icona, coloreIcona = "text-primary", accento, className, children }: DocsCardProps) {
  return (
    <div
      className={twMerge(
        "rounded-card border border-slate-200 bg-white p-4",
        accento && ["border-l-4", accento],
        className
      )}
    >
      {titolo && (
        <h3 className="title-card mb-2 flex items-center gap-2">
          {icona && <Lucide icon={icona} aria-hidden="true" className={twMerge("h-4 w-4 flex-none", coloreIcona)} />}
          {titolo}
        </h3>
      )}
      {children}
    </div>
  );
}

interface DocsCollegamentoProps {
  to: string;
  icona: string;
  coloreIcona?: string;
  titolo: string;
  descrizione: string;
}

/** Collegamento a un'altra pagina (prossimi passi, pagine correlate). */
export function DocsCollegamento({ to, icona, coloreIcona = "text-primary", titolo, descrizione }: DocsCollegamentoProps) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-card border border-slate-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-slate-50"
    >
      <Lucide icon={icona} aria-hidden="true" className={twMerge("h-6 w-6 flex-none", coloreIcona)} />
      <div className="min-w-0">
        <h3 className="title-card group-hover:text-primary">{titolo}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{descrizione}</p>
      </div>
    </Link>
  );
}
