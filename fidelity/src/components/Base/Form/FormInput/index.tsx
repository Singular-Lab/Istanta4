import { useContext, forwardRef } from "react";
import { formInlineContext } from "../FormInline";
import { InputGroupContext } from "../InputGroup";
import { twMerge } from "tailwind-merge";

interface FormInputProps extends React.ComponentPropsWithoutRef<"input"> {
  formInputSize?: "sm" | "lg";
  rounded?: boolean;
}

type FormInputRef = React.ComponentPropsWithRef<"input">["ref"];

const FormInput = forwardRef((props: FormInputProps, ref: FormInputRef) => {
  const formInline = useContext(formInlineContext);
  const inputGroup = useContext(InputGroupContext);
  const { formInputSize, rounded, type, ...computedProps } = props;

  // Personalizzazione per l'input file e color
  const isFileInput = type === "file";
  const isColorInput = type === "color";
  return (
    <input
      {...computedProps}
      ref={ref}
      type={type}
      className={twMerge([
        "transition duration-200 ease-in-out w-full text-sm shadow-sm placeholder:text-slate-400/90",
        "focus:ring-4 focus:ring-primary focus:ring-opacity-20 focus:border-primary focus:border-opacity-40",
        "dark:bg-darkmode-800 dark:focus:ring-slate-700 dark:focus:ring-opacity-50 dark:placeholder:text-slate-500/80",
        isFileInput
          ? [
              "border-l-transparent border px-0 file:mr-4 file:py-2 file:px-4 file:rounded-s-md rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer file:hover:bg-opacity-90",
              formInputSize == "sm" && "file:py-1.5 file:px-2 text-xs",
            ]
          : isColorInput
          ? [
              "border-slate-300/60 rounded-md p-1 cursor-pointer",
              "disabled:bg-slate-100 disabled:cursor-not-allowed dark:disabled:bg-darkmode-800/50 dark:disabled:border-transparent",
              "[&[readonly]]:bg-slate-100 [&[readonly]]:cursor-not-allowed [&[readonly]]:dark:bg-darkmode-800/50 [&[readonly]]:dark:border-transparent",
              formInputSize == "sm" && "text-xs py-1.5 px-2",
              formInputSize == "lg" && "text-lg py-1.5 px-4",
              rounded && "rounded-full",
              formInline && "flex-1",
            ]
          : [
              "border-slate-300/60 rounded-md",
              "disabled:bg-slate-100 disabled:cursor-not-allowed dark:disabled:bg-darkmode-800/50 dark:disabled:border-transparent",
              "[&[readonly]]:bg-slate-100 [&[readonly]]:cursor-not-allowed [&[readonly]]:dark:bg-darkmode-800/50 [&[readonly]]:dark:border-transparent",
              formInputSize == "sm" && "text-xs py-1.5 px-2",
              formInputSize == "lg" && "text-lg py-1.5 px-4",
              rounded && "rounded-full",
              formInline && "flex-1",
              inputGroup &&
                "rounded-none [&:not(:first-child)]:border-l-transparent first:rounded-l last:rounded-r z-10",
            ],
        props.className,
      ])}
    />
  );
});

export default FormInput;
