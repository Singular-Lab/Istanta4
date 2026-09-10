import { twMerge } from "tailwind-merge";
import { Menu as HeadlessMenu, MenuButton, MenuItem, MenuItems,Transition } from '@headlessui/react'
import React, { Fragment } from "react";
import clsx from "clsx";
import Lucide from "../../Lucide";

function Menu({
  children,
  className,
  disabled,
  ...props
}: ExtractProps<typeof HeadlessMenu> & { disabled?: boolean }) {
  return (
    <HeadlessMenu
      as="div"
      className={twMerge([
        "relative",
        disabled ? "opacity-50 pointer-events-none" : "",
        className,
      ])}
      {...props}
    >
      {children}
    </HeadlessMenu>
  );
}

Menu.Button = <C extends React.ElementType = "div">({
  as,
  children,
  className,
  disabled,
  ...props
}: ExtractProps<typeof MenuButton> & {
  as?: C;
  disabled?: boolean;
} & React.ComponentPropsWithRef<C>) => {
  return (
    <MenuButton
      as={as}
      className={twMerge([
        "cursor-pointer",
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
        className,
      ])}
      disabled={disabled}
      {...props}
    >
      {children}
    </MenuButton>
  );
};

Menu.Items = ({
  children,
  className,
  placement = "bottom-end",
  disabled,
  ...props
}: ExtractProps<typeof MenuItems> & {
  placement?:
    | "top-start"
    | "top"
    | "top-end"
    | "right-start"
    | "right"
    | "right-end"
    | "bottom-end"
    | "bottom"
    | "bottom-start"
    | "left-start"
    | "left"
    | "left-end";
  disabled?: boolean;
}) => {
  return (
    <Transition
      as={Fragment}
      enter="transition-all ease-linear duration-150"
      enterFrom="mt-5 invisible opacity-0 translate-y-1"
      enterTo="mt-1 visible opacity-100 translate-y-0"
      leave="transition-all ease-linear duration-150"
      leaveFrom="mt-1 visible opacity-100 translate-y-0"
      leaveTo="mt-5 invisible opacity-0 translate-y-1"
    >
      <div
        className={clsx([
          "absolute z-30",
          placement == "top-start" && "left-0 bottom-[100%]",
          placement == "top" && "left-[50%] translate-x-[-50%] bottom-[100%]",
          placement == "top-end" && "right-0 bottom-[100%]",
          placement == "right-start" && "left-[100%] translate-y-[-50%]",
          placement == "right" && "left-[100%] top-[50%] translate-y-[-50%]",
          placement == "right-end" && "left-[100%] bottom-0",
          placement == "bottom-end" && "top-[100%] right-0",
          placement == "bottom" && "top-[100%] left-[50%] translate-x-[-50%]",
          placement == "bottom-start" && "top-[100%] left-0",
          placement == "left-start" && "right-[100%] translate-y-[-50%]",
          placement == "left" && "right-[100%] top-[50%] translate-y-[-50%]",
          placement == "left-end" && "right-[100%] bottom-0",
          disabled ? "opacity-50 pointer-events-none" : "",
        ])}
      >
        <MenuItems
          as="div"
          className={twMerge([
            "p-2 shadow-[0px_3px_10px_#00000017] bg-white border border-slate-200 rounded-lg dark:bg-darkmode-600",
            className,
          ])}
          {...props}
        >
          {children}
        </MenuItems>
      </div>
    </Transition>
  );
};

Menu.Item = ({
  children,
  className,
  disabled,
  warning,
  ...props
}: ExtractProps<typeof MenuItem> & { disabled?: boolean; warning?: boolean }) => {
  return (
    <MenuItem
      as="a"
      className={twMerge([
        "flex items-center p-2 transition duration-300 ease-in-out rounded-lg",
        disabled
          ? "cursor-not-allowed opacity-50 pointer-events-none bg-slate-200 m-1"
          : "cursor-pointer hover:bg-slate-100 dark:bg-darkmode-600 dark:hover:bg-darkmode-400",
        warning 
          ? "bg-amber-100"
          : "",
        className,
      ])}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!disabled) {
          props.onClick?.(e);
        }
      }}
      {...props}
    >
      {(renderProps) => (
        <>
          {warning && <Lucide icon="TriangleAlert" className="mr-2" />}
          {typeof children === 'function' ? children(renderProps) : children}
        </>
      )}
    </MenuItem>
  );
};

Menu.Divider = ({
  disabled,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { disabled?: boolean }) => {
  return (
    <div
      className={twMerge([
        "h-px my-2 -mx-2 bg-slate-200/60 dark:bg-darkmode-400",
        disabled ? "opacity-50 pointer-events-none" : "",
        props.className,
      ])}
    ></div>
  );
};

Menu.Header = (
  props: React.PropsWithChildren &
    React.ComponentPropsWithoutRef<"div"> & { disabled?: boolean }
) => {
  return (
    <div
      className={twMerge([
        "p-2 font-medium",
        props.disabled ? "opacity-50 pointer-events-none" : "",
        props.className,
      ])}
    >
      {props.children}
    </div>
  );
};

Menu.Footer = (
  props: React.PropsWithChildren &
    React.ComponentPropsWithoutRef<"div"> & { disabled?: boolean }
) => {
  return (
    <div
      className={twMerge([
        "flex p-1",
        props.disabled ? "opacity-50 pointer-events-none" : "",
        props.className,
      ])}
    >
      {props.children}
    </div>
  );
};

export default Menu;
