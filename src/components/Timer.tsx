import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface TimerProps {
  startTime: number;
  totalHours: number;
  onAlert: () => void;
  onFinish: () => void;
  weeklyHoursDone: number;
  contractHours: number;
}

export const Timer = ({ startTime, totalHours, onAlert, onFinish, weeklyHoursDone, contractHours }: TimerProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasAlerted, setHasAlerted] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const totalMs = totalHours * 3600000;
      const elapsedMs = Date.now() - startTime;
      const remaining = Math.max(0, Math.floor((totalMs - elapsedMs) / 1000));
      
      // Lógica de Horas Extras
      const elapsedHours = elapsedMs / 3600000;
      if (weeklyHoursDone + elapsedHours >= contractHours) {
        setIsOvertime(true);
      } else {
        setIsOvertime(false);
      }

      return remaining;
    };

    const initialRemaining = calculateTimeLeft();
    setTimeLeft(initialRemaining);

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      // Alerta 10 minutos antes (600 segundos)
      if (remaining <= 600 && remaining > 0 && !hasAlerted) {
        onAlert();
        setHasAlerted(true);
      }

      // Solo finalizar si el tiempo realmente se ha agotado y había tiempo inicial
      if (remaining <= 0 && totalHours > 0) {
        clearInterval(interval);
        onFinish();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, totalHours, onAlert, onFinish]); // Eliminado hasAlerted para evitar reinicios innecesarios

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    if (timeLeft > 600) return 'text-emerald-500';
    if (timeLeft > 0) return 'text-[#F97316]';
    return 'text-rose-500';
  };

  const progress = Math.min(100, (1 - timeLeft / (totalHours * 3600)) * 100);

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <div className="flex flex-col items-center">
        {isOvertime && (
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-black uppercase tracking-[0.3em] text-rose-500 mb-2 bg-rose-500/10 px-3 py-1 rounded-full"
          >
            Horas Extras
          </motion.span>
        )}
        <div className={cn("text-8xl md:text-9xl font-black tracking-tighter tabular-nums transition-colors duration-500", isOvertime ? "text-rose-500" : getStatusColor())}>
          {formatTime(timeLeft)}
        </div>
      </div>
      
      <div className="w-full max-w-md h-3 bg-neutral-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000 ease-linear", 
            isOvertime ? "bg-rose-500" : timeLeft > 600 ? "bg-emerald-500" : timeLeft > 0 ? "bg-[#F97316]" : "bg-rose-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
