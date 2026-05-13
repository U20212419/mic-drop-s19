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
  pages: {
    signIn: "/",
    error: "/auth-error",
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

          return {
            ...token,
            sub: discordProfile.id,
            role: res.data.role || "USER",
            status: res.data.status || "INACTIVE",
            host: res.data.host || false,
            accessToken: res.data.token,
            refreshToken: res.data.refreshToken,
            accessTokenExpires: Date.now() + 25 * 60 * 1000, // 30 minutes minus 5 minutes of margin to counter network delays
          };
        } catch (error: any) {
          console.error("Error on initial login:", error);
          return {
            ...token,
            role: "USER",
            status: "INACTIVE",
            host: false,
            error: "InitialLoginError",
          };
        }
      }

      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token; // Return existing token if it's still valid
      }

      if (!token.refreshToken) {
        return { ...token, error: "NoRefreshTokenError" };
      }

      // Token has expired, attempt to refresh it
      try {
        const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`, {
          refreshToken: token.refreshToken,
        });

        console.log("Token refreshed successfully:", res.data);

        return {
          ...token,
          accessToken: res.data.token,
          refreshToken: res.data.refreshToken,
          accessTokenExpires: Date.now() + 25 * 60 * 1000, // Extend access token expiry
        };
      } catch (error: any) {
        console.error("Error refreshing access token:", error.message);
        return {
          ...token,
          role: "USER",
          status: "INACTIVE",
          host: false,
          error: "RefreshAccessTokenError",
        }; // Invalidate token on refresh failure
      }
    },
    // Pass token data to the frontend session
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.sub as string;
        session.user.role = (token as any).role || "USER";
        session.user.status = (token as any).status || "INACTIVE";
        session.accessToken = (token as any).accessToken;
        session.user.host = (token as any).host || false;
        session.error = (token as any).error;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
