import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: React.ReactNode;
}

export const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const handleReset = () => {
    setHasError(false);
    setError(null);
    window.location.reload();
  };

  if (hasError) {
    let errorMessage = "Algo salió mal. Por favor, intenta de nuevo.";
    
    try {
      if (error?.message) {
        const parsed = JSON.parse(error.message);
        if (parsed.error && parsed.error.includes('permission-denied')) {
          errorMessage = "No tienes permisos suficientes para realizar esta acción o ver estos datos.";
        }
      }
    } catch (e) {
      // Not a JSON error
    }

    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <AlertCircle size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-bold">¡Ups! Error de Sistema</h2>
          <p className="text-neutral-400">
            {errorMessage}
          </p>
          <Button onClick={handleReset} className="w-full flex items-center justify-center gap-2">
            <RefreshCcw size={18} />
            Reiniciar Aplicación
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
