# Admin Layout Responsive Students Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the students table clipping across devices and make the admin sidebar route all admin pages through the shared admin layout.

**Architecture:** Keep `AdminLayoutComponent` as the single shell with a nested `router-outlet`. Use Angular router directives in the sidebar. Make the students table shrink within its card on desktop/tablet and switch to labeled stacked rows on small screens.

**Tech Stack:** Angular standalone components, Angular Router, SCSS, Vitest for focused regression checks.

## Global Constraints

- Do not add a student-specific layout; no student layout exists under `frontend/src/app/layouts`.
- Keep `dashboard`, `students`, and future admin pages as children of `AdminLayoutComponent`.
- Keep edits scoped to the admin layout/sidebar, app routes, and students table.

---

### Task 1: Students Table Responsive Layout

**Files:**
- Modify: `frontend/src/app/features/students/components/student-table/student-table.component.html`
- Modify: `frontend/src/app/features/students/components/student-table/student-table.component.scss`
- Modify: `frontend/src/app/features/students/components/student-table/student-table.template.spec.ts`

**Interfaces:**
- Consumes: `StudentTableComponent.students`
- Produces: Responsive table rows with `data-label` values for mobile layout

- [ ] Add `data-label` attributes to each data cell.
- [ ] Remove the `min-width: 820px` forced grid behavior.
- [ ] Use fractional desktop columns and stacked mobile rows.
- [ ] Run `npm --prefix frontend exec vitest run src/app/features/students/components/student-table/student-table.template.spec.ts`.

### Task 2: Admin Sidebar Router Links

**Files:**
- Modify: `frontend/src/app/layouts/admin-layout/components/sidebar/sidebar.component.ts`
- Modify: `frontend/src/app/layouts/admin-layout/components/sidebar/sidebar.component.html`
- Modify: `frontend/src/app/core/constants/admin-navigation.ts`

**Interfaces:**
- Consumes: `ADMIN_NAVIGATION`
- Produces: Angular client-side links with active route state

- [ ] Import `RouterLink` and `RouterLinkActive`.
- [ ] Replace `[href]` with `[routerLink]`.
- [ ] Use `routerLinkActive` instead of exact string active matching.
- [ ] Give every sidebar item a unique route path.

### Task 3: Admin Layout Route Coverage

**Files:**
- Modify: `frontend/src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AdminLayoutComponent`
- Produces: Admin child routes for dashboard, students, and future sidebar pages

- [ ] Keep `/dashboard` and `/students` lazy-loaded.
- [ ] Add redirects for future sidebar pages to dashboard until their feature modules exist.
- [ ] Add a wildcard redirect to dashboard inside the admin shell.
- [ ] Run `npx tsc --noEmit -p tsconfig.app.json` from `frontend`.
