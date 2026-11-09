export type ApplicationStatus = 'ACTIVE' | 'DISABLED';
export type ApplicationType = 'CONFIDENTIAL' | 'PUBLIC';

export interface PublicApplication {
  id: string;
  name: string;
  clientId: string;
  status: ApplicationStatus;
  type: ApplicationType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  createdAt: string;
  updatedAt: string;
}
