"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Check, X, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import { 
  createWebsitePackage, 
  updateWebsitePackage
} from "@/app/actions/sales-assets";
import type { WebsitePackage } from "@prisma/client";
import { useWhatsApp } from "@/components/whatsapp-context";
import {
  broadcastPackagesUpdated,
  setCachedPackages,
  subscribePackagesUpdated,
} from "../packages-sync";

export function PackagesWorkspace({ 
  initialPackages = [],
  packages: controlledPackages,
  onPackagesChange,
}: { 
  initialPackages?: WebsitePackage[];
  packages?: WebsitePackage[];
  onPackagesChange?: (packages: WebsitePackage[]) => void;
}) {
  const router = useRouter();
  const { openWhatsAppForAsset } = useWhatsApp();
  const [packages, setPackages] = useState<WebsitePackage[]>(controlledPackages || initialPackages);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WebsitePackage>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if parent props update
  useEffect(() => {
    const next = controlledPackages || initialPackages;
    if (next && next.length > 0) {
      setPackages(next);
      setCachedPackages(next);
    }
  }, [controlledPackages, initialPackages]);

  // Listen to package broadcast updates across components
  useEffect(() => {
    const unsubscribe = subscribePackagesUpdated((updatedPkgs) => {
      setPackages(updatedPkgs);
    });
    return unsubscribe;
  }, []);

  const handleEdit = (pkg: WebsitePackage) => {
    setEditForm(pkg);
    setIsEditing(pkg.id);
  };

  const handleAddNew = () => {
    const newPkg = {
      id: "new",
      name: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      price: 0 as any,
      isStartingPrice: false,
      inclusions: "",
      hosting: "",
      domain: "",
      isActive: true,
      sortOrder: packages.length + 1,
    } as unknown as WebsitePackage;
    setPackages([...packages, newPkg]);
    handleEdit(newPkg);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let updatedPackages = [...packages];
      if (editForm.id === "new") {
        const res = await createWebsitePackage(editForm);
        if (res.success && res.data) {
          const created = res.data as WebsitePackage;
          updatedPackages = packages.map((p) => (p.id === "new" ? created : p));
        }
      } else {
        const res = await updateWebsitePackage(editForm.id as string, editForm);
        if (res.success && res.data) {
          const updated = res.data as WebsitePackage;
          updatedPackages = packages.map((p) => (p.id === editForm.id ? updated : p));
        }
      }
      setPackages(updatedPackages);
      setCachedPackages(updatedPackages);
      broadcastPackagesUpdated(updatedPackages);
      onPackagesChange?.(updatedPackages);
      try {
        router.refresh();
      } catch {
        // safe fallback
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
      setPackages(packages.filter((p) => p.id !== "new"));
    }
    setIsEditing(null);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === packages.length - 1) return;

    const newPackages = [...packages];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    // Swap sortOrders
    const currentOrder = newPackages[index].sortOrder;
    newPackages[index].sortOrder = newPackages[targetIndex].sortOrder;
    newPackages[targetIndex].sortOrder = currentOrder;

    // Swap positions
    const temp = newPackages[index];
    newPackages[index] = newPackages[targetIndex];
    newPackages[targetIndex] = temp;

    setPackages(newPackages);
    setCachedPackages(newPackages);
    broadcastPackagesUpdated(newPackages);
    onPackagesChange?.(newPackages);
    try {
      router.refresh();
    } catch {
      // safe fallback
    }
    
    // Save to DB
    await updateWebsitePackage(newPackages[index].id, { sortOrder: newPackages[index].sortOrder });
    await updateWebsitePackage(newPackages[targetIndex].id, { sortOrder: newPackages[targetIndex].sortOrder });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">Website Packages</h2>
        <button onClick={handleAddNew} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-700" disabled={isEditing !== null}>
          <Plus size={16} /> Add Package
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg, i) => (
          <div key={pkg.id} className={`border rounded-xl p-4 flex flex-col bg-white shadow-sm ${!pkg.isActive ? 'opacity-60' : ''}`}>
            {isEditing === pkg.id ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <input type="text" className="border rounded px-2 py-1 font-bold w-full" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Package Name" />
                
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium">₹</span>
                  
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <input type="number" className="border rounded px-2 py-1 flex-1 text-sm w-full md:w-auto" value={Number(editForm.price) || 0} onChange={e => setEditForm({...editForm, price: Number(e.target.value) as any})} placeholder="Price" />
                  <label className="text-sm flex items-center gap-1 w-full md:w-auto whitespace-nowrap">
                    <input type="checkbox" checked={editForm.isStartingPrice} onChange={e => setEditForm({...editForm, isStartingPrice: e.target.checked})} /> &quot;Starting at&quot;
                  </label>
                </div>
                <textarea className="border rounded px-2 py-1 text-sm w-full mt-2 h-20" value={editForm.inclusions} onChange={e => setEditForm({...editForm, inclusions: e.target.value})} placeholder="Inclusions (one per line)"></textarea>
                <div className="flex flex-col md:flex-row gap-2 mt-2">
                  <input type="text" className="border rounded px-2 py-1 text-sm flex-1" value={editForm.hosting || ""} onChange={e => setEditForm({...editForm, hosting: e.target.value})} placeholder="Hosting terms" />
                  <input type="text" className="border rounded px-2 py-1 text-sm flex-1" value={editForm.domain || ""} onChange={e => setEditForm({...editForm, domain: e.target.value})} placeholder="Domain terms" />
                </div>
                
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({...editForm, isActive: e.target.checked})} /> Active Package
                </label>

                <div className="flex justify-end gap-2 mt-auto pt-4 border-t">
                  <button onClick={handleCancel} className="p-2 text-slate-500 hover:bg-slate-100 rounded">
                    <X size={16} />
                  </button>
                  <button onClick={handleSave} disabled={isSaving} className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                    <Check size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{pkg.name}</h3>
                    <p className="text-emerald-700 font-semibold text-lg">
                      {pkg.isStartingPrice && <span className="text-xs text-slate-500 font-normal">Starting from </span>}
                      ₹{Number(pkg.price).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openWhatsAppForAsset({ templateTitle: "Packages / Pricing", packageId: pkg.id })} className="flex items-center gap-1.5 px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-semibold border border-emerald-100 transition-colors mr-2">
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button onClick={() => handleMove(i, "up")} disabled={i === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp size={16} /></button>
                    <button onClick={() => handleMove(i, "down")} disabled={i === packages.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown size={16} /></button>
                    <button onClick={() => handleEdit(pkg)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={16} /></button>
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-600 whitespace-pre-wrap flex-1 leading-relaxed">
                  {pkg.inclusions}
                </div>

                <div className="mt-4 pt-3 border-t text-xs text-slate-500 space-y-1">
                  <p><span className="font-semibold text-slate-700">Hosting:</span> {pkg.hosting}</p>
                  <p><span className="font-semibold text-slate-700">Domain:</span> {pkg.domain}</p>
                </div>
                {!pkg.isActive && <div className="mt-2 text-xs font-bold text-red-500 bg-red-50 p-1 text-center rounded">DISABLED</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
