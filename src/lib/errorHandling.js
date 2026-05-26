/**
 * Error Handling Utilities
 * Standardized error extraction and handling patterns.
 */

/**
 * Extract error message from various error types.
 */
export function extractErrorMessage(error, defaultMessage = 'An error occurred') {
  if (!error) return defaultMessage;
  
  // Base44 API error
  if (error && typeof error === 'object' && 'response' in error) {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
  }
  
  // Direct error message
  if (error instanceof Error) {
    return error.message;
  }
  
  // String error
  if (typeof error === 'string') {
    return error;
  }
  
  return defaultMessage;
}

/**
 * Check if error is unauthorized (401).
 */
export function isUnauthorizedError(error) {
  return error?.response?.status === 401;
}

/**
 * Check if error is forbidden (403).
 */
export function isForbiddenError(error) {
  return error?.response?.status === 403;
}

/**
 * Check if error is not found (404).
 */
export function isNotFoundError(error) {
  return error?.response?.status === 404;
}