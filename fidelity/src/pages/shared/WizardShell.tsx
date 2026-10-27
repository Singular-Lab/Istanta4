import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

export interface WizardStep {
  title: string;
}

interface WizardShellProps {
  steps: WizardStep[];
  currentStep: number;
  onNext: (e: React.MouseEvent) => void;
  onPrevious: (e: React.MouseEvent) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  nextDisabled?: boolean;
  submitDisabled?: boolean;
  /** Contenuto del passo corrente: una o più Sezione, la cornice non aggiunge un box. */
  children: React.ReactNode;
}

const variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { opacity: { duration: 0.3, ease: 'easeInOut' } } },
  exit: { opacity: 0 },
};
const transition = { duration: 0.15, ease: 'easeInOut' };

/**
 * Procedura a passi: indicatore dei passi in una card, contenuto del passo (le sue Sezioni)
 * e comandi Precedente / Successivo / conferma in fondo a destra.
 */
export default function WizardShell({
  steps,
  currentStep,
  onNext,
  onPrevious,
  isSubmitting = false,
  submitLabel = 'Crea',
  nextDisabled = false,
  submitDisabled = false,
  children,
}: WizardShellProps) {
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <nav aria-label="Passi della procedura" className="box box--stacked p-5">
        <ol className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-0">
          {steps.map((step, index) => {
            const attivo = currentStep === index;
            const completato = index < currentStep;
            return (
              <li key={index} className="flex flex-1 items-center gap-3 lg:last:flex-none">
                <span
                  aria-current={attivo ? 'step' : undefined}
                  className="flex items-center gap-3"
                >
                  <span
                    className={clsx(
                      'flex h-9 w-9 flex-none items-center justify-center rounded-full border text-sm font-medium tabular-nums',
                      attivo && 'border-primary bg-primary text-white',
                      completato && 'border-primary/30 bg-primary/10 text-primary',
                      !attivo && !completato && 'border-slate-300 bg-white text-slate-500'
                    )}
                  >
                    {completato ? <Lucide icon="Check" aria-hidden="true" className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={clsx('whitespace-nowrap font-medium', attivo ? 'text-slate-800' : 'text-slate-500')}>
                    {step.title}
                  </span>
                </span>
                {index < steps.length - 1 && (
                  <span aria-hidden="true" className="mx-4 hidden h-px flex-1 bg-slate-300/60 lg:block" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          layout
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Comandi */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {currentStep > 0 && (
          <Button type="button" variant="outline-secondary" onClick={onPrevious} className="sm:mr-auto">
            <Lucide icon="ArrowLeft" aria-hidden="true" className="mr-2 h-4 w-4" />
            Precedente
          </Button>
        )}
        {!isLastStep && (
          <Button type="button" variant="primary" onClick={onNext} disabled={nextDisabled}>
            Successivo
            <Lucide icon="ArrowRight" aria-hidden="true" className="ml-2 h-4 w-4" />
          </Button>
        )}
        {isLastStep && (
          <Button variant="primary" type="submit" disabled={submitDisabled} loading={isSubmitting}>
            {isSubmitting ? 'Operazione in corso…' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
