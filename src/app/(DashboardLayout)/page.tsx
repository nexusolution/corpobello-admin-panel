import RoleDashboard from "../components/dashboard/RoleDashboard";

// The dashboard is reprioritised per role (Andrés point #5). RoleDashboard
// reads the signed-in user's role and arranges the cards accordingly.
const page = () => {
  return <RoleDashboard />;
};

export default page;
