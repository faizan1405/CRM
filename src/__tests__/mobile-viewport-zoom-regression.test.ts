import * as fs from "fs";
import * as path from "path";

describe("Mobile Auto-Zoom and Viewport Prevention", () => {
  const rootDir = path.resolve(__dirname, "../../");

  describe("1. Next.js Viewport Metadata API", () => {
    const layoutTsx = fs.readFileSync(path.join(rootDir, "src/app/layout.tsx"), "utf-8");

    it("exports Viewport with width='device-width' and initialScale=1", () => {
      expect(layoutTsx).toMatch(/export\s+const\s+viewport:\s*Viewport\s*=\s*\{/);
      expect(layoutTsx).toContain('width: "device-width"');
      expect(layoutTsx).toContain("initialScale: 1");
    });

    it("does not restrict user pinch zoom (no userScalable: false or maximumScale: 1)", () => {
      expect(layoutTsx).not.toContain("userScalable");
      expect(layoutTsx).not.toContain("maximumScale");
    });
  });

  describe("2. Global CSS Mobile Typography & Layout Enforcement", () => {
    const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");

    it("enforces font-size: 16px !important on mobile viewports (<640px) for form controls", () => {
      expect(globalsCss).toContain("@media (max-width: 639px)");
      expect(globalsCss).toContain("font-size: 16px !important;");
      expect(globalsCss).toMatch(/input[^{]*textarea[^{]*select[^{]*\{[\s\S]*?font-size:\s*16px\s*!important/);
    });

    it("clips horizontal overflow on html and body to prevent page expansion", () => {
      expect(globalsCss).toMatch(/html\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-x:\s*clip;/);
      expect(globalsCss).toMatch(/body\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-x:\s*clip;/);
    });

    it("uses vertical motion instead of off-screen horizontal translateX for mobile drawer animation", () => {
      expect(globalsCss).toContain("@media (max-width: 639px)");
      expect(globalsCss).toMatch(/@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*?@keyframes\s+lead-panel-in\s*\{[\s\S]*?translateY\(8px\)/);
    });
  });

  describe("3. Lead Detail Drawer & BottomSheet Container Overflow Protection", () => {
    const leadDetailPanel = fs.readFileSync(path.join(rootDir, "src/features/leads/lead-detail-panel.tsx"), "utf-8");
    const bottomSheet = fs.readFileSync(path.join(rootDir, "src/components/ui/bottom-sheet.tsx"), "utf-8");

    it("LeadDetailPanel has overflow-hidden on outer container and aside with max-w-full", () => {
      expect(leadDetailPanel).toContain("fixed inset-x-0 top-0 z-50 h-dvh overflow-hidden");
      expect(leadDetailPanel).toContain("max-w-full sm:max-w-xl");
      expect(leadDetailPanel).toContain("overflow-hidden");
    });

    it("BottomSheet has overflow-hidden on outer container and aside with max-w-full min-w-0", () => {
      expect(bottomSheet).toContain("fixed inset-x-0 bottom-0 z-[60] flex h-[100dvh] items-end justify-center sm:items-center overflow-hidden");
      expect(bottomSheet).toContain("max-w-full sm:max-w-lg min-w-0");
      expect(bottomSheet).toContain("overflow-hidden");
    });
  });

  describe("4. Component-Level Form Typography (Effective >= 16px on Mobile)", () => {
    it("Lead filters search and status dropdown use text-base on mobile with sm:text-sm", () => {
      const leadFilters = fs.readFileSync(path.join(rootDir, "src/features/leads/lead-filters.tsx"), "utf-8");
      expect(leadFilters).toContain("text-base text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm");
    });

    it("Lead Detail NoteComposer textarea uses text-base on mobile with sm:text-sm", () => {
      const noteComposer = fs.readFileSync(path.join(rootDir, "src/features/activity/note-composer.tsx"), "utf-8");
      expect(noteComposer).toContain("text-base sm:text-sm text-slate-900");
    });

    it("Lead Deal Section inputs, selects, and textareas use text-base on mobile with sm:text-sm", () => {
      const dealSection = fs.readFileSync(path.join(rootDir, "src/features/deals/components/lead-deal-section.tsx"), "utf-8");
      expect(dealSection).toContain("text-base sm:text-sm focus:border-blue-500 focus:outline-none");
    });

    it("Personal Notes quick-note-box and note-editor textareas use text-base on mobile", () => {
      const quickNote = fs.readFileSync(path.join(rootDir, "src/features/personal-notes/components/quick-note-box.tsx"), "utf-8");
      const noteEditor = fs.readFileSync(path.join(rootDir, "src/features/personal-notes/components/note-editor.tsx"), "utf-8");
      expect(quickNote).toContain("text-base sm:text-sm text-slate-900");
      expect(noteEditor).toContain("text-base sm:text-sm leading-relaxed");
    });

    it("WhatsApp composer and template picker textareas use text-base on mobile", () => {
      const composer = fs.readFileSync(path.join(rootDir, "src/features/whatsapp-templates/components/whatsapp-lead-composer.tsx"), "utf-8");
      const picker = fs.readFileSync(path.join(rootDir, "src/components/whatsapp-template-picker.tsx"), "utf-8");
      expect(composer).toContain("text-base sm:text-sm leading-relaxed");
      expect(picker).toContain("text-base sm:text-sm leading-relaxed");
    });

    it("Deals workspace search and sort use text-base on mobile with sm:text-xs", () => {
      const deals = fs.readFileSync(path.join(rootDir, "src/features/deals/components/deals-workspace.tsx"), "utf-8");
      expect(deals).toContain("text-base sm:text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:outline-none");
    });
  });
});
