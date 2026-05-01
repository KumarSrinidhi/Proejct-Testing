/**
 * useOffline — service worker registration + online/offline state.
 *
 * Usage:
 *   const { isOffline } = useOffline();
 */
import { useEffect, useState } from "react";

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const setOnline = () => setIsOffline(false);
    const setOffline = () => setIsOffline(true);

    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);

    // Register service worker once
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.info("[SW] Registered", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    }

    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  return { isOffline };
}
