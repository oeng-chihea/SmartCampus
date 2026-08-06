# Project Structure Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Angular frontend and NestJS backend into scalable Smart Campus Management System feature folders.

**Architecture:** Keep `frontend/` and `backend/` as separate application projects. Use matching business feature names across both apps so related frontend screens and backend APIs are easy to find.

**Tech Stack:** Angular, SCSS, NestJS, TypeScript, npm.

## Global Constraints

- Preserve the existing `frontend/` and `backend/` project boundaries.
- Do not remove existing source files or change current runtime behavior.
- Use `.gitkeep` placeholders for intentionally empty planned folders.
- Verify both projects after the reorganization.

---

### Task 1: Frontend Folder Structure

**Files:**
- Create folders under `frontend/src/app/core`, `frontend/src/app/shared`, `frontend/src/app/layouts`, `frontend/src/app/features`, `frontend/src/app/models`, `frontend/src/assets`, `frontend/src/environments`, and `frontend/src/styles`.
- Modify: `frontend/src/styles.scss`

**Interfaces:**
- Produces: Scalable Angular folder structure for auth, dashboard, students, courses, attendance, requests, notifications, reports, users, roles-permissions, and settings.

- [ ] Create the recommended frontend directories.
- [ ] Add `.gitkeep` files to empty planned folders.
- [ ] Split global SCSS partial placeholders into `frontend/src/styles/`.
- [ ] Import global SCSS partials from `frontend/src/styles.scss`.

### Task 2: Backend Folder Structure

**Files:**
- Create folders under `backend/src/common`, `backend/src/config`, `backend/src/database`, and `backend/src/modules`.
- Create: `backend/.env.example`

**Interfaces:**
- Produces: Scalable NestJS module structure for auth, users, students, courses, attendance, requests, notifications, reports, roles-permissions, and settings.

- [ ] Create the recommended backend directories.
- [ ] Add `.gitkeep` files to empty planned folders.
- [ ] Add a minimal `.env.example` documenting expected app/database variables.

### Task 3: Root Documentation And Verification

**Files:**
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Produces: Root-level project orientation for the two-app workspace.

- [ ] Add root README with project structure notes.
- [ ] Add root `.gitignore` for common generated files.
- [ ] Run frontend tests/build where available.
- [ ] Run backend tests/build where available.
