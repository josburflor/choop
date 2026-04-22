import React, { useState } from 'react';
import { Key, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface AccessKeyProps {
  accessKey: string;
  className?: string;
}

export const AccessKey: React.FC<AccessKeyProps> = ({ accessKey, className }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={cn("flex justify-between items-center group/key", className)}>
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Key size={14} />
        Clave Acceso
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-bold text-[#F97316]">
          {isVisible ? accessKey : '••••••'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(!isVisible);
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-500 hover:text-white"
          title={isVisible ? "Ocultar clave" : "Mostrar clave"}
        >
          {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
};
