import "dotenv/config";
import cors from "cors";
import session from "express-session";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { startAARScheduler } from "./aar-job";
import { startWeatherEngine } from "./weather-engine";

const app = express();
// Trust Render's TLS-terminating proxy so express-session emits the Secure cookie.
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CORS — allow Netlify frontend
const allowedOrigins = [
  "https://ornate-druid-2c73a1.netlify.app",
  "https://standingrockstewards.com",
  "https://app.standingrockstewards.com",
  "https://www.standingrockstewards.com",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  // Vite dev server — only in non-production
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:5173"] : []),
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Render health checks, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ─── Session middleware (v2 auth) ──────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || "srsc-v2-dev-secret-change-in-prod";
app.use(
  session({
    // In smoke-test mode (SMOKE_TEST=1), use an HTTP-safe cookie name and settings.
    // The __Host- prefix requires Secure=true which only works over HTTPS.
    name: process.env.SMOKE_TEST === "1" ? "srsc-v2-smoke" : "__Host-srsc-v2",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: process.env.SMOKE_TEST === "1",
    cookie: {
      httpOnly: true,
      // SameSite=None required for cross-origin cookie (client on different origin).
      // Secure must always be true when SameSite=None.
      // In smoke-test mode over HTTP, relax both constraints.
      secure: process.env.SMOKE_TEST !== "1",
      sameSite: process.env.SMOKE_TEST === "1" ? "lax" : "none",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    // Start the end-of-day AAR email scheduler
    startAARScheduler();
    // Start the Weather Auto-Response Engine
    startWeatherEngine();
    },
  );
})();
