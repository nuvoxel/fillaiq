"use client";

interface ProgressRingProps {
  readonly value: number;
  readonly size?: number;
  readonly strokeWidth?: number;
}

export function ProgressRing({ value, size = 192, strokeWidth = 8 }: ProgressRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  const color =
    value > 50 ? "#00D2FF" : value > 20 ? "#FF7A00" : "#FF2A5F";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="#F4F6F8"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display font-bold text-[2.75rem] leading-none text-foreground">
          {value}%
        </span>
        <span className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground mt-1">
          Remaining
        </span>
      </div>
    </div>
  );
}
