
import React from "react";
import TasksAttention from "../components/dashboard/TasksAttention";
import { YearlyBreakup } from "../components/dashboard/YearlyBreakup";
import { MonthlyEarning } from "../components/dashboard/MonthlyEarning";
import { RecentTransaction } from "../components/dashboard/RecentTransaction";
import { ProductPerformance } from "../components/dashboard/ProductPerformance";
import { Footer } from "../components/dashboard/Footer";
import { BestSeller } from "../components/dashboard/BestSeller";
import TopCards from "../components/dashboard/TopCards";
import { WelcomeBanner } from "../components/dashboard/WelcomeBanner";
import QuickAccess from "../components/dashboard/QuickAccess";

const page = () => {
  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <TopCards />
        </div>
        <div className="col-span-12">
          <WelcomeBanner />
        </div>
        <div className="col-span-12">
          <QuickAccess />
        </div>
        <div className="lg:col-span-8 col-span-12">
          <TasksAttention />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12">
              <YearlyBreakup />
            </div>
            <div className="col-span-12">
              <MonthlyEarning />
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <RecentTransaction />
        </div>
        <div className="lg:col-span-8 col-span-12 flex">
          <ProductPerformance />
        </div>
        <div className="col-span-12">
          <BestSeller />
        </div>
        <div className="col-span-12">
          <Footer />
        </div>
      </div>
    </>
  );
};

export default page;
