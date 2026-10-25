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
