import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { performAnalysis } from "./geminiService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (_, res) => res.json({ status: "ok" }));

  // Main Analysis Endpoint
  app.post("/api/analyze", async (req, res) => {
    try {
      const result = await performAnalysis(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("[SERVER] Analysis Error:", error);
      res.status(500).json({ error: error.message || "Internal Analysis Failure" });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Match Report Engine Active: http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[SERVER] Critical Startup Error:", err);
  process.exit(1);
});
