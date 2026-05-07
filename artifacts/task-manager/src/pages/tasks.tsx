import { useListTasks, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks({});
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const handleStatusChange = (id: number, status: "todo" | "in_progress" | "done") => {
    updateTask.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({}) });
        }
      }
    );
  };

  if (isLoading) return <div>Loading tasks...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">All tasks across your projects</p>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks?.map(task => (
              <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{task.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{task.project.name}</td>
                <td className="px-4 py-3">
                  <Select value={task.status} onValueChange={(v: any) => handleStatusChange(task.id, v)}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    task.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                    task.priority === 'medium' ? 'bg-orange-500/10 text-orange-600' :
                    'bg-green-500/10 text-green-600'
                  }`}>
                    {task.priority}
                  </span>
                </td>
              </tr>
            ))}
            {tasks?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}