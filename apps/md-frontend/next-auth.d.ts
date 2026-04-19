import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  // Extending the built-in session user interface
  interface Session {
    user: {
      discordId: string;
      role: "ADMIN" | "STAFF" | "USER";
    } & DefaultSession["user"];
    accessToken?: string; // Optional access token for API requests
  }

  // Extending the built-in JWT interface
  interface JWT {
    role?: "ADMIN" | "STAFF" | "USER";
    accessToken?: string; // Optional access token for API requests
  }
}
