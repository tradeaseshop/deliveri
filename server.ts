import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import { startTradeEaseOutboxWorker } from './backend/tradeEaseIntegration';
import apiRouter from "./backend/index";


const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Lightweight dependency-free rate limiter for auth/webhook abuse protection.
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const key = `${req.ip}:${req.path}`; const now = Date.now(); const current = buckets.get(key);
    if (!current || current.reset <= now) buckets.set(key, { count: 1, reset: now + windowMs });
    else current.count += 1;
    const item = buckets.get(key)!;
    if (item.count > max) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    next();
  };
}


// Capture the exact raw request body alongside Express's parsed req.body.
// Webhook signatures must be verified against the exact bytes that were
// sent, not a re-serialized copy, so backend/routes/webhooks.ts reads
// (req as any).rawBody instead of re-stringifying req.body.
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req,res,next)=>{ const started=Date.now(); res.on('finish',()=>console.log(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now()-started}ms`)); next(); });
app.use(
  express.json({ limit: '8mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString("utf8");
    },
  })
);

app.use('/api/auth', rateLimit(30, 60_000));
app.use('/api/webhooks', rateLimit(120, 60_000));

// REST API: auth, drivers, admins, deliveries, earnings, notifications, and
// the inbound TradeEase fulfilment webhook. See backend/index.ts.
app.use("/api", apiRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Setup Vite & static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static product bundle from /dist.");
  }

  startTradeEaseOutboxWorker();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DELIVERI server running on http://localhost:${PORT}`);
  });
}

startServer();
