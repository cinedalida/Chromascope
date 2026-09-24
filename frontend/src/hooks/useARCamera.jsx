/**
 * useARCamera — FUTURE USE (ARTryOnPage → CameraFeed)
 *
 * Custom hook for managing the live camera stream lifecycle.
 * Exposes `cameraRef` (attach to <video> element) and `isReady` (stream state).
 * On mount, calls navigator.mediaDevices.getUserMedia(); cleans up on unmount.
 * Wire to CameraFeed component and AROverlayCanvas in ARTryOnPage.
 */
import { useState, useEffect, useRef } from "react";

export function useARCamera(enabled = true) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let stream = null;
    let isMounted = true;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) setError("Camera API is not supported in this browser or requires HTTPS.");
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        
        if (!isMounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = mediaStream;

        if (cameraRef.current) {
          cameraRef.current.srcObject = stream;
          // Some browsers need a slight delay or explicit play call
          try {
            await cameraRef.current.play();
            setIsReady(true);
          } catch (playErr) {
            console.error("Auto-play prevented or failed", playErr);
            // Even if it fails to auto-play, we set it ready so the user can interact
            setIsReady(true);
          }
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError(err.message || "Camera access denied");
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [enabled]);

  const enableMockCamera = () => {
    setError(null);
    setIsMock(true);
    setIsReady(true);
  };

  return { cameraRef, isReady, error, isMock, enableMockCamera };
}
