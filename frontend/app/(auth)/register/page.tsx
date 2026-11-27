import RegisterForm from "@/features/auth/RegisterForm";

export const metadata = { title: "Sign up | Travel Platform" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <RegisterForm returnTo={returnTo} />;
}