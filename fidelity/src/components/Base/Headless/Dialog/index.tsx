import { Description, DialogPanel, DialogTitle, Dialog as HeadlessDialog, Transition, TransitionChild } from "@headlessui/react";
import { Fragment, createContext, useContext, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

type Size = "sm" | "md" | "lg" | "xl" | "2xl";

const DialogContext = createContext<{
  open: boolean;
  zoom: boolean;
  size: Size;
  centered?: boolean;
}>({
  open: false,
  zoom: false,
  size: "md",
  centered: false,
});

function Dialog({
  children,
  className,
  as = "div",
  open = false,
  onClose,
  staticBackdrop,
  size = "md",
  centered = false,
  ...props
}: ExtractProps<typeof HeadlessDialog> & {
  size?: Size;
  staticBackdrop?: boolean;
  centered?: boolean;
}) {
  const focusElement = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(false);

  return (
    <DialogContext.Provider
      value={{
        open,
        zoom,
        size,
        centered,
      }}
    >
      <Transition appear as={Fragment} show={open}>
        <HeadlessDialog
          as={as}
          onClose={(value) => {
            if (!staticBackdrop) {
              return onClose(value);
            } else {
              setZoom(true);
              setTimeout(() => {
                setZoom(false);
              }, 300);
            }
          }}
          initialFocus={focusElement}
          className={twMerge(["relative z-[60]", className])}
          {...props}
        >
          {children}
        </HeadlessDialog>
      </Transition>
    </DialogContext.Provider>
  );
}

// Refactoring: Dialog.Panel ora è una vera funzione componente React
function DialogPanelComponent({
  children,
  className,
  as = "div",
  ...props
}: ExtractProps<typeof HeadlessDialog.Panel> & {
  size?: Size;
  zoom?: boolean;
  centered?: boolean;
}) {
  const dialog = useContext(DialogContext);
  return (
    <>
      {/* Backdrop con animazione migliorata */}
      <TransitionChild
        as="div"
        enter="ease-out duration-500"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="fixed inset-0 transition-all backdrop-blur-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-theme-1/50 via-theme-2/50 to-black/50 animate-gradient-bg" aria-hidden="true" />
      </TransitionChild>

      {/* Contenitore del dialog con animazione migliorata */}
      <TransitionChild
        as="div"
        enter="ease-out duration-400"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className={twMerge([
          "fixed inset-0 py-16 overflow-y-auto",
          dialog.centered && "flex items-center justify-center",
        ])}
      >
        {/* Pannello dialog con animazione prospettica 3D */}
        <div className="perspective-[1200px] w-full transform-gpu">
          <DialogPanel
            as={as}
            className={twMerge([
              "w-[90%] mx-auto bg-white relative rounded-lg shadow-lg transition-all duration-400",
              "transform-gpu animate-dialog-open dark:bg-darkmode-600",
              dialog.size == "md" && "sm:w-[460px]",
              dialog.size == "sm" && "sm:w-[300px]",
              dialog.size == "lg" && "sm:w-[600px]",
              dialog.size == "xl" && "sm:w-[600px] lg:w-[900px]",
              dialog.size == "2xl" && "sm:w-[700px] lg:w-[1100px] xl:w-[1300px]",
              dialog.zoom && "scale-105 shadow-2xl",
              className,
            ])}
            {...props}
          >
            {children}
          </DialogPanel>
        </div>
      </TransitionChild>
    </>
  );
}

// Assegna la funzione componente a Dialog.Panel
Dialog.Panel = DialogPanelComponent;

Dialog.Title = ({
  children,
  className,
  as = "div",
  ...props
}: ExtractProps<typeof DialogTitle>) => {
  return (
    <DialogTitle
      as={as}
      className={twMerge([
        "flex items-center px-5 py-3 border-b border-slate-200/60 dark:border-darkmode-400",
        "animate-fade-in-right",
        className,
      ])}
      {...props}
    >
      {children}
    </DialogTitle>
  );
};

Dialog.Description = ({
  children,
  className,
  as = "div",
  ...props
}: ExtractProps<typeof Description>) => {
  return (
    <Description
      as={as}
      className={twMerge([
        "p-5 animate-fade-in-up delay-75",
        className,
      ])}
      {...props}
    >
      {children}
    </Description>
  );
};

Dialog.Footer = <C extends React.ElementType = "div">({
  children,
  className,
  as,
  ...props
}: {
  as?: C;
} & React.PropsWithChildren &
  React.ComponentPropsWithoutRef<C>) => {
  const Component = as || "div";

  return (
    <Component
      className={twMerge([
        "px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400",
        "animate-fade-in-up delay-150",
        className,
      ])}
      {...props}
    >
      {children}
    </Component>
  );
};

// Aggiungi questi stili personalizzati al tuo file CSS o al tuo tailwind.config.js
// @keyframes dialogOpen {
//   0% { opacity: 0; transform: rotateX(-10deg) translateY(-20px); }
//   100% { opacity: 1; transform: rotateX(0) translateY(0); }
// }

// @keyframes fadeInRight {
//   0% { opacity: 0; transform: translateX(-10px); }
//   100% { opacity: 1; transform: translateX(0); }
// }

// @keyframes fadeInUp {
//   0% { opacity: 0; transform: translateY(10px); }
//   100% { opacity: 1; transform: translateY(0); }
// }

// @keyframes gradientBg {
//   0% { background-position: 0% 50%; }
//   50% { background-position: 100% 50%; }
//   100% { background-position: 0% 50%; }
// }

export default Dialog;
