import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkId = clerkId;
  next();
};

export const syncUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  if (!user) {
    const clerkUser = auth as any;
    const name = clerkUser?.sessionClaims?.name as string || clerkUser?.sessionClaims?.email as string || "User";
    const email = clerkUser?.sessionClaims?.email as string || `${clerkId}@unknown.com`;
    [user] = await db.insert(usersTable).values({ clerkId, name, email }).returning();
  }

  (req as any).user = user;
  next();
};
