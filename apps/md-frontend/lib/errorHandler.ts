import { AxiosError } from "axios";
import { toast } from "sonner";

export interface ServerErrorResponse {
  timestamp: string; // ISO 8601 format
  status: number; // HTTP status code
  message: string; // Error message describing what went wrong
  traceId: string; // Unique identifier for backend log tracing
}

export const handleApiError = (error: unknown, action: string) => {
  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosError = error as AxiosError<ServerErrorResponse>;

    if (axiosError.response?.data) {
      const { message, traceId } = axiosError.response.data;

      toast.error(`Server error while ${action}.`, {
        description: `${message} (Trace ID: ${traceId})`,
        duration: 6000,
        closeButton: true,
      });

      console.error(`Server error while ${action}:`, error);
      return;
    }

    toast.error(`Network error while ${action}.`, {
      description: "Unable to connect to the server. Please check your internet connection.",
      duration: 6000,
      closeButton: true,
    });

    console.error(`Network error while ${action}:`, error);
  }
};
