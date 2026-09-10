import "@/assets/css/vendors/tom-select.css";
import { useEffect, useRef, useMemo } from "react";
import { setValue, init, updateValue } from "./tom-select";
import {
  TomSettings,
  RecursivePartial,
  TomInput,
} from "tom-select/src/types/index.ts";
import TomSelectPlugin from "tom-select";
import clsx from "clsx";

export interface TomSelectElement
  extends HTMLSelectElement,
    Omit<TomInput, keyof HTMLSelectElement | "tomselect"> {
  TomSelect: TomSelectPlugin;
}

export interface TomSelectProps<T extends string | string[]>
  extends React.PropsWithChildren,
    Omit<React.ComponentPropsWithoutRef<"select">, "onChange"> {
  value: T;
  onOptionAdd?: (value: string) => void;
  onChange: (e: {
    target: {
      value: T;
    };
    preventDefault: () => void;
  }) => void;
  options?: RecursivePartial<TomSettings>;
  getRef?: (el: TomSelectElement) => void;
}

function TomSelect<T extends string | string[]>({
  className = "",
  options = {},
  value,
  onOptionAdd = () => {},
  onChange = () => {},
  getRef = () => {},
  children,
  ...computedProps
}: TomSelectProps<T>) {
  const props = {
    className,
    options,
    value,
    onOptionAdd,
    onChange,
    getRef,
  };
  const initialRender = useRef(true);
  const tomSelectRef = useRef<TomSelectElement | null>(null);

  // Compute all default options
  const computedOptions = useMemo(() => {
    let options: TomSelectProps<T>["options"] = {
      ...props.options,
      plugins: {
        dropdown_input: {},
        ...props.options.plugins,
      },
    };

    if (Array.isArray(props.value)) {
      options = {
        persist: false,
        create: true,
        onDelete (values: string[]) {
          props.onChange({
            target: {
              value: values as T,
            },
            preventDefault: () => {},
          });
        },
        ...options,
        plugins: {
          remove_button: {
            title: "Remove this item",
          },
          ...options.plugins,
        },
      };
    }

    return options;
  }, [props.options, props.value, props.onChange]);

  useEffect(() => {
    if (tomSelectRef.current) {
      props.getRef(tomSelectRef.current);

      if (initialRender.current) {
        // Unique attribute
        tomSelectRef.current.setAttribute(
          "data-id",
          `_${  Math.random().toString(36).substring(2, 11)}`
        );

        // Clone the select element to prevent tom select from removing the original element
        const clonedEl = tomSelectRef.current.cloneNode(
          true
        ) as TomSelectElement;

        // Save initial classnames
        const classNames = tomSelectRef.current?.getAttribute("class");
        classNames && clonedEl.setAttribute("data-initial-class", classNames);

        // Hide original element
        tomSelectRef.current?.parentNode &&
          tomSelectRef.current?.parentNode.appendChild(clonedEl);
        tomSelectRef.current.setAttribute("hidden", "true");

        // Initialize tom select
        setValue(clonedEl, props);
        init(tomSelectRef.current, clonedEl, props, computedOptions);

        initialRender.current = false;
      } else {
        const clonedEl = document.querySelectorAll(
          `[data-id='${tomSelectRef.current.getAttribute(
            "data-id"
          )}'][data-initial-class]`
        )[0] as TomSelectElement;
        const value = props.value;
        updateValue(
          tomSelectRef.current,
          clonedEl,
          value,
          props,
          computedOptions
        );
      }
    }
    return () => {
      if (tomSelectRef.current && tomSelectRef.current.TomSelect) {
        tomSelectRef.current.TomSelect.destroy();
      }
    };
  }, [props.value, props.className, props.options, computedOptions, props.getRef]);

  return (
    <select
      {...computedProps}
      ref={tomSelectRef}
      value={props.value}
      onChange={(e) => {
        if (props.onChange) {
          props.onChange({
            target: {
              value: e.target.value as T,
            },
            preventDefault: () => {
              e.preventDefault();
            },
          });
        }
      }}
      className={clsx(["tom-select", props.className])}
    >
      {children}
    </select>
  );
}

export default TomSelect;