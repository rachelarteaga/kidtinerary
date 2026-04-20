import { redirect } from "next/navigation";

export default function SubmitPage() {
  redirect("/planner?hint=submit-deprecated");
}
