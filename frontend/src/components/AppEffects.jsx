import { useEffect, useState } from "react";

export function CursorAura() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (prefersReducedMotion || !finePointer) return;
    setEnabled(true);
    const onMove = (event) =>
      setPosition({ x: event.clientX, y: event.clientY });
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        className={`cursor-aura ${pressed ? "pressed" : ""}`}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      />
      <div
        className="cursor-core"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      />
    </>
  );
}

export function ConfettiBurst() {
  const pieces = Array.from({ length: 20 }, (_, idx) => idx);
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece}
          className="confetti-piece"
          style={{
            left: `${(piece * 5) % 100}%`,
            animationDelay: `${(piece % 6) * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}
