import { useEffect, useState } from 'react';

const LOADING_DELAY = 500;

export function useDelayed(active: boolean, delay = LOADING_DELAY): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return setShown(false);
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return active && shown;
}

export function useTicker(active: boolean, interval = 80): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setFrame((f) => f + 1), interval);
    return () => clearInterval(timer);
  }, [active, interval]);
  return frame;
}
