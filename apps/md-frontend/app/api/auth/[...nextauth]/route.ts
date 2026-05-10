import axios from "axios";
import NextAuth, { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  providers: [
    // Provider for the main app
    DiscordProvider({
      id: "discord",
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      authorization: { params: { scope: "identify" } },
    }),
    // Provider for the judge app
    DiscordProvider({
      id: "discord-judge-app",
      name: "Discord (Judge App)",
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      authorization: { params: { scope: "identify" } },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account && profile) {
        const discordProfile = profile as any;

        // Allow sign-in for judge applications without backend verification
        if (account.provider === "discord-judge-app") {
          return true;
        }

        // For the main app, verify the user with the backend API
        try {
          await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/verify`, {
            discordId: discordProfile.id,
            username: discordProfile.username,
          });

          // If verification is successful, allow sign-in
          return true;
        } catch (error: any) {
          if (error.response) {
            console.log(`Access denied by server: ${error.response.status}`);
          } else {
            console.error("Error connecting to server:", error.message);
          }

          return `/?error=AccessDenied`; // Redirect to login on verification failure
        }
      }
      return false; // Deny sign-in if account or profile is missing
    },
    // Token generation after successful sign-in
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as any;
        token.sub = discordProfile.id;

        const endpoint =
          account.provider === "discord-judge-app" ? "/auth/judge-app-login" : "/auth/verify";

        try {
          // Verify the user with the backend API and fetch their role
          const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
            discordId: discordProfile.id,
            username: discordProfile.username,
          });

          console.log("Server status:", res.status);
          console.log("Server response:", res.data);

          token.role = res.data.role || "USER"; // Default to USER role if not provided
          token.status = res.data.status || "INACTIVE"; // Default to INACTIVE if not provided
          token.accessToken = res.data.token;
        } catch (error: any) {
          console.error(`Error fetching user role: ${error.message}. Defaulting to USER role.`);
          token.role = "USER"; // Default to USER role on error
          token.status = "INACTIVE"; // Default to INACTIVE on error
        }
      }
      return token;
    },
    // Pass token data to the frontend session
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.sub as string;
        session.user.role = (token as any).role || "USER";
        session.user.status = (token as any).status || "INACTIVE";
        session.accessToken = (token as any).accessToken;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
