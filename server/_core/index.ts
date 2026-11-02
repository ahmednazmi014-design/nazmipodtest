import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext, getRequestUser } from "./context";
import { serveStatic, setupVite } from "./vite";
import { findDelivery, findUserById, readStore } from "../store";
import { createPodPdf } from "../pdf";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", service: "nazmi-pod", storage: "server-store" })
  );
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  app.get("/api/pod/:deliveryId.pdf", (req, res) => {
    const user = getRequestUser(req);
    const store = readStore();
    const delivery = findDelivery(req.params.deliveryId, store);
    if (!user) return res.status(401).json({ error: "Sign in required" });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (user.role === "Driver" && delivery.assignedDriverId !== user.id)
      return res
        .status(403)
        .json({ error: "You can only download your own POD" });
    const driver = delivery.assignedDriverId
      ? findUserById(delivery.assignedDriverId, store)
      : undefined;
    const pdf = createPodPdf(delivery, driver, store);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${delivery.id}.pdf"`,
      "Cache-Control": "no-store",
    });
    return res.send(pdf);
  });
  app.get("/api/tracker/:deliveryId", (req, res) => {
    const user = getRequestUser(req);
    const store = readStore();
    const delivery = findDelivery(req.params.deliveryId, store);
    if (!user) return res.status(401).json({ error: "Sign in required" });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (user.role === "Driver" && delivery.assignedDriverId !== user.id)
      return res
        .status(403)
        .json({ error: "You can only view your own tracker" });
    return res.json({
      deliveryId: delivery.id,
      status: delivery.status,
      gps: delivery.gps,
      trail: delivery.gpsTrail,
      updatedAt: delivery.updatedAt,
    });
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Server listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
