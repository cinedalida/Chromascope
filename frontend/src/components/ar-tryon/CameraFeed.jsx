import { CameraOff } from "lucide-react";

/**
 * CameraFeed — FUTURE USE (ARTryOnPage)
 *
 * Renders the live device camera stream via MediaDevices API.
 * Used as the base layer inside ARTryOnPage alongside AROverlayCanvas.
 * Wire to useARCamera hook (cameraRef) for stream management and cleanup.
 */
export function CameraFeed({ cameraRef, isReady, error, isMock, onEnableMock }) {
  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden bg-slate-900">
      {error && !isMock ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15111C] p-8 text-center font-body">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[80px]" />
          
          <div className="relative z-10 flex flex-col items-center max-w-[280px]">
            <div className="mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
              <CameraOff size={28} strokeWidth={1.5} />
            </div>
            
            <h3 className="mb-2 font-heading text-xl font-bold text-white tracking-tight">Camera Unavailable</h3>
            <p className="mb-8 text-[13px] leading-relaxed text-white/50">
              {typeof error === 'string' ? error : "Please check your browser permissions to enable live AR scanning."}
            </p>
            
            <button 
              onClick={onEnableMock}
              className="group relative overflow-hidden rounded-full bg-white px-8 py-4 text-[11px] font-bold tracking-[0.2em] uppercase text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
            >
              <span className="relative z-10">Start Simulation</span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {isMock ? (
            <div 
              className={`absolute inset-0 h-full w-full bg-cover bg-center transition-opacity duration-700 ${
                isReady ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=800&h=1000')`,
                transform: "scaleX(-1)"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
            </div>
          ) : (
            <video
              ref={cameraRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover transition-opacity duration-700 ${
                isReady ? "opacity-100" : "opacity-0"
              }`}
              style={{ transform: "scaleX(-1)" }} // mirror front camera
            />
          )}
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
