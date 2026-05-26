/**
 * Performance Utilities
 * Memoization helpers and performance optimization utilities.
 */

/**
 * Creates a memoized selector function.
 * Use for expensive computations that depend on multiple inputs.
 */
export function createMemoSelector(selectorFn) {
  let lastArgs = null;
  let lastResult = null;

  return function memoized(...args) {
    // Simple equality check for arguments
    const argsChanged = !lastArgs || 
      args.length !== lastArgs.length || 
      args.some((arg, i) => arg !== lastArgs[i]);

    if (argsChanged) {
      lastArgs = args;
      lastResult = selectorFn(...args);
    }

    return lastResult;
  };
}

/**
 * Debounce function for rate-limiting user actions.
 */
export function debounce(fn, delay = 300) {
  let timeoutId = null;
  
  return function debounced(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function for limiting execution frequency.
 */
export function throttle(fn, limit = 100) {
  let lastCall = 0;
  let timeoutId = null;

  return function throttled(...args) {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * Check if component should re-render based on shallow comparison.
 */
export function shallowEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  
  if (!obj1 || !obj2) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => obj1[key] === obj2[key]);
}

/**
 * Performance-safe array comparison for React deps.
 */
export function arrayEqual(arr1, arr2) {
  if (arr1 === arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  
  return arr1.every((item, i) => item === arr2[i]);
}