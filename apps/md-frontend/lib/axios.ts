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

// Variables to control simultaneous token refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

// Variables for duplicate request prevention mechanism
const pendingRequests = new Map<string, Promise<any>>();
const getRequestKey = (config: any) => {
  if (!config) return "";
  return `${config.method}_${config.url}_${JSON.stringify(config.params || {})}`;
};

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.request.use(
  async (config) => {
    // If the token isn't in memory, we attempt to retrieve it from the session
    if (!api.defaults.headers.Authorization) {
      const session = await getSession();
      if (session?.accessToken) {
        // Set the default Authorization header for future requests and avoid multiple calls to getSession
        api.defaults.headers.Authorization = `Bearer ${session.accessToken}`;
      }
    }

    // Inject the token into the request headers if it's available
    if (api.defaults.headers.Authorization) {
      config.headers.Authorization = api.defaults.headers.Authorization;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    // Remove the request from the pendingRequests map once it's completed
    const requestKey = getRequestKey(response.config);
    setTimeout(() => {
      pendingRequests.delete(requestKey);
    }, 600); // Delay to ensure the request is fully processed before removing it from the map

    return response;
  },
  async (error: AxiosError<ServerErrorResponse>) => {
    const originalRequest = error.config as any;

    if (!originalRequest) return Promise.reject(error);

    const requestKey = getRequestKey(originalRequest);

    if (error.response?.status === 401 && !originalRequest._retry) {
      pendingRequests.delete(requestKey);

      // If the token is already being refreshed, queue the request and return a promise that resolves when the token is refreshed
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Calling getSession triggers the NextAuth JWT callback, which will attempt to refresh the token if it's expired
        const session = await getSession();

        // Check if session was successfully retrieved and doesn't contain an error
        if (
          session?.accessToken &&
          session.error !== "RefreshAccessTokenError" &&
          session.error !== "NoRefreshTokenError" &&
          session.error !== "InitialLoginError"
        ) {
          // Update the default headers for future requests
          api.defaults.headers.Authorization = `Bearer ${session.accessToken}`;

          // Update the original request's header and retry it
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;

          // Free the queue of failed requests and retry them with the new token
          processQueue(null, session.accessToken);
          isRefreshing = false;

          return api(originalRequest);
        } else {
          // Refresh failed
          throw new Error("Refresh token expired or invalid.");
        }
      } catch (refreshError) {
        // If the refresh fails, clear the queue and sign out the user
        processQueue(refreshError, null);
        isRefreshing = false;
        pendingRequests.clear();

        toast.error("Session expired.", {
          description: "Your session has expired. Please log in again.",
          duration: 6000,
          closeButton: true,
        });

        // Force logout and redirect to the home/login page, giving the user a chance to read the toast message first
        signOut({ redirect: false });

        setTimeout(() => {
          window.location.href = "/";
        }, 3000);

        return Promise.reject(error);
      }
    }

    // If the error is not a 401, or if the request has already been retried, handle it as a normal error
    pendingRequests.delete(requestKey);

    if (error.response?.data) {
      let errorData = error.response.data;

      if (errorData instanceof Blob) {
        try {
          const text = await errorData.text();
          errorData = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse error blob as JSON:", e);
        }
      }

      const { message, traceId } = errorData as ServerErrorResponse;

      toast.error("Server error.", {
        description: `${message} (Trace ID: ${traceId})`,
        duration: 6000,
        closeButton: true,
      });

      console.error(`Server error: ${message} (Trace ID: ${traceId})`);
    } else if (error.code === "ERR_NETWORK") {
      toast.error("Network error.", {
        description: "Unable to connect to the server. Please check your internet connection.",
        duration: 6000,
        closeButton: true,
      });

      console.error("Network error:", error.message);
    } else {
      // Only show unexpected errors that don't have a proper server response and aren't network errors
      if (error.response?.status !== 401) {
        toast.error("An unexpected error occurred.", {
          description: "An unexpected error occurred. Please try again later.",
          duration: 6000,
          closeButton: true,
        });
      }

      console.error("Unexpected error:", error);
    }

    return Promise.reject(error);
  },
);

// Interceptor to prevent duplicate requests
const originalRequestFunction = api.request;
api.request = function (config: any) {
  const requestKey = getRequestKey(config);

  // If a request with the same key is already pending, return the existing promise
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }

  const responsePromise = originalRequestFunction.call(this, config);

  // Only deduplicate GET requests to avoid issues with non-idempotent methods
  if (config.method?.toLowerCase() === "get") {
    pendingRequests.set(requestKey, responsePromise);
  }

  return responsePromise;
};

export default api;
