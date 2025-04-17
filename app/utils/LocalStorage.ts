/**
 * Utility for interacting with localStorage safely
 */
const LocalStorage = {
  /**
   * Get an item from localStorage with error handling
   * @param key The key to retrieve
   * @returns The stored value or null if not found
   */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error(`Error getting localStorage item '${key}':`, e);
      return null;
    }
  },

  /**
   * Set an item in localStorage with error handling
   * @param key The key to set
   * @param value The value to store
   * @returns Whether the operation was successful
   */
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error(`Error setting localStorage item '${key}':`, e);
      return false;
    }
  },

  /**
   * Remove an item from localStorage with error handling
   * @param key The key to remove
   * @returns Whether the operation was successful
   */
  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`Error removing localStorage item '${key}':`, e);
      return false;
    }
  },

  /**
   * Clear all items from localStorage with error handling
   * @returns Whether the operation was successful
   */
  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.error('Error clearing localStorage:', e);
      return false;
    }
  }
};

export default LocalStorage; 