// ----------------------------------------------
// COMPONENTI DI SUPPORTO AL DRAG&DROP

import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";

// ----------------------------------------------
const ActionButtons: React.FC<{
  onRemove: () => void;
  onLock?: () => void;
  onPolicy?: () => void;
  policyAttiva?: boolean;
  locked?: boolean;
}> = ({ onRemove, onLock, onPolicy, policyAttiva, locked }) => (
  <div className="absolute top-2 right-2 flex space-x-2">
    <Button
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onRemove();
      }}
      className="rounded-md"
      variant="danger"
      size="sm"
    >
      <Lucide icon="Trash2" className="w-4 h-4" />
    </Button>


    {onPolicy && (
      <Button
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onPolicy();
        }}
        className="rounded-md"
        variant={policyAttiva ? "soft-primary" : "secondary"}
        size="sm"
      >
        <Lucide
          icon={policyAttiva ? "Shield" : "ShieldOff"}
          className="w-4 h-4"
        />
      </Button>
    )}
    {onLock && (
      <Button
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onLock();
        }}
        className="rounded-md"
        variant={locked ? "dark" : "soft-dark"}
        size="sm"
      >
        <Lucide
          icon={locked ? "LockKeyhole" : "LockKeyholeOpen"}
          className="w-4 h-4"
        />
      </Button>
    )}
  </div>
);


export default ActionButtons;