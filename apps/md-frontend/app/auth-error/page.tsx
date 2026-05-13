import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function AuthErrorPage() {
  const cookieStore = await cookies();

  // NextAuth sets the callback URL in a cookie named "next-auth.callback-url"
  // (or "__Secure-next-auth.callback-url" in production with secure cookies)
  const callbackUrl =
    cookieStore.get("next-auth.callback-url")?.value ||
    cookieStore.get("__Secure-next-auth.callback-url")?.value ||
    "";

  // If the callback URL contains "/judge-app", it means the error came from the judge application page, so we redirect there
  if (callbackUrl.includes("/judge-app")) {
    redirect("/judge-app");
  }

  // Otherwise (it came from the main app), we redirect to the home page
  redirect("/");
}
