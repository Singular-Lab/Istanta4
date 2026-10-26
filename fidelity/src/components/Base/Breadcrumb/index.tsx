import clsx from "clsx";
import { Link } from "react-router-dom";
import { createContext, useContext } from "react";
import React from "react";

interface BreadcrumbProps
  extends React.PropsWithChildren,
    React.ComponentPropsWithoutRef<"nav"> {
  light?: boolean;
  small?: boolean;
  children: React.ReactElement | React.ReactElement[];
}

const breadcrumbContext = createContext<{
  light?: boolean;
  small?: boolean;
}>({
  light: undefined,
  small: undefined,
});

function Breadcrumb({ className, light, small, children }: BreadcrumbProps) {
  return (
    <breadcrumbContext.Provider
      value={{
        light,
        small,
      }}
    >
      <nav className={clsx(["flex", className])} aria-label="breadcrumb">
        <ol
          className={clsx([
            "flex items-center text-theme-1 dark:text-slate-300",
            { "text-white/90": light },
            { "text-xs": small },
          ])}
        >
          {Array.isArray(children)
            ? children.map((item, key) => {
                return React.cloneElement(item, { key });
              })
            : children}
        </ol>
      </nav>
    </breadcrumbContext.Provider>
  );
}

interface LinkProps
  extends React.PropsWithChildren,
    React.ComponentPropsWithoutRef<"li"> {
  to?: string;
  active?: boolean;
  breadcrumbKey?: number | string; // Cambia 'key' in 'breadcrumbKey'
}

// Sposta LinkBreadcrumb fuori per rispettare la regola degli hook
function LinkBreadcrumb({
  className,
  to = "",
  active = false,
  children,
  breadcrumbKey = 0,
  ...attr
}: LinkProps) {
  const breadcrumb = useContext(breadcrumbContext);
  return (
    <li
      className={clsx([
        className,
        breadcrumbKey as number > 0 && "relative ml-5 pl-0.5",
        !breadcrumb.light &&
          breadcrumbKey as number > 0 &&
          "before:content-[''] before:w-[14px] before:h-[14px] before:bg-chevron-black before:transform before:rotate-[-90deg] before:bg-[length:100%] before:-ml-[1.125rem] before:absolute before:my-auto before:inset-y-0",
        breadcrumb.light &&
          breadcrumbKey as number > 0 &&
          "before:content-[''] before:w-[14px] before:h-[14px] before:bg-chevron-white before:transform before:rotate-[-90deg] before:bg-[length:100%] before:-ml-[1.125rem] before:absolute before:my-auto before:inset-y-0",
        breadcrumbKey as number > 0 && "dark:before:bg-chevron-black",
        !breadcrumb.light &&
          active &&
          "text-slate-600 cursor-text dark:text-slate-400",
        breadcrumb.light && active && "text-white/70",
        breadcrumb.small && "text-xs",
      ])}
      {...attr}
    >
      <Link to={to}>{children}</Link>
    </li>
  );
}

Breadcrumb.Link = LinkBreadcrumb;

export default Breadcrumb;