# Snip — URL Shortener

A production-ready URL shortener built on **TanStack Start** (React 19, Vite) and **Lovable Cloud** (managed Postgres + Auth + serverless functions).

## Features

- ✂️ Create short URLs with random codes or custom aliases
- 🔒 Optional password protection (SHA-256 hashed)
- ⏰ Optional expiry dates (expired links show a proper error page)
- 📊 Per-URL analytics: total clicks, device, browser, referrer, timestamps
- 📱 Auto-generated QR codes (downloadable PNG)
- 🔍 Search, filter, and paginate your URL library
- 🔐 Email/password + Google OAuth authentication
- 🛡️ Row-Level Security on every table
- 🎨 Dark, "developer-tool" UI with semantic design tokens

## Stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (React 19, Vite 7) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Forms | React Hook Form + Zod |
| Data | TanStack Query |
| Backend | Lovable Cloud (Postgres, Auth, server functions) |
| Hosting | Lovable (auto-deploys) |

## Routes

| Path | Description |
| --- | --- |
| `/` | Landing page |
| `/auth` | Login / Register |
| `/dashboard` | Stats overview |
| `/urls` | URL list (search, filter, paginate) |
| `/urls/new` | Create short URL |
| `/urls/$id` | Details + analytics + QR code |
| `/r/$code` | Public redirect (password / expiry aware) |

## Data Model

- **profiles** (id, name, email) — auto-created on signup
- **urls** (user_id, original_url, short_code, title, description, expires_at, is_active, password_hash, total_clicks, last_accessed_at)
- **click_events** (url_id, ip_address, user_agent, browser, device, country, referrer)

Indexes on `urls.short_code`, `urls.user_id`, `urls.created_at`, `click_events.url_id`.

## Security

- Row-Level Security on every public table
- Owner-only access for URL management & analytics
- Anon role can SELECT only active, non-expired URLs (required for the redirect lookup)
- Password hashing via SHA-256 with a static salt (suitable for low-risk link gating)
- Password leak protection enabled at signup (HIBP)

## Local Development

```bash
bun install
bun run dev
```

Backend is connected automatically via Lovable Cloud (see `.env`).

## Deployment

Click **Publish** in the Lovable editor. Frontend and backend deploy together.

---

Built with [Lovable](https://lovable.dev).
