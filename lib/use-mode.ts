"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Mode } from "./types";

const KEY = "ssal-mode";
const listeners = new Set<() => void>();
// 저장소가 막힌 브라우저(시크릿 창 등)에서도 이번 방문 동안은 전환되게
let memory: Mode = "food";

function read(): Mode {
  try {
    return localStorage.getItem(KEY) === "all" ? "all" : "food";
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 마지막으로 고른 모드를 기기에 기억한다. 서버 렌더와 첫 방문은 쌀먹찾기. */
export function useMode(): [Mode, (mode: Mode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => "food" as const);

  const setMode = useCallback((next: Mode) => {
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    listeners.forEach((l) => l());
  }, []);

  return [mode, setMode];
}
