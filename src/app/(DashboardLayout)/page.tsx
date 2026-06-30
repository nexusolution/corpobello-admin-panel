import TasksAttention from "../components/dashboard/TasksAttention";
import TopCards from "../components/dashboard/TopCards";
import { WelcomeBanner } from "../components/dashboard/WelcomeBanner";
import QuickAccess from "../components/dashboard/QuickAccess";
import AgendaDay from "../components/dashboard/AgendaDay";

const page = () => {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <TopCards />
      </div>
      <div className="col-span-12 lg:col-span-8">
        <WelcomeBanner />
      </div>
      <div className="col-span-12 lg:col-span-4">
        <QuickAccess />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <AgendaDay />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <TasksAttention />
      </div>
    </div>
  );
};

export default page;