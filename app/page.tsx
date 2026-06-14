import Workspace from "@/components/Workspace";
import { getDraws, getTickets } from "@/lib/store";
import { generatePlan } from "@/lib/dlt";

export default async function Page() {
  const draws = await getDraws();
  const tickets = await getTickets();
  const initialPlan = generatePlan({ budget: 100, strategy: "balanced" });
  return <Workspace initialDraws={draws} initialTickets={tickets} initialPlan={initialPlan} />;
}
