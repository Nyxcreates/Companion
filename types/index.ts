// AppUser has been superseded by UserProfile in src/types/profile.ts,
// which matches the real MongoDB document shape returned by
// /api/user/profile. Kept here: the generic API envelope types shared
// across all routes.

export interface ApiError {
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}