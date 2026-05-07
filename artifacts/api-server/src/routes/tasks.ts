import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, tasksTable, usersTable, projectsTable, projectMembersTable, activityLogsTable } from "@workspace/db";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  GetTaskParams,
  GetTaskResponse,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { requireAuth, syncUser } from "../lib/auth";

const router: IRouter = Router();

async function getTaskWithRelations(taskId: number) {
  const [task] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      createdByUserId: tasksTable.createdByUserId,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));

  if (!task) return null;

  const [assignee] = task.assigneeId
    ? await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId))
    : [null];

  const [project] = await db
    .select({ id: projectsTable.id, name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId));

  return { ...task, assignee: assignee ?? null, project: project ?? { id: task.projectId, name: "Unknown" } };
}

router.get("/tasks", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const queryParams = ListTasksQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { projectId, status, assigneeId } = queryParams.data;

  const userMemberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const accessibleProjectIds = userMemberships.map((m) => m.projectId);

  if (accessibleProjectIds.length === 0) {
    res.json([]);
    return;
  }

  let query = db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      createdByUserId: tasksTable.createdByUserId,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
      assigneeName: usersTable.name,
      assigneeClerkId: usersTable.clerkId,
      assigneeEmail: usersTable.email,
      assigneeAvatarUrl: usersTable.avatarUrl,
      assigneeCreatedAt: usersTable.createdAt,
      projectName: projectsTable.name,
    })
    .from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(sql`${tasksTable.projectId} = ANY(ARRAY[${sql.raw(accessibleProjectIds.join(","))}]::int[])`)
    .$dynamic();

  if (projectId) {
    query = query.where(eq(tasksTable.projectId, projectId));
  }
  if (status) {
    query = query.where(eq(tasksTable.status, status));
  }
  if (assigneeId) {
    query = query.where(eq(tasksTable.assigneeId, assigneeId));
  }

  const rows = await query.orderBy(tasksTable.createdAt);

  const tasks = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    projectId: row.projectId,
    assigneeId: row.assigneeId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignee: row.assigneeId && row.assigneeName ? {
      id: row.assigneeId,
      clerkId: row.assigneeClerkId!,
      name: row.assigneeName,
      email: row.assigneeEmail!,
      avatarUrl: row.assigneeAvatarUrl ?? null,
      createdAt: row.assigneeCreatedAt!,
    } : null,
    project: { id: row.projectId, name: row.projectName },
  }));

  res.json(ListTasksResponse.parse(tasks));
});

router.post("/tasks", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, parsed.data.projectId), eq(projectMembersTable.userId, user.id)));

  if (!membership) {
    res.status(403).json({ error: "You are not a member of this project" });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      ...parsed.data,
      status: parsed.data.status ?? "todo",
      priority: parsed.data.priority ?? "medium",
      createdByUserId: user.id,
    })
    .returning();

  await db.insert(activityLogsTable).values({
    taskId: task.id,
    userId: user.id,
    action: "created",
  });

  const full = await getTaskWithRelations(task.id);
  res.status(201).json(GetTaskResponse.parse(full));
});

router.get("/tasks/:id", requireAuth, syncUser, async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const task = await getTaskWithRelations(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(GetTaskResponse.parse(task));
});

router.patch("/tasks/:id", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, existing.projectId), eq(projectMembersTable.userId, user.id)));

  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (membership.role !== "admin" && existing.assigneeId !== user.id && existing.createdByUserId !== user.id) {
    res.status(403).json({ error: "Members can only update their own assigned tasks" });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(tasksTable)
    .set(parsed.data)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await db.insert(activityLogsTable).values({
      taskId: updated.id,
      userId: user.id,
      action: `status_changed_to_${parsed.data.status}`,
    });
  }

  const full = await getTaskWithRelations(updated.id);
  res.json(GetTaskResponse.parse(full));
});

router.delete("/tasks/:id", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [membership] = await db
    .select()
    .from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, existing.projectId), eq(projectMembersTable.userId, user.id)));

  if (!membership || membership.role !== "admin") {
    res.status(403).json({ error: "Admin access required to delete tasks" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
