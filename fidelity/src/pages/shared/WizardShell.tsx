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
  children: React.ReactNode;
}

const variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { opacity: { duration: 0.3, ease: 'easeInOut' } } },
  exit: { opacity: 0 },
};
const transition = { duration: 0.15, ease: 'easeInOut' };

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
    <>
      {/* Step indicator */}
      <div className="flex flex-col lg:items-center lg:flex-row gap-y-2 mb-5">
        {steps.map((step, index) => (
          <div
            key={index}
            className={clsx([
              'flex items-center lg:justify-center flex-1 lg:first:justify-start lg:last:justify-end group',
              currentStep === index && 'active',
              'after:hidden before:hidden after:lg:block before:lg:block',
              "first:after:content-[''] first:after:w-full first:after:bg-slate-300/60 first:after:h-[2px] first:after:ml-5 group-[.mode--light]:first:after:bg-slate-300/20",
              "last:before:content-[''] last:before:w-full last:before:bg-slate-300/60 last:before:h-[2px] last:before:mr-5 group-[.mode--light]:last:before:bg-slate-300/20",
              "last:after:hidden after:content-[''] after:w-full after:bg-slate-300/60 after:h-[2px] after:ml-5 group-[.mode--light]:after:bg-slate-300/20",
              "first:before:hidden before:content-[''] before:w-full before:bg-slate-300/60 before:h-[2px] before:mr-5 group-[.mode--light]:before:bg-slate-300/20",
            ])}
          >
            <div className="flex items-center">
              <div className="bg-white border rounded-full group-[.mode--light]:!bg-transparent group-[.active]:bg-primary group-[.active]:text-white group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-white/[0.25] [.group.mode--light_.group.active_&]:!bg-white/[0.12] [.group.mode--light_.group.active_&]:!border-white/[0.15]">
                <div className="flex items-center justify-center w-10 h-10">{index + 1}</div>
              </div>
              <div className="ml-3.5 group-[.mode--light]:!text-slate-300 font-medium whitespace-nowrap text-slate-500 group-[.active]:text-current [.group.mode--light_.group.active_&]:!text-slate-100">
                {step.title}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow">
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
            <hr className="w-full border-slate-300 mt-6" />
            <div className="flex flex-col md:flex-row justify-between mb-2 mt-4 gap-2">
              {currentStep > 0 && (
                <Button type="button" size="sm" variant="outline-secondary" onClick={onPrevious}>
                  <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
                  Precedente
                </Button>
              )}
              {!isLastStep && (
                <Button
                  type="button"
                  size="sm"
                  variant="soft-primary"
                  onClick={onNext}
                  className="md:ml-auto"
                  disabled={nextDisabled}
                >
                  Successivo
                  <Lucide icon="ArrowRight" className="w-4 h-4 ml-2" />
                </Button>
              )}
              {isLastStep && (
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  className="md:ml-auto"
                  disabled={isSubmitting || submitDisabled}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Lucide icon="Loader" className="w-4 h-4 animate-spin" />
                      Operazione in corso...
                    </span>
                  ) : (
                    submitLabel
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
