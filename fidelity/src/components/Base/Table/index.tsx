import { twMerge } from "tailwind-merge";
import { createContext, useContext } from "react";

interface TableProps
  extends React.PropsWithChildren,
    React.ComponentPropsWithoutRef<"table"> {
  dark?: boolean;
  bordered?: boolean;
  hover?: boolean;
  striped?: boolean;
  sm?: boolean;
}

const tableContext = createContext<{
  dark: TableProps["dark"];
  bordered: TableProps["bordered"];
  hover: TableProps["hover"];
  striped: TableProps["striped"];
  sm: TableProps["sm"];
}>({
  dark: false,
  bordered: false,
  hover: false,
  striped: false,
  sm: false,
});

function Table({
  className,
  dark,
  bordered,
  hover,
  striped,
  sm,
  ...props
}: TableProps) {
  return (
    <tableContext.Provider
      value={{
        dark,
        bordered,
        hover,
        striped,
        sm,
      }}
    >
      <table
        className={twMerge([
          "w-full text-left",
          dark && "bg-dark text-white dark:bg-black/30",
          className,
        ])}
        {...props}
      >
        {props.children}
      </table>
    </tableContext.Provider>
  );
}

interface TheadProps
  extends React.PropsWithChildren,
    React.ComponentPropsWithoutRef<"thead"> {
  variant?: "default" | "light" | "dark";
}

const theadContext = createContext<{
  variant: TheadProps["variant"];
}>({
  variant: "default",
});

const TableThead: React.FC<TheadProps> = ({ className, ...props }) => {
  return (
    <theadContext.Provider
      value={{
        variant: props.variant,
      }}
    >
      <thead
        className={twMerge([
          props.variant === "light" && "bg-slate-200/60 dark:bg-slate-200",
          props.variant === "dark" && "bg-dark text-white dark:bg-black/30",
          className,
        ])}
        {...props}
      >
        {props.children}
      </thead>
    </theadContext.Provider>
  );
};
Table.Thead = TableThead;

type TbodyProps = React.PropsWithChildren<
  React.ComponentPropsWithoutRef<"tbody">
>;

const TableTbody: React.FC<TbodyProps> = ({ className, ...props }) => {
  return <tbody className={className}>{props.children}</tbody>;
};
Table.Tbody = TableTbody;

type TrProps = React.PropsWithChildren & React.ComponentPropsWithoutRef<"tr">;

const TableTr: React.FC<TrProps> = ({ className, ...props }) => {
  const table = useContext(tableContext);
  return (
    <tr
      className={twMerge([
        table.hover &&
          "[&:hover_td]:bg-slate-100 [&:hover_td]:dark:bg-darkmode-300 [&:hover_td]:dark:bg-opacity-50",
        table.striped &&
          "[&:nth-of-type(odd)_td]:bg-slate-100 [&:nth-of-type(odd)_td]:dark:bg-darkmode-300 [&:nth-of-type(odd)_td]:dark:bg-opacity-50",
        className,
      ])}
      {...props}
    >
      {props.children}
    </tr>
  );
};
Table.Tr = TableTr;

type ThProps = React.PropsWithChildren & React.ComponentPropsWithoutRef<"th">;

const TableTh: React.FC<ThProps> = ({ className, ...props }) => {
  const table = useContext(tableContext);
  const thead = useContext(theadContext);
  return (
    <th
      className={twMerge([
        "font-medium px-5 py-3 border-b-2 dark:border-darkmode-300",
        thead.variant === "light" && "border-b-0 text-slate-700",
        thead.variant === "dark" && "border-b-0",
        table.dark && "border-slate-600 dark:border-darkmode-300",
        table.bordered && "border-l border-r border-t",
        table.sm && "px-4 py-2",
        className,
      ])}
      {...props}
    >
      {props.children}
    </th>
  );
};
Table.Th = TableTh;

type TdProps = React.PropsWithChildren & React.ComponentPropsWithoutRef<"td">;

const TableTd: React.FC<TdProps> = ({ className, ...props }) => {
  const table = useContext(tableContext);
  return (
    <td
      className={twMerge([
        "px-5 py-3 border-b dark:border-darkmode-300",
        table.dark && "border-slate-600 dark:border-darkmode-300",
        table.bordered && "border-l border-r border-t",
        table.sm && "px-4 py-2",
        className,
      ])}
      {...props}
    >
      {props.children}
    </td>
  );
};
Table.Td = TableTd;

export default Table;
