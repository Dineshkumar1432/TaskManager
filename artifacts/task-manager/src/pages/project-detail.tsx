import { useParams, Link } from "wouter";
import { useGetProject, useListTasks, useListProjectMembers } from "@workspace/api-client-react";

export default function ProjectDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data: project, isLoading: loadingProject } = useGetProject(id, { query: { enabled: !!id } });
  const { data: tasks, isLoading: loadingTasks } = useListTasks({ projectId: id }, { query: { enabled: !!id } });
  const { data: members, isLoading: loadingMembers } = useListProjectMembers(id, { query: { enabled: !!id } });

  if (loadingProject) return <div>Loading project...</div>;
  if (!project) return <div>Project not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground mt-2">{project.description}</p>
      </div>
      
      <div className="grid grid-cols-3 gap-8">
         <div className="col-span-2 space-y-4">
            <h2 className="font-semibold text-lg">Tasks</h2>
            <div className="border rounded-md divide-y">
               {tasks?.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground">No tasks yet</div>
               ) : (
                 tasks?.map(task => (
                   <div key={task.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                     <span className="font-medium">{task.title}</span>
                     <span className="text-sm border px-2 py-0.5 rounded text-muted-foreground">{task.status}</span>
                   </div>
                 ))
               )}
            </div>
         </div>
         <div className="space-y-4">
            <h2 className="font-semibold text-lg">Members</h2>
            <div className="border rounded-md divide-y">
               {members?.map(member => (
                 <div key={member.id} className="p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                       {member.user.name.charAt(0).toUpperCase()}
                     </div>
                     <span className="text-sm font-medium">{member.user.name}</span>
                   </div>
                   <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}