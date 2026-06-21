import CardBox from "@/app/components/shared/CardBox"
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";

const page = () => {
  const BCrumb = [
    {
      to: "/",
      title: "Home",
    },
    {
      title: "Icons",
    },
  ];
  return (
    <>
      <BreadcrumbComp title="Icons" items={BCrumb} />
      <CardBox>
        <div className="mt-6">
          <iframe
            src="https://icon-sets.iconify.design/tabler/"
            title="Inline Frame Example"
            width="100%"
            height="650"
          ></iframe>
        </div>
      </CardBox>
    </>
  )
}

export default page