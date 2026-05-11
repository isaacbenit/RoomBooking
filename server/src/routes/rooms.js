import express from "express";
import { pool } from "../db.js";
import { badRequest } from "../utils.js";

export const roomsRouter = express.Router();

function requireAdminInRouter(req, res, next) {
  if (req.user?.role !== "Admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

roomsRouter.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "select id, name, description, created_at from rooms order by id asc"
    );
    return res.json({ rooms: rows });
  } catch {
    return res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

roomsRouter.post("/", requireAdminInRouter, async (req, res) => {
  const { name, description } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2)
    return badRequest(res, "Room name is required");
  if (typeof description !== "string" || description.trim().length < 5)
    return badRequest(res, "Room description is required");

  try {
    const { rows } = await pool.query(
      "insert into rooms (name, description) values ($1, $2) returning id, name, description, created_at",
      [name.trim(), description.trim()]
    );
    return res.status(201).json({ room: rows[0] });
  } catch (e) {
    if (String(e?.message || "").includes("rooms_name_key")) {
      return res.status(409).json({ error: "Room name already exists" });
    }
    return res.status(500).json({ error: "Failed to create room" });
  }
});

roomsRouter.patch("/:id", requireAdminInRouter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid room id");

  const { name, description } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2)
    return badRequest(res, "Room name is required");
  if (typeof description !== "string" || description.trim().length < 5)
    return badRequest(res, "Room description is required");

  try {
    const { rows, rowCount } = await pool.query(
      "update rooms set name = $1, description = $2 where id = $3 returning id, name, description, created_at",
      [name.trim(), description.trim(), id]
    );
    if (!rowCount) return res.status(404).json({ error: "Room not found" });
    return res.json({ room: rows[0] });
  } catch (e) {
    if (
      e?.code === "23505" &&
      (e?.constraint === "rooms_name_key" ||
        String(e?.message || "").toLowerCase().includes("rooms_name_key") ||
        String(e?.detail || "").toLowerCase().includes("name"))
    ) {
      return res.status(409).json({ error: "Room name already exists" });
    }
    return res.status(500).json({ error: "Failed to update room" });
  }
});

roomsRouter.delete("/:id", requireAdminInRouter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return badRequest(res, "Invalid room id");

  try {
    const { rowCount } = await pool.query("delete from rooms where id = $1", [id]);
    if (!rowCount) return res.status(404).json({ error: "Room not found" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to delete room" });
  }
});

