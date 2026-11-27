import LoginForm from "@/features/auth/LoginForm";

export const metadata = { title: "Log in | Travel Platform" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <LoginForm returnTo={returnTo} />;
}