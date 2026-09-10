import dayjs from "dayjs";
import * as LitepickerModule from "litepicker";
import { LitepickerElement, LitepickerProps } from "./index";
//HACK to get around litepicker not having a default export
const Litepicker = (LitepickerModule as any).Litepicker;
const getDateFormat = (format: string | undefined) => {
  return format !== undefined ? format : "D MMM, YYYY";
};

const setValue = (props: LitepickerProps) => {
  const format = getDateFormat(props.options.format);
  if (props.value && !props.value.length) {
    let date = dayjs().format(format);
    date +=
      !props.options.singleMode && props.options.singleMode !== undefined
        ? " - " + dayjs().add(1, "month").format(format)
        : "";
    if (props.onChange) {
      props.onChange({
        target: {
          value: date,
        },
      });
    }
  }
};

const init = (el: LitepickerElement, props: LitepickerProps) => {
  const format = getDateFormat(props.options.format);
  el.litePickerInstance = new Litepicker({
    ...props.options,
    element: el,
    format: format,
    lang: props.lang,
    setup: (picker: any) => {
      if (picker.on) {
        picker.on(
          "selected",
          (
            startDate: { dateInstance: Date },
            endDate?: { dateInstance: Date }
          ) => {
            let date = dayjs(startDate.dateInstance).format(format);
            date +=
              endDate !== undefined
                ? " - " + dayjs(endDate.dateInstance).format(format)
                : "";
            if (props.onChange) {
              props.onChange({
                target: {
                  value: date,
                },
              });
            }
          }
        );
      }
    },
  });
};

const reInit = (el: LitepickerElement, props: LitepickerProps) => {
  el.litePickerInstance.destroy();
  init(el, props);
};

export { init, reInit, setValue };
