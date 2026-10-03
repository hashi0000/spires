import React, { useEffect, useState } from "react";
import { formatCountdown } from "./shareLabels";

export function LiveCountdown({ deadlineAt, prefix }: { deadlineAt?: string; prefix?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!deadlineAt) return null;
  return (
    <p className="share-ops-countdown">
      {prefix ? `${prefix}: ` : ""}
      {formatCountdown(deadlineAt, now)}
    </p>
  );
}

export function OccupancyDots({ filled, total }: { filled: number; total: number }) {
  const safeTotal = Math.max(0, total);
  const safeFilled = Math.max(0, Math.min(filled, safeTotal));
  return (
    <p className="share-ops-dots" aria-hidden="true">
      {Array.from({ length: safeTotal }, (_, index) => (
        <span key={index} className={index < safeFilled ? "is-filled" : ""} />
      ))}
    </p>
  );
}
