export interface LoginResponse {
  userId: string;
  name: string;
  roleName: string;
  accessToken: string;
  refreshToken: string;
}

export interface UserSession extends LoginResponse{
}