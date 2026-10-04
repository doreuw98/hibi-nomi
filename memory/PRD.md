# HIBI NOMI — Product Requirements Document

## Original Problem Statement
Build HIBI NOMI, a personal daily water-intake tracking mobile app (React Native / Expo + FastAPI + MongoDB). Users set/calculate a personal daily water target, record intake with minimal taps, see today's progress, view daily/weekly/monthly reports with an achievement calendar, configure hourly drinking reminders with pause, manage profile & settings (ml/L units), and export data to CSV. Clean, fresh, aqua/blue lifestyle habit-tracker feel — not medical.

## Architecture
- **Frontend**: Expo Router, TypeScript, react-query, react-native-svg charts, phosphor icons, Nunito font, reanimated, custom Sheet (RN Modal), expo-notifications (local), @react-native-community/datetimepicker, expo-file-system + expo-sharing (CSV).
- **Backend**: FastAPI, Motor/MongoDB. Session-token auth (7-day tokens in `user_sessions`). bcrypt password hashing.
- **Auth**: Dual — JWT-style email/password (register/login/forgot/reset) AND Emergent-managed Google OAuth (`POST /api/auth/session`).
- **Collections**: users, user_profiles, water_intakes (soft delete via deleted_at), reminder_settings, user_sessions (TTL).
- **Local timezone**: intakes grouped by client-computed `local_date` (YYYY-MM-DD) to avoid UTC date shifts.
- **Target formula**: `calculate_daily_target(weight, activity)` = weight*35 + activity bonus, rounded to 50, clamped [1500,4000]. Separated business-logic function (backend + client mirror for preview).

## User Personas
- Health-conscious individual building a hydration habit who wants fast logging and clear progress.

## Core Requirements (static)
1. Account create/login/logout/forgot-password + session persistence.
2. Fast water logging (quick-add presets + custom), persistent, correct daily total/progress/remaining (caps remaining at 0, supports >100%).
3. Daily history with edit/delete.
4. Daily cumulative graph + previous days.
5. Personal target: auto-calc + custom override + wake/sleep schedule.
6. Weekly report (avg, achieved count, high/low, trend, insights).
7. Monthly report + achievement calendar (status color + icon + tap detail), month navigation.
8. Hourly reminders (interval, window, enable/disable, pause 30m/1h/2h/until tomorrow) via local notifications; permission handling.
9. Profile + settings (ml/L units), CSV export.
10. Empty/loading/error states everywhere; data isolated per user.

## Implemented (2026-06)
- [x] Full backend API (auth, profile, intakes, day summary, weekly/monthly reports, reminders, CSV export) — smoke-tested via curl.
- [x] Auth screens (login, register, forgot/reset password) + Google button; AuthContext gate.
- [x] Home: progress ring, quick-add pills, custom amount sheet, today's log with edit/delete.
- [x] Reports: weekly bar chart + insights, monthly KPIs + achievement calendar + day detail sheet, link to daily graph.
- [x] Daily graph screen with previous-day navigation (svg area chart).
- [x] Reminders screen: master toggle, interval chips, active window time pickers, pause pills, resume, permission rationale, local scheduling.
- [x] Profile + Personal Target screen (auto/custom modes, stepper, schedule) + Settings (units, name, CSV export).
- [x] Onboarding target setup after registration.
- [x] Nunito fonts, aqua theme, toasts, haptics.
- [x] Custom quick-add presets: `quick_presets` on profile — list of `{amount_ml, icon}` (1–6 unique, 1–5000 ml, sorted; icons: glass/mug/bottle/drop/wine/jar; legacy int lists auto-migrated in `normalize_presets`). Editable via `PresetsSheet` (icon picker + chip select) from Home and Settings. Shared model in `src/lib/presets.ts`.

## Backlog / Remaining
- P2: Weekly pattern analysis (morning/afternoon) richer insights.
- P2: Streaks / achievements gamification.

## Theme
- Light + dark palettes in `frontend/src/theme.ts`; `ThemeProvider` (`src/context/theme.tsx`) resolves preference System/Light/Dark (storage key `theme`, device-local) and exposes `useTheme()`. Status bar follows scheme. Settings → Theme segment.

## Localization
- Languages: English (default), Indonesian, Japanese. Dictionaries in `frontend/src/i18n/{en,id,ja}.ts`, provider + `t()/tArray()` in `src/i18n/index.tsx`. Stored locally (storage key `language`) and on profile (`language`, PUT /api/profile). Account language overrides device default on login (tabs layout effect).
- Locale-aware dates/time (`src/lib/datetime.ts`), notification bodies, and reset email (`RESET_COPY` in email_service.py) are translated.

## Security (audit June 2026)
- Password reset codes are emailed via Emergent-managed Resend (`backend/email_service.py`); API never returns the code. 8-char code, 15-min expiry, single-use; reset revokes all sessions.
- In-memory rate limiting on login/register/forgot/reset (429). Generic responses for forgot-password and duplicate register. CSV formula escaping. Security headers middleware.
- Backend env: EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME=HIBI NOMI.

## Notes
- Reminders fire on real device / dev build; local notifications don't fire in web preview. Pause resumes when app is next focused after the pause window.
