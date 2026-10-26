import { twMerge } from "tailwind-merge";
import {
  Dialog as HeadlessDialog,
  DialogPanel,
  TransitionChild,
  DialogTitle,
  Description,
  Transition,
} from "@headlessui/react";
import { Fragment, createContext, useContext, useRef, useState } from "react";

type Size = "sm" | "md" | "lg" | "xl";

const SlideoverContext = createContext<{
  open: boolean;
  zoom: boolean;
  size: Size;
}>({
  open: false,
  zoom: false,
  size: "md",
});

function Slideover({
  children,
  className,
  as = "div",
  open = false,
  onClose,
  staticBackdrop,
  size = "md",
  ...props
}: ExtractProps<typeof HeadlessDialog> & {
  size?: Size;
  staticBackdrop?: boolean;
}) {
  const focusElement = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(false);

  return (
    <SlideoverContext.Provider
      value={{
        open,
        zoom,
        size,
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
    </SlideoverContext.Provider>
  );
}

// Refactoring Slideover.Panel come componente React con nome maiuscolo
function SlideoverPanel({
  children,
  className,
  as = "div",
  ...props
}: ExtractProps<typeof DialogPanel> & {
  size?: Size;
}) {
  const slideover = useContext(SlideoverContext);
  return (
    <>
      <TransitionChild
        as="div"
        enter="ease-in-out duration-500"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in-out duration-[400ms]"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="fixed inset-0 bg-gradient-to-b from-theme-1/50 via-theme-2/50 to-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />
      <TransitionChild
        as="div"
        enter="ease-in-out duration-500"
        enterFrom="opacity-0 -mr-[100%]"
        enterTo="opacity-100 mr-0"
        leave="ease-in-out duration-[400ms]"
        leaveFrom="opacity-100 mr-0"
        leaveTo="opacity-0 -mr-[100%]"
        className="fixed inset-y-0 right-0"
      >
        <DialogPanel
          as={as}
          className={twMerge([
            "w-[90%] ml-auto h-screen flex flex-col bg-white relative shadow-md transition-transform dark:bg-darkmode-600",
            slideover.size == "md" && "sm:w-[460px]",
            slideover.size == "sm" && "sm:w-[300px]",
            slideover.size == "lg" && "sm:w-[600px]",
            slideover.size == "xl" && "sm:w-[600px] lg:w-[900px]",
            slideover.zoom && "scale-105",
            className,
          ])}
          {...props}
        >
          {children}
        </DialogPanel>
      </TransitionChild>
    </>
  );
}
Slideover.Panel = SlideoverPanel;

// Refactoring Slideover.Title come componente React con nome maiuscolo
function SlideoverTitle({
  children,
  className,
  as = "div",
  ...props
}: ExtractProps<typeof DialogTitle>) {
  return (
    <DialogTitle
      as={as}
      className={twMerge([
        "flex items-center px-5 py-3 border-b border-slate-200/60 dark:border-darkmode-400",
        className,
      ])}
      {...props}
    >
      {children}
    </DialogTitle>
  );
}
Slideover.Title = SlideoverTitle;

// Refactoring Slideover.Description come componente React con nome maiuscolo
function SlideoverDescription({
  children,
  className,
  as = "div",
  ...props
}: ExtractProps<typeof Description>) {
  return (
    <Description
      as={as}
      className={twMerge(["p-5 overflow-y-auto flex-1", className])}
      {...props}
    >
      {children}
    </Description>
  );
}
Slideover.Description = SlideoverDescription;

// Refactoring Slideover.Footer come componente React con nome maiuscolo
function SlideoverFooter<C extends React.ElementType = "div">({
  children,
  className,
  as,
  ...props
}: {
  as?: C;
} & React.PropsWithChildren &
  React.ComponentPropsWithoutRef<C>) {
  const Component = as || "div";

  return (
    <Component
      className={twMerge([
        "px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400",
        className,
      ])}
      {...props}
    >
      {children}
    </Component>
  );
}
Slideover.Footer = SlideoverFooter;

export default Slideover;
