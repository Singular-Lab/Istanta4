import React, { createContext, useContext } from "react";
import { twMerge } from "tailwind-merge";
import { ButtonProps } from "../../Button";

type InputGroupProps = React.PropsWithChildren &
  React.ComponentPropsWithoutRef<"div"> & {
    size?: "sm" | "md" | "lg";
  };

type TextProps = React.PropsWithChildren &
  React.ComponentPropsWithoutRef<"div">;

type ButtonPropsInput = React.PropsWithChildren &
  React.ComponentPropsWithoutRef<"button">;

export const InputGroupContext = createContext(false);

const InputGroupText: React.FC<TextProps> = (props) => {
  const inputGroup = useContext(InputGroupContext);
  return (
    <div
      {...props}
      className={twMerge([
        "py-2 px-3 bg-slate-100 border shadow-sm border-slate-300/60 text-slate-600 dark:bg-darkmode-900/20 dark:border-darkmode-900/20 dark:text-slate-400",
        inputGroup &&
          "rounded-none [&:not(:first-child)]:border-l-transparent first:rounded-l last:rounded-r",
        props.className,
      ])}
    >
      {props.children}
    </div>
  );
};

const InputGroupButton: React.FC<ButtonPropsInput> = (props) => {
  const inputGroup = useContext(InputGroupContext);
  return (
    <button
      {...props}
      className={twMerge([
        "py-2 px-3 bg-slate-100 border shadow-sm border-slate-300/60 text-slate-600 dark:bg-darkmode-900/20 dark:border-darkmode-900/20 dark:text-slate-400",
        inputGroup &&
          "rounded-none [&:not(:first-child)]:border-l-transparent first:rounded-l last:rounded-r",
        props.className,
      ])}
    >
      {props.children}
    </button>
  );
};

const InputGroup: React.FC<InputGroupProps> & {
  Text: React.FC<TextProps>;
  Button: React.FC<ButtonPropsInput>;
} = (props) => {
  return (
    <InputGroupContext.Provider value={true}>
      <div {...props} className={twMerge(["flex", props.className])}>
        {props.children}
      </div>
    </InputGroupContext.Provider>
  );
};

InputGroup.Text = InputGroupText;
InputGroup.Button = InputGroupButton;

export default InputGroup;
