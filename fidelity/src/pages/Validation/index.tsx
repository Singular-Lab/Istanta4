import clsx from "clsx";
import _ from "lodash";
import {
  FormSwitch,
  FormLabel,
  FormInput,
  FormTextarea,
} from "@/components/Base/Form";
import Button from "@/components/Base/Button";
import Notification from "@/components/Base/Notification";
import Lucide from "@/components/Base/Lucide";
import { useForm } from "react-hook-form";
import Toastify from "toastify-js";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import React from "react";

function Main() {
  const schema = yup
    .object({
      name: yup.string().required().min(2),
      email: yup.string().required().email(),
      password: yup.string().required().min(6),
      age: yup
        .number()
        .required()
        .test("len", "age must be less than or equal to 3", (val) =>
          val && val.toString().length <= 3 ? true : false
        ),
      url: yup.string().url(),
      comment: yup.string().required().min(10),
    })
    .required();

  const {
    register,
    trigger,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    resolver: yupResolver(schema),
  });
  const onSubmit = async (event: React.ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await trigger();
    if (!result) {
      const failedEl = document
        .querySelectorAll("#failed-notification-content")[0]
        .cloneNode(true) as HTMLElement;
      failedEl.classList.remove("hidden");
      Toastify({
        node: failedEl,
        duration: 3000,
        newWindow: true,
        close: true,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
      }).showToast();
    } else {
      const successEl = document
        .querySelectorAll("#success-notification-content")[0]
        .cloneNode(true) as HTMLElement;
      successEl.classList.remove("hidden");
      Toastify({
        node: successEl,
        duration: 3000,
        newWindow: true,
        close: true,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
      }).showToast();
    }
  };

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <div className="flex items-center h-10">
          <div className="text-lg font-medium group-[.mode--light]:text-white">
            Validation
          </div>
          <div className="group-[.mode--light]:text-white/80 mx-3 hidden lg:block">
            •
          </div>
          <div className="group-[.mode--light]:text-white/80 text-slate-500 leading-relaxed hidden lg:block">
            Discover the simplicity and power of our Validation component for
            building error-free and user-friendly forms in your web
            applications.
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-12 gap-y-10 gap-x-6">
          <div className="relative flex flex-col col-span-12 gap-y-7">
            <div className="flex flex-col p-5 box box--stacked">
             
              {/* BEGIN: Success Notification Content */}
              <Notification
                id="success-notification-content"
                className="flex hidden"
              >
                <Lucide icon="CircleCheck" className="text-success" />
                <div className="ml-4 mr-4">
                  <div className="font-medium">Registration success!</div>
                  <div className="mt-1 text-slate-500">
                    Please check your e-mail for further info!
                  </div>
                </div>
              </Notification>
              {/* END: Success Notification Content */}
              {/* BEGIN: Failed Notification Content */}
              <Notification
                id="failed-notification-content"
                className="flex hidden"
              >
                <Lucide icon="CircleX" className="text-danger" />
                <div className="ml-4 mr-4">
                  <div className="font-medium">Registration failed!</div>
                  <div className="mt-1 text-slate-500">
                    Please check the fileld form.
                  </div>
                </div>
              </Notification>
              {/* END: Failed Notification Content */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;
