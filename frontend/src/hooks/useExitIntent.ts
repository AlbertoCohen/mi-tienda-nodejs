import { useEffect, useState } from 'react';

export const useExitIntent = () => {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 20 && !triggered) {
        const dismissed = sessionStorage.getItem('exit_intent_dismissed');
        if (!dismissed) {
          setTriggered(true);
        }
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [triggered]);

  const dismiss = () => {
    sessionStorage.setItem('exit_intent_dismissed', 'true');
    setTriggered(false);
  };

  return { showModal: triggered, dismiss };
};
