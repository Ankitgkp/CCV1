import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Camera, 
  ChevronRight, 
  LogOut 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DriverProfile() {
  const [, setLocation] = useLocation();
  const { user, updateProfile: updateUserMutation, logout: logoutMutation } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    bio: user?.bio || ""
  });

  const handleSave = async () => {
    try {
      await updateUserMutation.mutateAsync({
        name: formData.name,
        email: formData.email,
        bio: formData.bio
      });
      setIsEditing(false);
      toast({ title: "Profile updated successfully" });
    } catch (error) {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => setLocation("/auth")
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/driver/home")}
          className="-ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-slate-800" />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6 max-w-lg mx-auto w-full">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center text-3xl font-bold text-white">
              {user?.name?.[0] || "D"}
            </div>
            <button className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-md border border-slate-100 hover:bg-slate-50 transition-colors">
              <Camera className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">{user?.name || "Driver"}</h2>
          <p className="text-slate-500 font-medium">{user?.mobile}</p>
        </div>

        {/* Personal Info Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Personal Information</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 font-bold hover:text-blue-700 hover:bg-blue-50"
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            >
              {isEditing ? "Save" : "Edit"}
            </Button>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Name</Label>
              {isEditing ? (
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="font-medium text-slate-900"
                />
              ) : (
                <p className="text-base font-medium text-slate-900">{user?.name || "Not set"}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</Label>
              {isEditing ? (
                <Input 
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="font-medium text-slate-900"
                />
              ) : (
                <p className="text-base font-medium text-slate-900">{user?.email || "Not set"}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bio</Label>
              {isEditing ? (
                <Input 
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  className="font-medium text-slate-900"
                />
              ) : (
                <p className="text-base font-medium text-slate-900">{user?.bio || "No bio added"}</p>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-4">
          <button 
            onClick={() => setLocation("/driver/history")}
            className="w-full bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors group"
          >
            <span className="font-bold text-slate-900">Ride History</span>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
          </button>
          
          <button className="w-full bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between hover:bg-slate-50 transition-colors group">
            <span className="font-bold text-slate-900">Payment Methods</span>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        {/* Logout */}
        <div className="mt-auto pt-6 text-center">
            <Button 
                variant="ghost" 
                className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold gap-2"
                onClick={handleLogout}
            >
                <LogOut className="w-4 h-4" />
                Logout
            </Button>
        </div>
      </div>
    </div>
  );
}
