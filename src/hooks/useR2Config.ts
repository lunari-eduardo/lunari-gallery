/**
 * Hook for R2/Cloudflare Worker configuration
 * Simple hook that provides the Worker URL for image operations
 */

// Worker URL for uploads and image serving
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://gallery-upload.eduardo22diehl.workers.dev';

export function useR2Config() {
  return {
    workerUrl: WORKER_URL,
    // Build URL to serve an image through the worker
    getImageUrl: (path: string | null | undefined): string => {
      if (!path) return '/placeholder.svg';
      return `${WORKER_URL}/image/${path}`;
    },
  };
}

// Direct exports for use outside of React components
export const getWorkerUrl = () => WORKER_URL;

export const buildImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/placeholder.svg';
  return `${WORKER_URL}/image/${path}`;
};
