# AI Revenue Recovery MVP

Implementation of the Razorpay Buildathon Track 03.

## Setup

```bash
npm install
npm run db:generate
npm run db:migrate
```

## Running (Development)

```bash
npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Running (Docker — Production)

### Quick start

```bash
# Build the image
docker build -t recovery-agent:latest .

# Run the container
docker run -d \
  --name recovery-agent \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DEMO_MODE=true \
  -e DATABASE_URL=/app/data/recovery.db \
  -v recovery-data:/app/data \
  recovery-agent:latest
```

The app serves both the API and the frontend on port 3000.

### With docker-compose

```bash
docker compose up -d
```

### Deploy to Render

Render supports Docker deployments with persistent disks — perfect for SQLite.

**Option 1: Blueprint (recommended)**

1. Push this repo to GitHub
2. Go to https://dashboard.render.com → New → Blueprint
3. Select your repo — Render will detect `render.yaml` automatically
4. Review the service config and click "Apply"
5. Set your secret environment variables in the Render dashboard:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `GEMINI_API_KEY`
   - `API_KEY`
   - `CORS_ORIGINS` (your Render URL, e.g. `https://ai-revenue-recovery.onrender.com`)
   - `DEMO_MODE` (set to `false` when going live)
6. Deploy — Render builds the Docker image and starts the container
7. Your app is live at `https://ai-revenue-recovery.onrender.com`

**Option 2: Manual**

1. Go to https://dashboard.render.com → New → Web Service
2. Connect your GitHub repo
3. Select "Docker" as the runtime
4. Add a persistent disk: mount path `/app/data`, size 1GB
5. Set environment variables (same as above)
6. Deploy

**After deployment:**

1. Your webhook URL is: `https://your-app.onrender.com/webhooks/razorpay`
2. Add this URL in Razorpay Dashboard → Settings → Webhooks
3. Subscribe to events: `payment.failed`, `payment.captured`, `payment.authorized`, `payment_link.paid`, `subscription.pending`, `subscription.halted`, `subscription.charged`
4. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET` in Render

### Production with live Razorpay

1. Set these environment variables (via `.env` file or `-e` flags):

```env
NODE_ENV=production
DEMO_MODE=false
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
GEMINI_API_KEY=xxxxx
GEMINI_MODEL=gemini-1.5-flash
API_KEY=your-frontend-api-key
CORS_ORIGINS=https://your-domain.com
```

2. Deploy the container to your hosting platform (Render, Railway, Fly.io, VPS, etc.)

3. Point your Razorpay webhook URL to:
```
https://your-domain.com/webhooks/razorpay
```

4. In the Razorpay dashboard, subscribe to these events:
   - `payment.failed`
   - `payment.captured`
   - `payment.authorized`
   - `payment_link.paid`
   - `subscription.pending`
   - `subscription.halted`
   - `subscription.charged`

5. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`

### Health checks

- `GET /health` — basic liveness
- `GET /ready` — readiness check

The Docker container includes a health check that polls `/health` every 30s.

## Verification

```bash
npm run typecheck   # TypeScript check
npm run build       # Full build (backend + frontend)
npm test            # Test suite (68 tests)
```

## Project Structure

```
packages/
  backend/          # Fastify API + domain logic + Drizzle ORM
  frontend/         # React + Vite dashboard
Dockerfile          # Single-container production build
docker-compose.yml  # Full-stack orchestration
```

See `project_state.md` for the complete project state reference.
