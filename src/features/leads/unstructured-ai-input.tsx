import { LoaderCircle, Sparkles } from "lucide-react";

type UnstructuredAIInputProps = {
  value: string;
  onChange: (value: string) => void;
  onStructure: () => void;
  processing: boolean;
  error?: string | null;
  label?: string;
  placeholder?: string;
  actionLabel?: string;
  processingLabel?: string;
};

export function UnstructuredAIInput({
  value,
  onChange,
  onStructure,
  processing,
  error,
  label = "Lead details",
  placeholder = "Paste lead details here...",
  actionLabel = "Structure Lead",
  processingLabel = "Understanding lead details...",
}: UnstructuredAIInputProps) {
  return (
    <section
      aria-labelledby="ai-entry-input-title"
      aria-busy={processing}
      className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/70 to-white p-4 sm:p-5"
    >
      <div>
        <h2 id="ai-entry-input-title" className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Sparkles aria-hidden="true" className="text-blue-600" size={19} />
          Quick AI Entry
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Paste a message, rough call note, or just a phone number. You’ll review everything before saving.
        </p>
      </div>
      <label htmlFor="unstructured-lead-input" className="mt-4 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <textarea
        id="unstructured-lead-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={processing}
        rows={8}
        autoFocus
        placeholder={placeholder}
        className="mt-1.5 min-h-44 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-6 text-slate-900 shadow-inner outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-70"
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">Try: “Rahul ecommerce website 25k, call tomorrow”</p>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onStructure}
        disabled={processing || !value.trim()}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-base font-semibold text-white shadow-sm transition-[background-color,transform] hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? (
          <>
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" size={19} />
            <span role="status" aria-live="polite">{processingLabel}</span>
          </>
        ) : (
          <>
            <Sparkles aria-hidden="true" size={18} />
            ✨ {actionLabel}
          </>
        )}
      </button>
    </section>
  );
}
