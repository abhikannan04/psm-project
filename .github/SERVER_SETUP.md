# Auto-deploy to the server

Deploys are **button-only**: `git push` just saves your code on GitHub. When you click
**Actions -> Deploy to server -> Run workflow**, the server pulls the new code, runs `npm install`
(at low priority), rebuilds the frontend and restarts **only this app** in PM2.
Before touching anything it checks that `DEPLOY_DIR` is a real project folder and that every
`PM2_NAMES` entry runs from inside it, so other apps on the server are never affected.
Server-only files (`.env`, `appsettings.json`, `uploads/`, `node_modules/`) are never touched.

PM2 runs `backend/server.js`, which also serves `frontend/dist`. Database migrations are **not** run automatically; run `npx knex migrate:latest` in `backend\` yourself when you add one.

## One-time setup on the server

**1. Check the tools** (in a normal Command Prompt, as the Windows user that runs PM2):
```bat
git --version
node --version
pm2 list
```
All three must work. Install Git from https://git-scm.com if missing. Note the app's **name** in `pm2 list`.

**2. Install the GitHub runner**
1. On GitHub open **psm-project → Settings → Actions → Runners → New self-hosted runner → Windows**.
2. In PowerShell **as Administrator**, run the commands shown on that page, but use the folder `C:\actions-runner-psm-project` instead of `C:\actions-runner`.
   (Each project needs its own runner folder.)
3. When `config.cmd` asks:
   - runner group / name / labels / work folder → just press **Enter**
   - **"Would you like to run the runner as service? (Y/N)" → `Y`**
   - **"User account to use for the service" → the same Windows user that runs PM2** (e.g. `.\Administrator` or `BANAS\yourname`) and its password.
     This matters: PM2 only sees the apps of the user that started them.
4. Back on GitHub the runner should now show **Idle** (green).

**3. Set the repository variables**
GitHub → **psm-project → Settings → Secrets and variables → Actions → Variables tab → New repository variable**:

| Name | Value | Example |
|------|-------|---------|
| `DEPLOY_DIR` | The folder the app runs from on this server | `D:\Apps\psm-project` |
| `PM2_NAMES` | The app name(s) from `pm2 list`, comma-separated | `psm-backend` |
| `HEALTH_URL` | *(optional)* a URL that must answer after restart | `http://localhost:3000` |

**4. First deploy**
GitHub → **psm-project → Actions → Deploy to server → Run workflow**.
The first run backs up the current server folder to `<DEPLOY_DIR>_backup_<date>` (without `node_modules`)
and then replaces the code with the version from GitHub. Your `.env` and uploads stay.

## Daily use (on your PC)
```bash
git add -A
git commit -m "describe your change"
git push
```
Then, at a quiet time, deploy: **Actions -> Deploy to server -> Run workflow**.
Watch it there: green = live on the server, red = open the run to see which step failed
(the app keeps running the previous version if the build fails).

## Rollback
GitHub → Actions → open an older successful run → **Re-run all jobs** does *not* roll back (it deploys the latest `main`).
To undo a change: `git revert <commit>` on your PC and `git push`.
