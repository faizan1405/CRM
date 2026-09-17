"use client";

import { useState } from "react";
import { Plus, Edit2, Check, X, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import { 
  createWebsiteSample, 
  updateWebsiteSample
} from "@/app/actions/sales-assets";
import type { WebsiteSample, SampleType } from "@prisma/client";
import { useWhatsApp } from "@/components/whatsapp-context";

export function SamplesWorkspace({ initialSamples }: { initialSamples: WebsiteSample[] }) {
  const { openWhatsAppForAsset } = useWhatsApp();
  const [samples, setSamples] = useState<WebsiteSample[]>(initialSamples);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WebsiteSample>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (sample: WebsiteSample) => {
    setEditForm(sample);
    setIsEditing(sample.id);
  };

  const handleAddNew = () => {
    const newSample = {
      id: "new",
      label: "",
      url: "",
      category: "",
      type: "LIVE",
      isActive: true,
      sortOrder: samples.length + 1,
    } as unknown as WebsiteSample;
    setSamples([...samples, newSample]);
    handleEdit(newSample);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editForm.id === "new") {
        
        const res = await createWebsiteSample(editForm);
        if (res.success) {
          setSamples(samples.map((s) => (s.id === "new" ? res.data as WebsiteSample : s)));
        }
      } else {
        
        const res = await updateWebsiteSample(editForm.id as string, editForm);
        if (res.success) {
          setSamples(samples.map((s) => (s.id === editForm.id ? res.data as WebsiteSample : s)));
        }
      }
      setIsEditing(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (editForm.id === "new") {
      setSamples(samples.filter((s) => s.id !== "new"));
    }
    setIsEditing(null);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === samples.length - 1) return;

    const newSamples = [...samples];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    // Swap sortOrders
    const currentOrder = newSamples[index].sortOrder;
    newSamples[index].sortOrder = newSamples[targetIndex].sortOrder;
    newSamples[targetIndex].sortOrder = currentOrder;

    // Swap positions
    const temp = newSamples[index];
    newSamples[index] = newSamples[targetIndex];
    newSamples[targetIndex] = temp;

    setSamples(newSamples);
    
    // Save to DB
    await updateWebsiteSample(newSamples[index].id, { sortOrder: newSamples[index].sortOrder });
    await updateWebsiteSample(newSamples[targetIndex].id, { sortOrder: newSamples[targetIndex].sortOrder });
  };

  const categories = Array.from(new Set(samples.filter(s => s.id !== 'new').map(s => s.category)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">Website Samples</h2>
        <button onClick={handleAddNew} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-700" disabled={isEditing !== null}>
          <Plus size={16} /> Add Sample
        </button>
      </div>

      <div className="space-y-8">
        {["LIVE", "DEMO"].map(type => (
          <div key={type} className="space-y-4">
            <h3 className="text-md font-bold text-slate-800 border-b pb-2">{type === "LIVE" ? "Custom Domain / Live Websites" : "Demo / Sample Websites"}</h3>
            
            <div className="flex flex-col gap-3">
              {samples.filter(s => s.type === type).map((sample, i, arr) => (
                <div key={sample.id} className={`flex items-center gap-4 bg-white border p-3 rounded-lg shadow-sm ${!sample.isActive ? 'opacity-60' : ''}`}>
                  {isEditing === sample.id ? (
                    <div className="flex-1 flex flex-col md:flex-row gap-3 items-start md:items-center">
                      <input type="text" className="border rounded px-2 py-1 flex-1 text-sm w-full" value={editForm.label || ""} onChange={e => setEditForm({...editForm, label: e.target.value})} placeholder="Label (Optional)" />
                      <input type="text" className="border rounded px-2 py-1 flex-[2] text-sm w-full" value={editForm.url} onChange={e => setEditForm({...editForm, url: e.target.value})} placeholder="URL (https://...)" />
                      <input type="text" className="border rounded px-2 py-1 flex-1 text-sm w-full" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} placeholder="Category" list="categories" />
                      <datalist id="categories">
                        {categories.map(c => <option key={c} value={c} />)}
                      </datalist>
                      <select className="border rounded px-2 py-1 text-sm w-full md:w-auto" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value as SampleType})}>
                        <option value="LIVE">Live</option>
                        <option value="DEMO">Demo</option>
                      </select>
                      <label className="text-sm flex items-center gap-1 w-full md:w-auto">
                        <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({...editForm, isActive: e.target.checked})} /> Active
                      </label>
                      <div className="flex gap-2 w-full md:w-auto justify-end">
                        <button onClick={handleCancel} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded">
                          <X size={16} />
                        </button>
                        <button onClick={handleSave} disabled={isSaving} className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                          <Check size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-6 min-w-0">
                        <div className="flex-1 min-w-0">
                          {sample.label ? (
                            <div className="font-semibold text-slate-900 truncate">{sample.label}</div>
                          ) : null}
                          <a href={sample.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                            {sample.url}
                          </a>
                        </div>
                        <div className="w-auto md:w-56 shrink-0 flex flex-col gap-1.5 items-start md:items-end">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium border">
                            {sample.category}
                          </span>
                          <button onClick={() => openWhatsAppForAsset({ templateTitle: "Website Samples", category: sample.category })} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                            <MessageCircle size={10} /> Send {sample.category}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openWhatsAppForAsset({ templateTitle: "Website Samples", sampleId: sample.id })} className="flex items-center gap-1.5 px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-semibold border border-emerald-100 transition-colors mr-1 md:mr-2">
                          <MessageCircle size={14} /> Send
                        </button>
                        <button onClick={() => handleMove(samples.findIndex(s => s.id === sample.id), "up")} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp size={16} /></button>
                        <button onClick={() => handleMove(samples.findIndex(s => s.id === sample.id), "down")} disabled={i === arr.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown size={16} /></button>
                        <button onClick={() => handleEdit(sample)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {samples.filter(s => s.type === type).length === 0 && (
                <div className="text-sm text-slate-500 italic p-4 text-center border rounded-lg bg-slate-50">No samples in this group.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
