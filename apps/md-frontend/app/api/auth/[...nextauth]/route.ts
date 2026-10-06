import axios from "axios";
import NextAuth, { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const pendingTokenRefreshes = new Map<string, Promise<any>>();

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  logger: {
    error(code, metadata) {
      console.error(`[NEXTAUTH_CRITICAL] Code: ${code} | Details: ${JSON.stringify(metadata)}`);
    },
  },
  providers: [
    // Provider for the main app
    DiscordProvider({
      id: "discord",
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      issuer: "https://discord.com",
      authorization: { params: { scope: "identify" } },
    }),
    // Provider for the judge app
    DiscordProvider({
      id: "discord-judge-app",
      name: "Discord (Judge App)",
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      issuer: "https://discord.com",
      authorization: { params: { scope: "identify" } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
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
          await axios.post(`${process.env.API_BASE_URL}/api/auth/verify`, {
            discordId: discordProfile.id,
            username: discordProfile.username,
            avatar: discordProfile.avatar,
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
          const res = await axios.post(`${process.env.API_BASE_URL}/api${endpoint}`, {
            discordId: discordProfile.id,
            username: discordProfile.username,
            avatar: discordProfile.avatar,
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

      const oldRefreshToken = token.refreshToken as string;

      // Token has expired, attempt to refresh it
      try {
        // If there isn't already a refresh in progress, start one
        if (!pendingTokenRefreshes.has(oldRefreshToken)) {
          const refreshPromise = axios
            .post(`${process.env.API_BASE_URL}/api/auth/refresh`, {
              refreshToken: oldRefreshToken,
            })
            .then((res) => res.data)
            .catch((error) => {
              // If the refresh fails, remove the pending promise to allow future attempts
              pendingTokenRefreshes.delete(oldRefreshToken);
              throw error;
            });

          pendingTokenRefreshes.set(oldRefreshToken, refreshPromise);

          // If the refresh is successful, remove the pending promise after a short delay to allow any simultaneous requests to use the same promise
          refreshPromise.then(() => {
            setTimeout(() => {
              pendingTokenRefreshes.delete(oldRefreshToken);
            }, 10000);
          });
        }

        // All the simultaneous/delayed requests of the same user will wait for the same refresh promise to resolve
        const refreshData = await pendingTokenRefreshes.get(oldRefreshToken);

        console.log("Token refreshed successfully for all concurrent requests.");

        return {
          ...token,
          accessToken: refreshData.token,
          refreshToken: refreshData.refreshToken,
          accessTokenExpires: Date.now() + 25 * 60 * 1000, // Extend access token expiry
          error: undefined, // Clear any previous errors
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
      if (token && (token as any).error) {
        (session as any).error = (token as any).error;
      }

      if (session.user) {
        session.user.discordId = token.sub as string;
        session.user.role = (token as any).role || "USER";
        session.user.status = (token as any).status || "INACTIVE";
        session.accessToken = (token as any).accessToken;
        session.user.host = (token as any).host || false;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
