import clsx from "clsx";

const HubBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Gradient mesh animato */}
      <div
        className={clsx(
          "absolute inset-0",
          "bg-gradient-to-br from-theme-1 via-theme-2 to-theme-1",
          "animate-gradient-bg bg-[length:400%_400%]"
        )}
      />
      {/* Texture overlay */}
      <div className="absolute inset-0 bg-texture-white bg-fixed bg-center bg-no-repeat opacity-30" />
      {/* Cerchi decorativi sfocati */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
    </div>
  );
};

export default HubBackground;
