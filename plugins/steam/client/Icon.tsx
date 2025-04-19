import * as React from "react";

type Props = {
  /** The size of the icon, 24px is default to match standard icons */
  size?: number;
  /** The color of the icon, defaults to the current text color */
  fill?: string;
  className?: string;
};

export default function SteamIcon({ size = 24, fill = "currentColor", className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5.34-2.64 2.04-4.93 4.41-6.16-1.97-.93-3.25-2.92-3.25-5.09 0-3.21 2.61-5.75 5.81-5.75 1.77 0 3.35.78 4.42 2.03A9.94 9.94 0 0 0 22 12c0 5.52-4.48 10-10 10-3.86 0-7.21-2.19-8.84-5.38L7.08 18c.43-.07.88-.12 1.34-.12 2.37 0 4.47 1.12 5.83 2.86A7.99 7.99 0 0 0 20 12c0-4.41-3.59-8-8-8z" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
    </svg>
  );
} 