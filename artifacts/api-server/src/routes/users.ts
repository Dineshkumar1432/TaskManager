import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { GetMeResponse, UpdateMeBody, ListUsersResponse } from "@workspace/api-zod";
import { requireAuth, syncUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/users/me", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  res.json(GetMeResponse.parse(user));
});

router.patch("/users/me", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(GetMeResponse.parse(updated));
});

router.get("/users", requireAuth, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(ListUsersResponse.parse(users));
});

export default router;
