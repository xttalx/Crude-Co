import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return <>{children}</>;
}
