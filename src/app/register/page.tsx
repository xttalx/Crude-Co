import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { RegisterForm } from "@/app/register/RegisterForm";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }
  return <RegisterForm />;
}
