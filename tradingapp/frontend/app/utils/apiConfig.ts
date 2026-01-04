/**
 * Dynamic API URL Configuration
 * 
 * This utility provides runtime detection of the correct API URL.
 * It solves the problem where NEXT_PUBLIC_API_URL is set to localhost
 * but the app is accessed remotely.
 * 
 * Priority:
 * 1. If NEXT_PUBLIC_API_URL is set and NOT localhost, use it
 * 2. Otherwise, derive API URL from the browser's current hostname
 */

// Backend port (should match docker-compose.yml)
const BACKEND_PORT = 4000;

/**
 * Get the API URL dynamically based on the current environment
 * This handles the case where NEXT_PUBLIC_API_URL is incorrectly set to localhost
 */
export function getApiUrl(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering - use env variable or default
    return process.env.NEXT_PUBLIC_API_URL || `http://localhost:${BACKEND_PORT}`;
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // If configured URL exists and is NOT localhost, use it
  if (configuredUrl && !isLocalhostUrl(configuredUrl)) {
    return configuredUrl;
  }

  // Otherwise, derive from current browser location
  const { protocol, hostname } = window.location;
  
  // Use the same hostname as the frontend, but with the backend port
  return `${protocol}//${hostname}:${BACKEND_PORT}`;
}

/**
 * Check if a URL is a localhost URL
 */
function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

/**
 * Hook-friendly API URL getter
 * Use this in components to get the API URL
 */
export function useApiUrl(): string {
  // In React components, this will be called client-side
  return getApiUrl();
}

// Export a constant for static contexts (will be evaluated at runtime in browser)
export const API_URL = typeof window !== 'undefined' ? getApiUrl() : (process.env.NEXT_PUBLIC_API_URL || `http://localhost:${BACKEND_PORT}`);


