import axios, { AxiosError } from "axios";
import { getSession, signOut } from "next-auth/react";
import { toast } from "sonner";

export interface ServerErrorResponse {
  timestamp: string; // ISO 8601 format
  status: number; // HTTP status code
  message: string; // Error message describing what went wrong
  traceId: string; // Unique identifier for backend log tracing
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    const session = await getSession();
    const token = session?.accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ServerErrorResponse>) => {
    if (error.response?.status === 401) {
      toast.error("Expired session.", {
        description: "Your session has expired. Please log in again.",
        duration: 6000,
        closeButton: true,
      });

      signOut({ callbackUrl: "/" });
      return Promise.reject(error);
    }

    if (error.response?.data) {
      const { message, traceId } = error.response.data;

      toast.error("Server error", {
        description: `${message} (Trace ID: ${traceId})`,
        duration: 6000,
        closeButton: true,
      });

      console.error(`Server error: ${message} (Trace ID: ${traceId})`);
    } else if (error.code === "ERR_NETWORK") {
      toast.error("Network error", {
        description: "Unable to connect to the server. Please check your internet connection.",
        duration: 6000,
        closeButton: true,
      });

      console.error("Network error:", error.message);
    } else {
      toast.error("An unexpected error occurred", {
        description: "An unexpected error occurred. Please try again later.",
        duration: 6000,
        closeButton: true,
      });

      console.error("Unexpected error:", error);
    }

    return Promise.reject(error);
  },
);

export default api;
