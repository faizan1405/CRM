"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useId,
} from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { improveNoteText } from "@/app/actions/conversation-notes";

export interface AiNoteEditorProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  textareaClassName?: string;
  label?: React.ReactNode;
  labelClassName?: string;
  helperText?: React.ReactNode;
  showCharCount?: boolean;
  compact?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmitShortcut?: () => void;
  onImprove?: (text: string) => Promise<{ success: boolean; data?: string; error?: string } | string>;
  improveButtonLabel?: string;
  undoButtonLabel?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export interface AiNoteEditorHandle {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  textarea: HTMLTextAreaElement | null;
}

export const AiNoteEditor = forwardRef<AiNoteEditorHandle, AiNoteEditorProps>(
  function AiNoteEditor(
    {
      id: customId,
      name,
      value: controlledValue,
      defaultValue = "",
      onChange,
      placeholder = "Write a note...",
      rows = 3,
      maxLength,
      disabled = false,
      required = false,
      autoFocus = false,
      className = "",
      textareaClassName = "",
      label,
      labelClassName = "block text-xs font-semibold text-slate-700 mb-1",
      helperText,
      showCharCount = false,
      compact = false,
      onKeyDown,
      onSubmitShortcut,
      onImprove,
      improveButtonLabel = "Improve with AI",
      undoButtonLabel = "Undo",
      "aria-label": ariaLabel,
      "aria-describedby": customAriaDescribedBy,
    },
    ref
  ) {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const isControlled = controlledValue !== undefined;

    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const currentValue = isControlled ? controlledValue : uncontrolledValue;

    const [originalDraft, setOriginalDraft] = useState<string | null>(null);
    const [isImproving, setIsImproving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      getValue: () => currentValue,
      setValue: (val: string) => {
        if (!isControlled) {
          setUncontrolledValue(val);
        }
        onChange?.(val);
      },
      textarea: textareaRef.current,
    }));

    useEffect(() => {
      if (autoFocus && !disabled && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, [autoFocus, disabled]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextVal = e.target.value;
      if (maxLength && nextVal.length > maxLength) return;

      if (!isControlled) {
        setUncontrolledValue(nextVal);
      }
      onChange?.(nextVal);
      if (error) setError(null);
    };

    const handleImprove = async () => {
      const raw = (currentValue || "").trim();
      if (!raw || isImproving || disabled) return;

      setError(null);
      setIsImproving(true);

      try {
        let improvedText: string | undefined;

        if (onImprove) {
          const customRes = await onImprove(raw);
          if (typeof customRes === "string") {
            improvedText = customRes;
          } else if (customRes.success && customRes.data) {
            improvedText = customRes.data;
          } else if (!customRes.success) {
            setError(customRes.error || "Failed to improve note.");
            return;
          }
        } else {
          const res = await improveNoteText(raw);
          if (res.success && res.data) {
            improvedText = res.data;
          } else {
            setError(res.error || "Failed to improve note. Please try again.");
            return;
          }
        }

        if (improvedText) {
          setOriginalDraft(currentValue);
          if (!isControlled) {
            setUncontrolledValue(improvedText);
          }
          onChange?.(improvedText);
        }
      } catch (err) {
        console.error("AiNoteEditor improvement error:", err);
        setError("Something went wrong improving the note. Your draft was preserved.");
      } finally {
        setIsImproving(false);
      }
    };

    const handleUndo = () => {
      if (originalDraft !== null) {
        const restored = originalDraft;
        setOriginalDraft(null);
        setError(null);
        if (!isControlled) {
          setUncontrolledValue(restored);
        }
        onChange?.(restored);
      }
    };

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (e.nativeEvent.isComposing) return;
        if (onSubmitShortcut) {
          e.preventDefault();
          onSubmitShortcut();
        }
      }
    };

    const remainingChars = maxLength !== undefined ? maxLength - (currentValue?.length || 0) : null;
    const errorId = `${inputId}-error`;
    const charsId = `${inputId}-chars`;
    const describedBy = [
      error ? errorId : null,
      showCharCount && remainingChars !== null ? charsId : null,
      customAriaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={`ai-note-editor-container ${className}`}>
        {label && (
          <label htmlFor={inputId} className={labelClassName}>
            {label}
          </label>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            id={inputId}
            name={name}
            value={currentValue}
            onChange={handleTextChange}
            onKeyDown={handleKeyDownInternal}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled || isImproving}
            required={required}
            aria-label={ariaLabel}
            aria-describedby={describedBy || undefined}
            aria-busy={isImproving}
            className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 transition leading-relaxed ${textareaClassName}`}
          />
        </div>

        {/* Char count & helper text */}
        {(showCharCount || helperText) && (
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            {helperText ? <span>{helperText}</span> : <span />}
            {showCharCount && remainingChars !== null && (
              <span id={charsId} className={remainingChars <= 20 ? "text-amber-600 font-medium" : "text-slate-400"}>
                {remainingChars} left
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        {/* AI Action Controls */}
        <div className={`mt-2 flex items-center gap-2 ${compact ? "text-xs" : "text-xs"}`}>
          <button
            type="button"
            onClick={handleImprove}
            disabled={disabled || isImproving || !(currentValue || "").trim()}
            title={!(currentValue || "").trim() ? "Write a note draft first" : "Improve clarity with AI"}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors ${
              compact ? "min-h-7 px-2 py-1 text-[11px]" : "min-h-8 px-2.5 py-1.5 text-xs"
            }`}
          >
            {isImproving ? (
              <>
                <span className="size-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" />
                <span>Improving...</span>
              </>
            ) : (
              <>
                <Sparkles className={`text-blue-500 ${compact ? "size-3" : "size-3.5"}`} aria-hidden="true" />
                <span>{improveButtonLabel}</span>
              </>
            )}
          </button>

          {originalDraft !== null && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={disabled || isImproving}
              title="Undo AI improvement and restore previous draft"
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 font-medium text-slate-600 shadow-2xs hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors ${
                compact ? "min-h-7 px-2 py-1 text-[11px]" : "min-h-8 px-2.5 py-1.5 text-xs"
              }`}
            >
              <RotateCcw className={`text-slate-500 ${compact ? "size-3" : "size-3"}`} aria-hidden="true" />
              <span>{undoButtonLabel}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);
