import { MapPin } from "lucide-react";

export function MapPlaceholder() {
  return (
    <div className="absolute inset-0 w-full h-full bg-slate-100 flex items-center justify-center -z-10 overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      {/* Fake Map Elements */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
      
      {/* Roads (fake) */}
      <div className="absolute top-0 bottom-0 left-1/3 w-2 bg-white shadow-sm transform -skew-x-12"></div>
      <div className="absolute top-1/2 left-0 right-0 h-3 bg-white shadow-sm transform rotate-3"></div>
      <div className="absolute top-0 bottom-0 right-1/4 w-4 bg-white shadow-sm"></div>

      <div className="flex flex-col items-center gap-3 z-10 p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
          <MapPin className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-slate-800">Map Unavailable</h3>
          <p className="text-sm text-slate-500">Backend integration pending</p>
        </div>
      </div>
    </div>
  );
}
