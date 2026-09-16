# Phase 11 revised frontend audit

Branch: `phase-11-ux-revision`. Based on Agent A's `ad211ca`, which supplies the real priority pagination action and existing backend improvements. This revision changes frontend presentation, navigation, frontend types, and tests only. No merge into main or deployment was performed.

## Dashboard

Order: header / quick actions, six latest real activities, KPIs, one Priority Leads feed, Today's Follow-ups schedule summary, Pipeline / Revenue summaries. The old Needs Attention, Today's Priorities, and AI Attention lists are consolidated into the real priority feed. Daily Briefing stays on its own page. Today's Follow-ups links to the schedule instead of repeating lead cards.

Priority Leads requests `getPriorityLeads(1)` on the server alongside dashboard summary data. Further button clicks request successive pages from the same action. Initial rendering is capped at ten; each response adds at most ten, with duplicate lead IDs removed. Loading, failure/retry, and exhaustion preserve the existing list. A full ten-item page permits a following request even if the endpoint's `hasMore` is false, because that endpoint does not fetch a lookahead row. No all-leads request is used for this feed.

Daily Briefing now reads **HOURLY SALES SCAN**.

## Card destinations and independent controls

| Card / row | Whole surface destination | Independent controls |
| --- | --- | --- |
| Dashboard Recent Activity | Associated Lead Detail, Activity / All | Existing record navigation |
| Dashboard Priority Lead | Associated Lead Detail | Call, WhatsApp, preselected Schedule Follow-up, Review |
| Dashboard KPI | Leads; NEW / QUALIFIED / WON status filters; Today's follow-ups; Analytics | Semantic link |
| Today's Follow-ups summary | `/follow-ups?filter=today` | Semantic link |
| Pipeline / Revenue summaries | Selected pipeline stage or Analytics | Semantic links |
| Leads card | Immediate lead summary panel, then fresh details | Trash, Call, WhatsApp, Note, Follow-up, Status, View |
| Leads table row | Associated Lead Detail; Enter / Space supported | Trash, Call, WhatsApp, View |
| Pipeline lead | Lead Detail; separate grip initiates dragging | Drag grip does not open details |
| AI Attention lead | Associated Lead Detail | Call, WhatsApp, Review |
| Notifications | Associated Lead Detail; entity-free notification stays in context | Dismiss, Mark Done, Call, WhatsApp, Schedule Follow-up |
| Daily Briefing action | Associated Lead Detail | Checklist / Done, Call, WhatsApp, Schedule Follow-up |
| Personal Note | Existing note editor | Pin, Edit, Delete |
| WhatsApp Template | Existing template editor on every viewport | Active toggle, Preview, Edit, Duplicate, Delete |
| Actionable Analytics / Lost summary | Existing Analytics sections, pipeline stages, or LOST leads | Semantic links; informational charts stay informational |
| Bulk draft | Individual editable review | Exclude / Include, duplicate open / update / create anyway, save |

Shared ActionCard ignores inner interactive controls and supports focus, Enter, and Space. It does not nest a native button inside another native button. Existing note/template action wrappers retain their independent event handling. Table rows preserve table semantics and provide keyboard activation.

Every existing Add Follow-up action uses the Phase 4 workflow. Entity actions open its modal in context with the lead preselected. Generic dashboard quick actions use the valid Follow-ups page and its existing new-form query handling. No `/follow-ups/new` route was added.

## Lead data and destructive actions

Budget controls / displays are removed from create/edit, detail, table, pipeline, AI preview, bulk review, call-note structured fields, and placeholder chips. Existing stored data and backend types are retained. An edit form's hidden legacy budget value avoids destructive loss on older action implementations; it is not a visible control. Quoted Amount stays separate and is accepted only from a real `quotedAmount` property, never inferred from Budget. AI entry calls Agent A's existing `structureBulkLeadAction`; one draft keeps the normal preview and multiple drafts show individual cards.

Trash on cards and table actions opens exactly one compact **Delete [Name]?** dialog with Cancel / Delete. Details and pipeline use that same dialog. Confirmation invokes the existing delete action once. Network failures leave the dialog available for retry.

Lost opens one shared reason modal. Standard reason selection immediately calls the existing status action. Other requires an explanation and one Save Lost submission. There is no second confirmation screen. Modal body locking / keyboard ownership work with layered lead details.

## Pipeline and mobile

