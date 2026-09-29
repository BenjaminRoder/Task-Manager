import { TaskBoard } from "@/components/tasks/task-board";
export const metadata = { title: "Tasks" };
export default function TasksPage() {
  return <TaskBoard view="all" />;
}
