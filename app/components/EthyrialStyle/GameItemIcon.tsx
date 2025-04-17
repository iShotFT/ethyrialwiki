import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { cn } from '~/utils/twMerge';

// Helper to darken hex color (simple version)
function darkenHexColor(hex: string, percent: number): string {
  if (!hex || hex.length < 6 || hex.length > 7 || hex[0] !== '#') {
    return '#000000'; // Default dark color on invalid input
  }
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Darken by percentage
  const factor = 1 - percent / 100;
  r = Math.max(0, Math.floor(r * factor));
  g = Math.max(0, Math.floor(g * factor));
  b = Math.max(0, Math.floor(b * factor));

  // Convert back to hex
  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

// Remove rarityBackgrounds map
/*
const rarityBackgrounds: Record<string, string> = {
  // ...
};
*/

interface GameItemIconProps {
  iconId: string | null;
  // rarityId?: string | null; // Remove rarityId prop
  rarityColorHex?: string | null; // Add rarityColorHex prop
  rarityItemBackgroundColorHex?: string | null; // Add new prop for background color
  altText?: string;
  size?: 'sm' | 'md' | 'lg'; // Example sizes
  sizeMultiplier?: number; // Scale factor for icon size
  className?: string;
  isSelected?: boolean; // Add new prop to show selected state
}

const GameItemIcon: React.FC<GameItemIconProps> = ({
  iconId,
  // rarityId, // Remove rarityId
  rarityColorHex, // Add rarityColorHex
  rarityItemBackgroundColorHex, // New prop
  altText = "Game Item",
  size = 'md',
  sizeMultiplier = 1, // Default to no scaling
  className,
  isSelected = false, // Default to not selected
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!iconId) {
      setIsLoading(false);
      setError(true); // No ID provided
      return;
    }

    setIsLoading(true);
    setError(false);
    setImageUrl(`/api/game-data/icons/${iconId}`); // Set URL immediately

    // We don't need to explicitly fetch; the browser handles image loading.
    // We'll rely on the <img> tag's onLoad/onError handlers.

  }, [iconId]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError(true);
    console.error(`Failed to load image: /api/game-data/icons/${iconId}`);
  };

  // Determine background style based on hex color
  // Use itemBackgroundColorHex with fallback to colorHex
  const backgroundStyle: React.CSSProperties = {};
  const backgroundColorHex = rarityItemBackgroundColorHex || rarityColorHex;
  
  if (backgroundColorHex) {
    const darkerColor = darkenHexColor(backgroundColorHex, 53); // Darken by 53%
    // Vertical gradient: lighter top, darker bottom
    backgroundStyle.background = `linear-gradient(to bottom, ${backgroundColorHex} 0%, ${darkerColor} 100%)`;
  } else {
    backgroundStyle.backgroundColor = '#717171'; // Default gray background
  }

  // Size classes - base sizes
  const sizeClasses = {
    sm: { width: 32, height: 32, padding: 2 }, // ~32px
    md: { width: 40, height: 40, padding: 4 }, // ~40px
    lg: { width: 48, height: 48, padding: 4 }, // ~48px
  };
  
  // Get base size and apply multiplier
  const baseSize = sizeClasses[size] || sizeClasses['md'];
  const scaledSize = {
    width: baseSize.width * sizeMultiplier,
    height: baseSize.height * sizeMultiplier,
    padding: baseSize.padding * sizeMultiplier,
  };
  
  // Create inline style for size
  const sizeStyle: React.CSSProperties = {
    width: `${scaledSize.width}px`,
    height: `${scaledSize.height}px`,
    padding: `${scaledSize.padding}px`,
  };

  return (
    // Outermost container with border
    <div
      className={cn(
        "relative flex items-center justify-center border rounded-sm overflow-hidden",
        isSelected 
          ? "border-[#ffd5ae] border-2 ring-2 ring-[#ffd5ae]/30"
          : "border-[#1A1A1A]",
        className // Allow overrides
      )}
      style={{ ...backgroundStyle, ...sizeStyle }} // Apply background and size styles
    >
      {/* Inner slightly darker border effect (using inset shadow) */}
      <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.4)] rounded-sm pointer-events-none" />

      {/* Loading State - Ensure it fills the container for centering */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
        </div>
      )}

      {/* Image (hidden until loaded) */}
      {imageUrl && !error && (
        <img
          src={imageUrl}
          alt={altText}
          className={cn(
            "object-contain w-full h-full transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100" // Fade in on load
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy" // Add lazy loading
        />
      )}

      {/* Error State (Optional: display placeholder) */}
      {error && !isLoading && (
         <div className="w-full h-full bg-red-900/50" title="Error loading icon"></div> // Simple error indicator
      )}
    </div>
  );
};

export default GameItemIcon; 