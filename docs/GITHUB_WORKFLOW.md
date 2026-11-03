# Companion — GitHub Workflow

This document describes the standard workflow for developing and deploying Companion.

> **Golden rule:** Never push directly to `main` without reviewing what you are sending.
> Never use `--force` push. Never commit `.env` files or secrets.

---

## Repository

- **GitHub:** https://github.com/Nyxcreates/Companion
- **Branch:** `main`
- **Deployment:** Vercel (auto-deploys every push to `main`)

---

## Daily Development Workflow

### 1. Check what has changed

```powershell
Set-Location "c:\Users\Nishtha\OneDrive\Documents\Companion_App"
git status
```

### 2. Review your changes before staging

```powershell
# See a diff of unstaged changes
git diff

# See diff of already-staged changes
git diff --staged
```

### 3. Stage your changes

```powershell
# Stage everything (use this when you've reviewed the diff)
git add .

# Stage a specific file
git add src/app/login/page.tsx

# Stage a specific folder
git add src/components/chat/
```

### 4. Commit with a meaningful message

Follow this convention: `type: short description`

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behaviour change |
| `style` | CSS/visual changes only |
| `docs` | Documentation only |
| `chore` | Config, deps, build scripts |
| `test` | Test additions or fixes |

```powershell
git commit -m "feat: add forgot password flow to login page"
git commit -m "fix: google login redirect fallback for mobile"
git commit -m "chore: update .gitignore to exclude firebase credentials"
```

### 5. Push to GitHub (triggers Vercel deploy)

> ⚠️ **Review your commit one last time before pushing:**
>
> ```powershell
> git log --oneline -3          # What you're about to push
> git show --stat HEAD          # Files changed in the last commit
> ```

```powershell
# First push (sets upstream)
git push -u origin main

# Subsequent pushes
git push
```

---

## Security Checklist Before Every Push

Run this before `git push`:

```powershell
# Verify these are NOT staged or tracked:
git status | Select-String "\.env|firebase-adminsdk|google-services|service-account"
```

The output should be empty. If any of these appear, stop immediately and run:

```powershell
git reset HEAD <filename>   # Unstage
# Then add the filename to .gitignore
```

**Files that must NEVER be committed:**
- `.env`
- `.env.local`
- `.env.production`
- `companion-de741-firebase-adminsdk-*.json`
- `google-services*.json`
- Any file containing real API keys, passwords or private keys

---

## Branching (Optional — for larger features)

For bigger changes, work on a feature branch to keep `main` stable:

```powershell
# Create and switch to a new branch
git checkout -b feat/notification-system

# ... make changes, commit ...

# Push the branch
git push -u origin feat/notification-system

# When ready, merge back to main
git checkout main
git merge feat/notification-system
git push
```

---

## Vercel Deployment

Vercel automatically deploys whenever you push to `main`.

- **Production URL:** Check Vercel dashboard for your URL
- **Build logs:** Vercel Dashboard → Project → Deployments
- **Environment variables:** Vercel Dashboard → Project → Settings → Environment Variables

### Environment Variables on Vercel

Add every variable from `.env.example` to Vercel:

| Variable | Where to get it |
|----------|----------------|
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console → Project Settings → Web app |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → Web app |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console → Project Settings → Web app |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Project Settings → Web app |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console → Project Settings → Web app |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Console → Project Settings → Service Accounts |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin JSON → `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin JSON → `private_key` (keep `\n` escapes) |
| `GEMINI_API_KEY` | Google AI Studio → API Keys |

> **Important:** Add variables in Vercel UI, not via CLI. Set the scope to **Production** and **Preview**.

---

## Fixing the Google Login on Production

### In Firebase Console

1. Go to **Firebase Console** → your project → **Authentication** → **Settings** → **Authorised Domains**
2. Click **Add domain**
3. Add your Vercel domain, e.g. `companion-xyz.vercel.app`
4. Also add any custom domain if you have one

### In Google Cloud Console

1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Click your **OAuth 2.0 Client ID** (the one linked to Firebase)
3. Under **Authorised redirect URIs**, add:
   ```
   https://your-project-id.firebaseapp.com/__/auth/handler
   ```
   (Replace `your-project-id` with your actual Firebase project ID)
4. Save

> ℹ️ The `authDomain` in your `.env.local` must match exactly: `<project-id>.firebaseapp.com`

---

## Undoing Mistakes

```powershell
# Undo the last commit but keep your changes (safe)
git reset --soft HEAD~1

# Discard all unstaged changes (careful — this is permanent)
git checkout -- .

# See what commit history looks like
git log --oneline -10
```

> ❌ **NEVER use `git push --force` or `git push -f`** — it rewrites history on GitHub and can break Vercel deployments.

---

## Quick Reference

| Task | Command |
|------|---------|
| Check status | `git status` |
| See changes | `git diff` |
| Stage all | `git add .` |
| Commit | `git commit -m "type: message"` |
| Push | `git push` |
| Pull latest | `git pull` |
| View log | `git log --oneline -10` |
| View last commit | `git show --stat HEAD` |
