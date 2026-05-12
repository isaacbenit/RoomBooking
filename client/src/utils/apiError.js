/**
 * Human-readable message from an axios/fetch-style error.
 */
export function getApiErrorMessage(err, fallback = "Something went wrong.") {
  const data = err?.response?.data;
  if (data && typeof data === "object" && typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }
  if (data && typeof data === "object" && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  const code = err?.code;
  if (code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Cannot reach the server. Check that the API is running and VITE_API_URL is correct.";
  }
  if (code === "ECONNABORTED") return "The request timed out. Try again.";

  if (err?.message && typeof err.message === "string") return err.message;
  return fallback;
}
