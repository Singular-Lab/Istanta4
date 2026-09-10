import { useContext } from "react";
import { formInlineContext } from "../FormInline";
import { twMerge } from "tailwind-merge";

type FormLabelProps = React.PropsWithChildren &
  React.ComponentPropsWithoutRef<"label"> & {
    
  };

function FormLabel({ formLabelSize, ...props }: FormLabelProps & { formLabelSize?: "sm" | "lg"; }) {
  const formInline = useContext(formInlineContext);
  const sizeClass = formLabelSize === "sm" ? "text-sm" : formLabelSize === "lg" ? "text-lg" : "";

  return (
    <label
      {...props}
      className={twMerge([
        "inline-block mb-2",
        formInline && "mb-2 sm:mb-0 sm:mr-5 sm:text-right",
        sizeClass,
        props.className,
      ])}
    >
      {props.children}
    </label>
  );
}

export default FormLabel;
