import { useQuery } from '@tanstack/react-query';

const SUPABASE_URL = 'https://tlnjspsywycbudhewsfv.supabase.co';

export interface B2Config {
  downloadUrl: string;
  bucketName: string;
  fullBucketUrl: string;
}

/**
 * Hook to fetch B2 configuration from the backend.
 * The downloadUrl is resolved dynamically via the authorize_account API.
 * This ensures we never hardcode B2 shards (f002, f005, etc).
 */
export function useB2Config() {
  return useQuery<B2Config>({
    queryKey: ['b2-config'],
    queryFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-b2-config`);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to fetch B2 config');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour - downloadUrl is stable
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    retry: 3,
    refetchOnWindowFocus: false,
  });
}
