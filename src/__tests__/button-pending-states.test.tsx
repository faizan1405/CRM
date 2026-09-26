import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteEditor } from "@/features/personal-notes/components/note-editor";
import { QuickNoteBox } from "@/features/personal-notes/components/quick-note-box";

describe("Button Pending States & Double-Submit Prevention", () => {
  describe("NoteEditor", () => {
    it("renders idle state with Save Note label and not aria-busy", () => {
      const html = renderToStaticMarkup(
        <NoteEditor
          note={{
            id: "note-1",
            title: "Test Note",
            content: "Some content",
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onSave={() => {}}
          onClose={() => {}}
          isSaving={false}
        />
      );
      expect(html).toContain("Save Note");
      expect(html).not.toContain("aria-busy=\"true\"");
      expect(html).not.toContain("Saving...");
    });

    it("renders saving state with spinner, Saving... text, disabled button, and aria-busy=true", () => {
      const html = renderToStaticMarkup(
        <NoteEditor
          note={{
            id: "note-1",
            title: "Test Note",
            content: "Some content",
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          onSave={() => {}}
          onClose={() => {}}
          isSaving={true}
        />
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Saving...");
      expect(html).toContain("animate-spin");
      expect(html).toContain("disabled");
    });
  });

  describe("QuickNoteBox", () => {
    it("renders idle state with Save Note and Plus icon", () => {
      const html = renderToStaticMarkup(
        <QuickNoteBox onSave={() => {}} saving={false} />
      );
      expect(html).toContain("Save Note");
      expect(html).not.toContain("aria-busy=\"true\"");
    });

    it("renders pending state with subtle spinner and disabled attribute when saving=true", () => {
      const html = renderToStaticMarkup(
        <QuickNoteBox onSave={() => {}} saving={true} />
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Saving...");
      expect(html).toContain("animate-spin");
      expect(html).toContain("disabled");
    });
  });
});
