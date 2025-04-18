import React from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Toast notification container that renders in the bottom-left corner by default
 * Used for displaying in-game toast messages via react-toastify
 */
const ToastOverlay: React.FC = () => {
  return (
    <div className="toast-container-wrapper" style={{ 
      position: 'fixed', 
      bottom: '20px', 
      left: '20px', 
      zIndex: 9999,
      pointerEvents: 'none' // Allow clicking through the container when no toasts are present
    }}>
      <ToastContainer
        position="bottom-left"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable={false}
        pauseOnHover
        theme="dark"
        style={{ 
          minWidth: '300px',
          fontFamily: 'Asul, sans-serif',
        }}
        toastClassName="ethyrial-toast" // Apply custom styling
        className="toast-body-container"
      />
    </div>
  );
};

// Add custom styles for the toasts
const addToastStyles = () => {
  // Check if the style element already exists
  if (document.getElementById('toast-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.innerHTML = `
    .ethyrial-toast {
      background-color: #38322c !important;
      color: #e0e0e0 !important;
      border: 1px solid #4e443a !important;
      border-radius: 4px !important;
      font-family: 'Asul', sans-serif !important;
      pointer-events: auto !important;
    }
    .ethyrial-toast.Toastify__toast--success {
      border-left: 4px solid #ffd5ae !important;
    }
    .ethyrial-toast.Toastify__toast--error {
      border-left: 4px solid #ff4545 !important;
    }
    .Toastify__close-button {
      color: #a0a0a0 !important;
    }
    .Toastify__close-button:hover {
      color: #ffd5ae !important;
    }
  `;
  document.head.appendChild(style);
};

// Add the custom styles when the component is loaded
if (typeof window !== 'undefined') {
  addToastStyles();
}

export default ToastOverlay; 