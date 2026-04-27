export interface HealthResponse {
  ok: boolean;
  service: string;
}

export async function fetchHealth(baseUrl = ''): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }
  return response.json() as Promise<HealthResponse>;
}
