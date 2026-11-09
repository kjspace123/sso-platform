export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
  // Correlates this response with the server's structured logs for the same
  // request (see apps/api/src/logging) — worth surfacing to support/users
  // reporting an error, especially a 5xx.
  requestId?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
