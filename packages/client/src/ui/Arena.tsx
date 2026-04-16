import { forwardRef, useImperativeHandle, useRef } from "react";

export interface ArenaHandle {
  getCanvas(): HTMLCanvasElement | null;
}

export const Arena = forwardRef<ArenaHandle>(function Arena(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        border: "2px solid #3a3a6e",
        borderRadius: "4px",
        maxWidth: "100%",
        maxHeight: "100%",
      }}
    />
  );
});
