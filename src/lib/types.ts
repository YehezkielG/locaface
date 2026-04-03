// types.ts
export interface SyncTimeResponse {
  server_time: number;
}

export interface AIPayload {
  latitude: number;
  longitude: number;
  image: string; // Base64 string
  [key: string]: any;
}