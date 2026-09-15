"use client";

import { useEffect, useRef, type RefObject } from "react";

let openDialogs = 0;
let originalOverflow = "";
const stack: symbol[] = [];

/** Share body locking and keyboard ownership when a form opens above details. */
export function useDialogAccessibility(open: boolean, close: () => void, saving: boolean, focusRef: RefObject<HTMLElement | null>) {
  const latest = useRef({ close, saving });
  useEffect(() => { latest.current = { close, saving }; }, [close, saving]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const token = Symbol("dialog");
    stack.push(token);
    if (openDialogs++ === 0) { originalOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    focusRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      const dialog = focusRef.current?.closest('[role="dialog"]');
      // An independently managed dialog (e.g. WhatsApp) can be layered above us.
      const activeDialog = document.activeElement?.closest('[role="dialog"]');
      if (activeDialog && activeDialog !== dialog) return;
      if (event.key === "Escape" && !latest.current.saving) { event.preventDefault(); latest.current.close(); }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      stack.splice(stack.indexOf(token), 1);
      if (--openDialogs === 0) document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKey);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, focusRef]);
}
