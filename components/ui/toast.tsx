"use client";

import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  const show = useCallback((text: string) => {
    setMsg(text);
    setVisible(true);
    setTimeout(() => setVisible(false), 2000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-300 pointer-events-none z-[100]"
        style={{
          background: "var(--fg)",
          color: "var(--bg)",
          opacity: visible ? 1 : 0,
          transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        }}
      >
        {msg}
      </div>
    </ToastContext.Provider>
  );
}
