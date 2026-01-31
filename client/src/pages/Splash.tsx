import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function Splash() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (user) {
        setLocation("/home");
      } else {
        setLocation("/auth");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, isLoading, setLocation]);

  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 overflow-hidden relative">
      <div className="relative z-10">
        <div className="space-y-6 text-center">
          <h1 className="text-7xl font-bold text-white tracking-tighter italic">
            POOL
          </h1>
          <div className="flex justify-center gap-1">
             <div className="h-1.5 w-12 bg-white rounded-full"></div>
             <div className="h-1.5 w-1.5 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </div>
      
      {/* Subtle modern background detail */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_#ffffff_1px,_transparent_1px)] [background-size:24px_24px]"></div>
      </div>
    </div>
  );
}

