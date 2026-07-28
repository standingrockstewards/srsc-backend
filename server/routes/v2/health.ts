import { Router } from "express";
import { checkDbConnection } from "../../db";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const connected = await checkDbConnection();
    return res.json({ ok: true, db: connected ? "connected" : "unreachable" });
  } catch (err: any) {
    return res.status(503).json({ ok: false, db: "error", message: err.message });
  }
});

export default router;
