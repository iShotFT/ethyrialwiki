import { toast, ToastOptions, cssTransition } from 'react-toastify';
import React from 'react';
import IngameBorderedDiv from '~/components/EthyrialStyle/IngameBorderedDiv';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faCheckCircle, faExclamationTriangle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// Define custom ethyrial toast transition
export const ethyrialToastTransition = cssTransition({
  enter: 'ethyrial-toast-enter',
  exit: 'ethyrial-toast-exit',
  appendPosition: false,
  collapse: true,
  collapseDuration: 300,
});

// Define the basic toast container component
interface EthyrialToastProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string;
  icon?: React.ReactNode;
}

export const EthyrialToastContent: React.FC<EthyrialToastProps> = ({ type = 'info', message, icon }) => {
  // Get icon based on type if not provided
  let iconToUse: IconDefinition;
  let iconColor: string;
  
  switch(type) {
    case 'success':
      iconToUse = faCheckCircle;
      iconColor = '#ffd5ae'; // Gold for success
      break;
    case 'warning':
      iconToUse = faExclamationTriangle;
      iconColor = '#ffa500'; // Orange for warning
      break;
    case 'error':
      iconToUse = faTimesCircle;
      iconColor = '#ff4545'; // Red for error
      break;
    case 'info':
    default:
      iconToUse = faInfoCircle;
      iconColor = '#a0a0a0'; // Gray for info
      break;
  }

  return (
    <div className="ethyrial-toast-wrapper">
      <IngameBorderedDiv noPadding={false} className="w-full">
        <div className="flex items-center min-w-[250px]">
          <div className="mr-3 text-lg" style={{ color: iconColor }}>
            {icon || <FontAwesomeIcon icon={iconToUse} />}
          </div>
          <div className="text-sm font-asul text-gray-100 flex-1">
            {message}
          </div>
        </div>
      </IngameBorderedDiv>
    </div>
  );
};

// Default toast options
const defaultOptions: ToastOptions = {
  position: "bottom-left",
  autoClose: 5000,
  hideProgressBar: true, // Hide the green progress bar
  closeOnClick: true,
  pauseOnHover: true,
  draggable: false,
  progress: undefined,
  transition: ethyrialToastTransition,
  className: 'ethyrial-toast',
  bodyClassName: 'ethyrial-toast-body',
  icon: false, // Disable default icon
};

// Add custom CSS to the document head
const addToastStyles = () => {
  if (typeof document === 'undefined') return;
  
  if (!document.getElementById('ethyrial-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'ethyrial-toast-styles';
    style.textContent = `
      .ethyrial-toast-enter {
        opacity: 0;
        transform: translateX(-20px);
      }
      .ethyrial-toast-enter-active {
        opacity: 1;
        transform: translateX(0);
        transition: opacity 300ms, transform 300ms;
      }
      .ethyrial-toast-exit {
        opacity: 1;
        transform: translateX(0);
      }
      .ethyrial-toast-exit-active {
        opacity: 0;
        transform: translateX(-20px);
        transition: opacity 300ms, transform 300ms;
      }
      .ethyrial-toast {
        padding: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        backdrop-filter: blur(0) !important;
        font-family: 'Asul', sans-serif !important;
      }
      .ethyrial-toast-body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .Toastify__close-button {
        position: absolute;
        top: 8px;
        right: 12px;
        color: #a0a0a0 !important;
        opacity: 0.6;
      }
      .Toastify__close-button:hover {
        color: #ffd5ae !important;
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }
};

// Apply the styles on module load
if (typeof document !== 'undefined') {
  addToastStyles();
}

/**
 * Display an info toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showInfoToast = (message: string, options?: ToastOptions) => {
  toast(
    <EthyrialToastContent type="info" message={message} icon={options?.icon} />,
    { ...defaultOptions, ...options }
  );
};

/**
 * Display a success toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showSuccessToast = (message: string, options?: ToastOptions) => {
  toast(
    <EthyrialToastContent type="success" message={message} icon={options?.icon} />,
    { ...defaultOptions, ...options }
  );
};

/**
 * Display a warning toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showWarningToast = (message: string, options?: ToastOptions) => {
  toast(
    <EthyrialToastContent type="warning" message={message} icon={options?.icon} />,
    { ...defaultOptions, ...options }
  );
};

/**
 * Display an error toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showErrorToast = (message: string, options?: ToastOptions) => {
  toast(
    <EthyrialToastContent type="error" message={message} icon={options?.icon} />,
    { ...defaultOptions, ...options }
  );
};

/**
 * Display a generic toast notification
 * @param message The message to display
 * @param options Optional toast configuration options
 */
export const showToast = (message: string, options?: ToastOptions) => {
  toast(
    <EthyrialToastContent message={message} icon={options?.icon} />,
    { ...defaultOptions, ...options }
  );
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