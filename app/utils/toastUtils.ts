import { toast, ToastOptions } from 'react-toastify';

// Default toast options
const defaultOptions: ToastOptions = {
  position: "bottom-left",
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: false,
  progress: undefined,
};

/**
 * Display an info toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showInfoToast = (message: string, options?: ToastOptions) => {
  toast.info(message, { ...defaultOptions, ...options });
};

/**
 * Display a success toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showSuccessToast = (message: string, options?: ToastOptions) => {
  toast.success(message, { ...defaultOptions, ...options });
};

/**
 * Display a warning toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showWarningToast = (message: string, options?: ToastOptions) => {
  toast.warning(message, { ...defaultOptions, ...options });
};

/**
 * Display an error toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showErrorToast = (message: string, options?: ToastOptions) => {
  toast.error(message, { ...defaultOptions, ...options });
};

/**
 * Display a generic toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showToast = (message: string, options?: ToastOptions) => {
  toast(message, { ...defaultOptions, ...options });
};

/**
 * Dismiss all currently active toast notifications
 */
export const dismissAllToasts = () => {
  toast.dismiss();
};

export const MapToasts = {
  info: showInfoToast,
  success: showSuccessToast,
  warning: showWarningToast,
  error: showErrorToast,
  show: showToast,
  dismiss: dismissAllToasts
};

export default MapToasts; 