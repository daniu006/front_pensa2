export interface LoginResponse {
  userId: string;
  username: string;
  roleName: string;
  accessToken: string;
  refreshToken: string;
}

export interface UserSession extends LoginResponse{
}