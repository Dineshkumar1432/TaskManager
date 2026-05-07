import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, projectsTable, projectMembersTable, usersTable } from "@workspace/db";
import {
  ListProjectsResponse,
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  ListProjectMembersParams,
  ListProjectMembersResponse,
  AddProjectMemberParams,
  AddProjectMemberBody,
  RemoveProjectMemberParams,
} from "@workspace/api-zod";
import { requireAuth, syncUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/projects", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const memberships = await db
    .select({
      project: projectsTable,
      role: projectMembersTable.role,
    })
    .from(projectMembersTable)
    .innerJoin(projectsTable, eq(projectMembersTable.projectId, projectsTable.id))
    .where(eq(projectMembersTable.userId, user.id));

  const projectIds = memberships.map((m) => m.project.id);

  const memberCounts = projectIds.length > 0 ? await db
    .select({ projectId: projectMembersTable.projectId, count: sql<number>`count(*)::int` })
    .from(projectMembersTable)
    .where(sql`${projectMembersTable.projectId} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]`)})`)
    .groupBy(projectMembersTable.projectId) : [];

  const taskCounts = projectIds.length > 0 ? await db
    .select({ projectId: sql<number>`project_id`, count: sql<number>`count(*)::int` })
    .from(sql`tasks`)
    .where(sql`project_id = ANY(ARRAY[${sql.raw(projectIds.join(","))}])`)
    .groupBy(sql`project_id`) : [];

  const memberCountMap = new Map(memberCounts.map((r) => [r.projectId, r.count]));
  const taskCountMap = new Map(taskCounts.map((r) => [r.projectId, r.count]));

  const projects = memberships.map((m) => ({
    ...m.project,
    memberCount: memberCountMap.get(m.project.id) ?? 0,
    taskCount: taskCountMap.get(m.project.id) ?? 0,
    myRole: m.role,
  }));

  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({ ...parsed.data, createdByUserId: user.id })
    .returning();

  await db.insert(projectMembersTable).values({
    projectId: project.id,
    userId: user.id,
    role: "admin",
  });

  const result = { ...project, memberCount: 1, taskCount: 0, myRole: "admin" };
  res.status(201).json(GetProjectResponse.parse(result));
});

router.get("/projects/:id", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, project.id), eq(projectMembersTable.userId, user.id)));

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.projectId, project.id));

  const [taskCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`tasks`)
    .where(sql`project_id = ${project.id}`);

  const result = {
    ...project,
    memberCount: memberCount?.count ?? 0,
    taskCount: taskCount?.count ?? 0,
    myRole: membership?.role ?? null,
  };

  res.json(GetProjectResponse.parse(result));
});

router.patch("/projects/:id", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, params.data.id), eq(projectMembersTable.userId, user.id)));

  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.projectId, updated.id));

  const [taskCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`tasks`)
    .where(sql`project_id = ${updated.id}`);

  const result = {
    ...updated,
    memberCount: memberCount?.count ?? 0,
    taskCount: taskCount?.count ?? 0,
    myRole: membership.role,
  };

  res.json(GetProjectResponse.parse(result));
});

router.delete("/projects/:id", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, params.data.id), eq(projectMembersTable.userId, user.id)));

  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/projects/:id/members", requireAuth, syncUser, async (req, res): Promise<void> => {
  const params = ListProjectMembersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const members = await db
    .select({
      id: projectMembersTable.id,
      projectId: projectMembersTable.projectId,
      userId: projectMembersTable.userId,
      role: projectMembersTable.role,
      joinedAt: projectMembersTable.joinedAt,
      user: {
        id: usersTable.id,
        clerkId: usersTable.clerkId,
        name: usersTable.name,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
      },
    })
    .from(projectMembersTable)
    .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
    .where(eq(projectMembersTable.projectId, params.data.id));

  res.json(ListProjectMembersResponse.parse(members));
});

router.post("/projects/:id/members", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = AddProjectMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, params.data.id), eq(projectMembersTable.userId, user.id)));

  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = AddProjectMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [newMember] = await db
    .insert(projectMembersTable)
    .values({ projectId: params.data.id, userId: parsed.data.userId, role: parsed.data.role })
    .returning();

  const [memberUser] = await db.select().from(usersTable).where(eq(usersTable.id, newMember.userId));

  const result = { ...newMember, user: memberUser };
  res.status(201).json(result);
});

router.delete("/projects/:id/members/:userId", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = RemoveProjectMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, params.data.id), eq(projectMembersTable.userId, user.id)));

  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  await db
    .delete(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, params.data.id), eq(projectMembersTable.userId, params.data.userId)));

  res.sendStatus(204);
});

export default router;
