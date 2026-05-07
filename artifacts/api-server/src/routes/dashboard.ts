import { Router, type IRouter } from "express";
import { eq, lt, sql } from "drizzle-orm";
import { db, tasksTable, usersTable, projectMembersTable, activityLogsTable, projectsTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentActivityResponse,
  GetOverdueTasksResponse,
} from "@workspace/api-zod";
import { requireAuth, syncUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const projectIds = memberships.map((m) => m.projectId);

  if (projectIds.length === 0) {
    res.json(GetDashboardStatsResponse.parse({
      totalTasks: 0,
      tasksByStatus: { todo: 0, in_progress: 0, done: 0 },
      tasksByUser: [],
      overdueCount: 0,
      totalProjects: 0,
      myTaskCount: 0,
    }));
    return;
  }

  const projectIdsArray = `ARRAY[${projectIds.join(",")}]::int[]`;

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)})`);

  const statusCounts = await db
    .select({ status: tasksTable.status, count: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)})`)
    .groupBy(tasksTable.status);

  const tasksByStatus = { todo: 0, in_progress: 0, done: 0 };
  for (const row of statusCounts) {
    if (row.status === "todo") tasksByStatus.todo = row.count;
    else if (row.status === "in_progress") tasksByStatus.in_progress = row.count;
    else if (row.status === "done") tasksByStatus.done = row.count;
  }

  const userTaskCounts = await db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      taskCount: sql<number>`count(${tasksTable.id})::int`,
    })
    .from(tasksTable)
    .innerJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)})`)
    .groupBy(usersTable.id, usersTable.name)
    .orderBy(sql`count(${tasksTable.id}) desc`)
    .limit(10);

  const now = new Date();
  const [overdueResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)}) AND ${tasksTable.dueDate} < ${now} AND ${tasksTable.status} != 'done'`);

  const [myTaskResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)}) AND ${tasksTable.assigneeId} = ${user.id}`);

  res.json(GetDashboardStatsResponse.parse({
    totalTasks: totalResult?.count ?? 0,
    tasksByStatus,
    tasksByUser: userTaskCounts,
    overdueCount: overdueResult?.count ?? 0,
    totalProjects: projectIds.length,
    myTaskCount: myTaskResult?.count ?? 0,
  }));
});

router.get("/dashboard/activity", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const projectIds = memberships.map((m) => m.projectId);

  if (projectIds.length === 0) {
    res.json([]);
    return;
  }

  const projectIdsArray = `ARRAY[${projectIds.join(",")}]::int[]`;

  const activities = await db
    .select({
      id: activityLogsTable.id,
      taskId: activityLogsTable.taskId,
      taskTitle: tasksTable.title,
      action: activityLogsTable.action,
      actorName: usersTable.name,
      projectName: projectsTable.name,
      createdAt: activityLogsTable.createdAt,
    })
    .from(activityLogsTable)
    .innerJoin(tasksTable, eq(activityLogsTable.taskId, tasksTable.id))
    .innerJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
    .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)})`)
    .orderBy(sql`${activityLogsTable.createdAt} desc`)
    .limit(20);

  res.json(GetRecentActivityResponse.parse(activities));
});

router.get("/dashboard/overdue", requireAuth, syncUser, async (req, res): Promise<void> => {
  const user = (req as any).user;

  const memberships = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, user.id));

  const projectIds = memberships.map((m) => m.projectId);

  if (projectIds.length === 0) {
    res.json([]);
    return;
  }

  const projectIdsArray = `ARRAY[${projectIds.join(",")}]::int[]`;
  const now = new Date();

  const rows = await db
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
    .where(sql`${tasksTable.projectId} = ANY(${sql.raw(projectIdsArray)}) AND ${tasksTable.dueDate} < ${now} AND ${tasksTable.status} != 'done'`)
    .orderBy(tasksTable.dueDate)
    .limit(20);

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

  res.json(GetOverdueTasksResponse.parse(tasks));
});

export default router;