All six droppables remain mounted. Columns use the same bounded board scroll parent, removing nested per-column scroll containers that prevented horizontal auto-scroll. The installed DnD library handles edge scrolling for mouse/touch; drop targets highlight. Its drag handle explicitly permits interaction on the grip button. See the official [scroll-container requirements](https://github.com/hello-pangea/dnd/blob/main/docs/api/droppable.md) and [auto-scroll guide](https://github.com/hello-pangea/dnd/blob/main/docs/guides/auto-scrolling.md).

Actual mouse drags began in New and scrolled to off-screen Proposal Sent, Won, and Lost successfully. Measured horizontal scrolling exceeded 850px without cancelling dragging. Lost then saved PRICE directly. Keyboard activation opens card details independently; native keyboard cross-column dragging remains limited by the installed library's handling of fully clipped destinations. iOS hardware behavior was not tested.

Lead Detail fits 100dvh, with min-h-0 and one content scroller. Header and footer occupy layout space rather than covering content; quick actions include Call, WhatsApp, Add Note, Follow-up, and Status. Tabs scroll horizontally. Standard / AI notes, focused composer, Edit/Delete, and status/footer remain reachable. The template editor additionally has a definite dynamic viewport height, one scrollable body, and a visible Save footer at 320px.

Revenue uses compact Indian notation: `₹16.68L` for `₹16,68,440`; title / accessible label retains the full amount. Large quoted values and phone strings can wrap. No heavy library, WebGL, or long animation was added. Existing dynamic panel loading and immediate list-summary opening are preserved. Hidden heavy call-note/composer panels mount only when needed.

## Verification

Browser verification used actual React components and project Tailwind styles in a local harness with mocked server actions. This avoided changing live CRM records. It validates frontend behavior; it is not a live database or deployed-endpoint certification.

- 320, 360, 390, 430, 768, 1440: Lead Detail fits, one vertical scroller, no panel overflow; AI mode fits; composer focused/visible; Edit/Delete reachable; ten-card bulk review and editor fit.
- All six widths: combined major card layouts rendered 31 cards and all six pipeline stages with document width equal to viewport width. Controlled pipeline / tab horizontal scrolling remains intentional.
- Whole-card and Enter/Space activation passed; inner Follow-up, Note Edit, and Template Edit stayed independent.
- Actual off-screen mouse drops: Proposal Sent PASS; Won PASS; Lost PASS. Edge auto-scroll PASS.
- Compact delete dialog and one delete submission PASS. Standard loss immediate save PASS; Other explanation / immediate submit PASS.
- Priority initial 10, +10 to 20, +10 to 30, and exhausted state PASS with the frontend loader fixture.
- Five Vitest tests PASS for the actual Agent A action adapter, full-page continuation without lookahead, numeric next page, retry errors, and compact INR.
- Notification follow-up modal / lead preselection PASS. Selected `2026-10-20 16:37` India time produced `2026-10-20T11:07:00.000Z`, without leaving Notifications.
- Real AI entry component with the Agent A DTO fixture showed ten drafts and no Budget UI. Add All Valid invoked ten existing create actions and passed the actual quoted amount (`45000`) separately.
- Whole template card opens editor PASS; Save Template is visibly within the 320px viewport.
- `npx tsc --noEmit` PASS; `npm run lint` PASS; `npm run build` PASS in this isolated revision worktree.

Ready for Agent A final integration: YES. Final integration should verify live authenticated pagination and persistence against Agent A's backend. No deployment or main merge is included.

## Files modified

- `src/__tests__/phase11-priority-ui.test.ts`
- `src/app/(crm)/dashboard/page.tsx`
- `src/features/ai-conversation-notes/ai-conversation-notes.tsx`
- `src/features/ai-conversation-notes/raw-notes-input.tsx`
- `src/features/analytics/components/analytics-kpis.tsx`
- `src/features/daily-briefing/components/daily-briefing-workspace.tsx`
- `src/features/dashboard/compact-currency.ts`
- `src/features/dashboard/components/kpi-cards.tsx`
- `src/features/dashboard/components/priority-leads.tsx`
- `src/features/dashboard/priority-page.ts`
- `src/features/leads/ai-lead-entry.tsx`
- `src/features/leads/bulk-lead-review.tsx`
- `src/features/leads/bulk-review-types.ts`
- `src/features/leads/delete-lead-dialog.tsx`
- `src/features/leads/lead-card.tsx`
- `src/features/leads/lead-detail-panel.tsx`
- `src/features/leads/lead-form.tsx`
- `src/features/leads/lead-navigation-provider.tsx`
- `src/features/leads/leads-workspace.tsx`
- `src/features/leads/lead-table.tsx`
- `src/features/leads/structured-lead-preview.tsx`
- `src/features/lost-reasons/lost-reason-dialog.tsx`
- `src/features/pipeline/pipeline-board.tsx`
- `src/features/pipeline/pipeline-card.tsx`
- `src/features/whatsapp-templates/components/placeholder-chips.tsx`
- `src/features/whatsapp-templates/components/template-editor.tsx`
- `src/features/whatsapp-templates/components/templates-workspace.tsx`
