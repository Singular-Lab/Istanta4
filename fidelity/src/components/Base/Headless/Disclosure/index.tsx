import {
  DisclosureButton,
  DisclosurePanel,
  Disclosure as HeadlessDisclosure,
  Transition,
} from "@headlessui/react";
import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { twMerge } from "tailwind-merge";

type Variant = "default" | "boxed";

const disclosureContext = createContext<{
  open: boolean;
  close: () => void;
  key: number;
}>({
  open: false,
  close: () => { },
  key: 0,
});

const groupContext = createContext<{
  selectedIndex: null | number;
  setSelectedIndex: (index: number) => void;
  variant: Variant;
}>({
  selectedIndex: null,
  setSelectedIndex: () => { },
  variant: "default",
});

function Disclosure({
  children,
  className,
  key = 0,
  ...props
}: ExtractProps<typeof HeadlessDisclosure> & {
  key?: number;
}) {
  const group = useContext(groupContext);

  return (
    <HeadlessDisclosure
      as="div"
      defaultOpen={group.selectedIndex === key}
      className={twMerge([
        "py-4 first:-mt-4 last:-mb-4",
        "[&:not(:last-child)]:border-b [&:not(:last-child)]:border-slate-200/100 [&:not(:last-child)]:dark:border-darkmode-400",
        group.variant == "boxed" &&
        "p-4 first:mt-0 last:mb-0 border border-slate-200/100 mt-3 dark:border-darkmode-400",
        className,
      ])}
      {...props}
    >
      {({ open, close }) => (
        <disclosureContext.Provider
          value={{
            open,
            close,
            key,
          }}
        >
          <>
            {typeof children === "function"
              ? children({
                open,
                close,
              })
              : children}
          </>
        </disclosureContext.Provider>
      )}
    </HeadlessDisclosure>
  );
}

// Refactoring Disclosure.Group come componente React con nome maiuscolo
type DisclosureGroupProps<C extends React.ElementType = "div"> = {
  as?: C;
  selectedIndex?: number;
  variant?: Variant;
} & React.PropsWithChildren &
  React.ComponentPropsWithoutRef<C>;

function DisclosureGroup<C extends React.ElementType = "div">({
  children,
  className,
  as,
  selectedIndex = 0,
  variant = "default",
  ...props
}: DisclosureGroupProps<C>) {
  const [active, setActive] = useState(selectedIndex);
  const Component = as || "div";

  return (
    <groupContext.Provider
      value={{
        selectedIndex: active,
        setSelectedIndex: setActive,
        variant,
      }}
    >
      <Component className={className} {...props}>
        {Array.isArray(children)
          ? children.map((item, key) => {
            return {
              ...item,
              props: {
                ...item.props,
                key,
              },
            };
          })
          : children}
      </Component>
    </groupContext.Provider>
  );
}
Disclosure.Group = DisclosureGroup;

// Refactoring Disclosure.Button come componente React con nome maiuscolo
type DisclosureButtonProps = ExtractProps<typeof DisclosureButton> & { actions?: React.ReactNode };

function DisclosureButtonComponent({
  children,
  actions,
  className,
  ...props
}: DisclosureButtonProps) {
  const { key: disclosureKey, close, open } = useContext(disclosureContext);
  const group = useContext(groupContext);

  useEffect(() => {
    if (group.selectedIndex !== disclosureKey) {
      close();
    }
  }, [group.selectedIndex, disclosureKey, close]);

  return (
    <DisclosureButton
      as="button"
      className={twMerge([
        "outline-none py-4 -my-4 font-medium w-full dark:text-slate-400",
        open && "text-primary dark:text-slate-300",
        className,
      ])}
      onClick={() => {
        group.setSelectedIndex(disclosureKey);
      }}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div>
          {typeof children === "function"
            ? children({
              open,
              hover: false,
              active: false,
              disabled: false,
              focus: false,
              autofocus: false,
            })
            : children}
        </div>
        {actions && (
          <div className="ml-2 flex items-center space-x-2">
            {actions}
          </div>
        )}
      </div>
    </DisclosureButton>
  );
}
Disclosure.Button = DisclosureButtonComponent;

Disclosure.Panel = ({
  children,
  className,
  ...props
}: ExtractProps<typeof DisclosurePanel>) => {
  return (
    <Transition
      as={Fragment}
      enter="overflow-hidden transition-all linear duration-[400ms]"
      enterFrom="mt-0 max-h-0 invisible opacity-0"
      enterTo="mt-3 max-h-[2000px] visible opacity-100"
      leave="overflow-hidden transition-all linear duration-500"
      leaveFrom="mt-3 max-h-[2000px] visible opacity-100"
      leaveTo="mt-0 max-h-0 invisible opacity-0"
    >
      <DisclosurePanel
        as="div"
        className={twMerge([
          "mt-3 text-slate-700 leading-relaxed dark:text-slate-400",
          className,
        ])}
        {...props}
      >
        {children}
      </DisclosurePanel>
    </Transition>
  );
};

export default Disclosure;
