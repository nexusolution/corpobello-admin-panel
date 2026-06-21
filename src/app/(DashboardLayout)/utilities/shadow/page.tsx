import CardBox from "@/app/components/shared/CardBox";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";

const page = () => {
  const BCrumb = [
    {
      to: "/",
      title: "Home",
    },
    {
      title: "Shadow",
    },
  ];
  return (
    <>
      <BreadcrumbComp title="Shadow" items={BCrumb} />
      <CardBox>
        <div>
          <div className="grid grid-cols-12 gap-30">
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-none bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                1
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                2
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-sm bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                3
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-md bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                4
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-lg bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                5
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-xl bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                6
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-2xl bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                7
              </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
              <div className="shadow-inner bg-primary rounded-xl h-32 text-center flex justify-center items-center text-white text-xl">
                8
              </div>
            </div>
          </div>
        </div>
      </CardBox>
    </>
  );
};

export default page;