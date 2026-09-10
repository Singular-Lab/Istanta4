import Button from "@/components/Base/Button";
import { FormInput, FormLabel } from "@/components/Base/Form";
import clsx from "clsx";
import { useForm } from "react-hook-form";

type FormValues = {
    telefono: string;
};

const ConfirmOptInWhatsapp: React.FC<{ showcaseActive?: boolean; topBarActive?: boolean }> = ({
    showcaseActive = false,
    topBarActive = false,
}) => {
    const { register, handleSubmit, formState } = useForm<FormValues>();

    const onSubmit = (data: FormValues) => {
        alert(`Numero confermato: ${data.telefono}`);
    };

    return (
        <div
            className={clsx([
                "landing-page relative w-full min-h-screen overflow-x-hidden flex items-center justify-center",
                "before:content-[''] before:w-screen before:h-screen before:fixed before:bg-slate-100 before:z-[-1]",
            ])}
        >
            <div
                className={clsx([
                    "relative group background scroll-smooth w-full min-h-screen overflow-x-hidden flex items-center justify-center",
                    "before:content-[''] before:w-screen before:h-screen before:rounded-[0_0_50%] [&.background--hidden]:before:from-slate-100 [&.background--hidden]:before:to-transparent before:bg-gradient-to-b before:from-theme-1 before:to-theme-2 before:absolute before:z-[-1] before:transition-colors before:ease-in-out before:duration-300",
                    "after:content-[''] after:z-[-1] after:h-screen after:w-screen [&.background--hidden]:after:opacity-0 after:transition-[opacity,height] after:ease-in-out after:duration-300 after:top-0 after:fixed after:bg-texture-white after:bg-contain after:bg-fixed after:bg-[center_-25rem] after:bg-no-repeat",
                    topBarActive && "background--hidden",
                ])}
            >
                <div
                    className={clsx([
                        "relative flex justify-center items-center w-full h-full",
                        "before:content-[''] before:inset-0 before:box before:absolute before:opacity-0 before:border-0 before:bg-gradient-to-r before:from-theme-1 before:to-theme-2 before:rounded-xl",
                        "group-[.background--hidden]:before:opacity-100",
                        "after:content-[''] after:z-[-1] after:inset-x-4 after:shadow-sm after:opacity-0 after:h-full after:bg-primary/5 after:border after:border-primary/10 after:absolute after:rounded-lg after:mx-auto after:top-0 after:mt-3 after:dark:bg-darkmode-600/70 after:dark:border-darkmode-500/60",
                        "group-[.background--hidden]:after:opacity-100",
                        "min-h-screen overflow-hidden", // Ensures vertical centering
                    ])}
                >
                    <div className="max-w-md mx-auto p-6 bg-white rounded shadow w-full z-50">
                        <h1 className="text-xl font-bold mb-4">Conferma Opt-In WhatsApp</h1>
                        <p className="mb-6 text-slate-600">
                            Grazie per aver confermato la tua iscrizione a WhatsApp!
                        </p>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <FormLabel htmlFor="telefono">Numero di telefono</FormLabel>
                            <FormInput
                                id="telefono"
                                type="tel"
                                placeholder="Inserisci il tuo numero"
                                {...register("telefono", { required: true })}
                            />
                            {formState.errors.telefono && (
                                <span className="text-red-500 text-sm">Il numero è obbligatorio</span>
                            )}
                            <Button type="submit" className="mt-4 w-full">
                                Conferma
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmOptInWhatsapp;
