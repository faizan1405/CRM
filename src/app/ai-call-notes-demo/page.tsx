"use client";

import { useState } from "react";
import {
  AIConversationNotes,
  DEFAULT_QUICK_TAGS,
  MOCK_NOTE_PRESETS,
  mockStructureNotesCallback,
  type CallNotesWorkflowResult,
} from "@/features/ai-conversation-notes";
import { Smartphone, Monitor, Sparkles, CheckCircle2, History } from "lucide-react";

export default function AICallNotesDemoPage() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [simulatedWidth, setSimulatedWidth] = useState<"full" | "390" | "360">("full");
  const [activityLog, setActivityLog] = useState<CallNotesWorkflowResult[]>([]);
  const [demoKey, setDemoKey] = useState<number>(1);
  const [initialNote, setInitialNote] = useState<string>(
    "interested ecommerce 25k budget talk with partner follow up friday 4pm"
  );

  const handleSelectPreset = (rawNote: string, id: string) => {
    setSelectedPresetId(id);
    setInitialNote(rawNote);
    setDemoKey((k) => k + 1);
  };

  const handleApply = (result: CallNotesWorkflowResult) => {
    setActivityLog((prev) => [result, ...prev]);
  };

  const handleKeep = (result: CallNotesWorkflowResult) => {
    setActivityLog((prev) => [result, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Demo Top Bar (Isolated - NO global CRM navigation) */}
      <header className="border-b border-slate-200 bg-white shadow-xs sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                AI Conversation &amp; Call Notes
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Isolated Demo &middot; Frontend Prototype
              </p>
            </div>
          </div>

          {/* Viewport Simulation Controls */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200" role="group" aria-label="Viewport size simulator">
            <button
              type="button"
              onClick={() => setSimulatedWidth("360")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                simulatedWidth === "360"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="size-3.5" aria-hidden="true" />
              <span>360px</span>
            </button>
            <button
              type="button"
              onClick={() => setSimulatedWidth("390")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                simulatedWidth === "390"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="size-3.5" aria-hidden="true" />
              <span>390px</span>
            </button>
            <button
              type="button"
              onClick={() => setSimulatedWidth("full")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                simulatedWidth === "full"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Monitor className="size-3.5" aria-hidden="true" />
              <span>Full Width</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {/* Preset Quick Loader Bar */}
        <section aria-labelledby="presets-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <h2 id="presets-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Test with Sample Rough Notes:
          </h2>
          <div className="flex flex-wrap gap-2">
            {MOCK_NOTE_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.rawNote, preset.id)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold text-left transition active:scale-[0.98] ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-100"
                      : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <Sparkles className="size-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleSelectPreset("", "custom")}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              + Clear &amp; Type Custom Note
            </button>
          </div>
        </section>

        {/* Viewport Simulation Frame */}
        <div className="flex justify-center">
          <div
            className={`w-full transition-all duration-200 ${
              simulatedWidth === "360"
                ? "max-w-[360px] border-x-4 border-slate-300 bg-slate-50 p-2 sm:p-4 rounded-3xl shadow-xl"
                : simulatedWidth === "390"
                ? "max-w-[390px] border-x-4 border-slate-300 bg-slate-50 p-2 sm:p-4 rounded-3xl shadow-xl"
                : "max-w-2xl"
            }`}
          >
            {simulatedWidth !== "full" && (
              <div className="mb-3 text-center">
                <span className="inline-block rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  Simulating {simulatedWidth}px Viewport (No Horizontal Overflow)
                </span>
              </div>
            )}

            {/* Feature Component Under Test */}
            <AIConversationNotes
              key={demoKey}
              initialRawNote={initialNote}
              availableTags={DEFAULT_QUICK_TAGS}
              onStructureNotes={mockStructureNotesCallback}
              onApplyStructured={handleApply}
              onKeepOriginal={handleKeep}
            />
          </div>
        </div>

        {/* Simulation Activity Output Stream */}
        {activityLog.length > 0 && (
          <section
            aria-labelledby="activity-log-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <History className="size-4 text-slate-600" aria-hidden="true" />
              <h2 id="activity-log-heading" className="text-sm font-bold text-slate-900">
                Phase 5 Lead Activity Notes Log (Simulated)
              </h2>
            </div>
            <div className="space-y-3">
              {activityLog.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.appliedType === "structured"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      {item.appliedType === "structured" ? "Applied Structured Note" : "Kept Original Raw Note"}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {new Date(item.appliedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="font-mono text-slate-800 whitespace-pre-wrap rounded-lg bg-white p-2.5 border border-slate-200 text-xs">
                    {item.formattedOutput}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
