import { extendTailwindMerge } from "tailwind-merge";

// twMerge che conosce i token del tema (tailwind.config.js): senza, `rounded-control`
// e `rounded-full` restano entrambi nella classe e vince l'ordine del CSS, non l'override
export const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      borderRadius: ["card", "control"],
    },
    classGroups: {
      shadow: [{ shadow: ["card", "overlay"] }],
    },
  },
});
