/** Shape attached to `request.user` by SessionAuthGuard once a session cookie resolves. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
  permissions: string[];
}
