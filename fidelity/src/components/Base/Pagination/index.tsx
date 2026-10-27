import { twMerge } from "tailwind-merge";
import Button from "../Button";

type PaginationProps = React.PropsWithChildren &
  React.ComponentPropsWithoutRef<"nav">;

function Pagination({ className, children, ...rest }: PaginationProps) {
  return (
    <nav {...rest} className={className}>
      <ul className="flex w-full mr-0 sm:w-auto sm:mr-auto">{children}</ul>
    </nav>
  );
}

interface LinkProps
  extends React.PropsWithChildren,
    React.ComponentPropsWithoutRef<"a"> {
  active?: boolean;
}

// Le altre prop (aria-label, aria-current, title...) arrivano all'elemento: servono ai pulsanti con sola icona
Pagination.Link = ({ className, active, children, ...rest }: LinkProps) => {
  return (
    <li className="flex-1 sm:flex-initial">
      <Button
        aria-current={active ? "page" : undefined}
        {...rest}
        as="a"
        className={twMerge([
          "min-w-0 sm:min-w-[40px] font-normal flex items-center justify-center text-slate-800 sm:mr-2 dark:text-slate-300 px-1 sm:px-3",
          active &&
            "rounded-control bg-white font-medium dark:bg-darkmode-400",
          !active && "shadow-none border-transparent",
          className,
        ])}
      >
        {children}
      </Button>
    </li>
  );
};

export default Pagination;
