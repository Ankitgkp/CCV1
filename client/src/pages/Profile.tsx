import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, User, Mail, FileText, Camera, LogOut, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: [api.user.getProfile.path],
  });

  const updateProfile = useMutation({
    mutationFn: async (data: Partial<UserType>) => {
      const res = await apiRequest(api.user.updateProfile.method, api.user.getProfile.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.user.getProfile.path] });
      setIsEditing(false);
      toast({ title: "Profile updated" });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await apiRequest(api.auth.logout.method, api.auth.logout.path);
    },
    onSuccess: () => {
      setLocation("/auth");
      toast({ title: "Logged out" });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 bg-white border-b border-slate-100 sticky top-0 z-50">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full hover:bg-slate-100" 
          onClick={() => setLocation("/home")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Profile</h1>
      </header>

      <main className="flex-1 p-4 space-y-6 max-w-md mx-auto w-full">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-4">
          <div className="relative">
            <Avatar className="w-24 h-24 border-2 border-white shadow-md">
              <AvatarImage src={user?.avatar || ""} />
              <AvatarFallback className="bg-slate-900 text-white text-xl font-bold">
                {user?.name?.[0] || user?.mobile?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <Button size="icon" className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-white text-black border border-slate-200 shadow-sm hover:bg-slate-50">
              <Camera className="w-4 h-4" />
            </Button>
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.name || "Guest User"}</h2>
            <p className="text-slate-500 text-sm font-medium">{user?.mobile}</p>
          </div>
        </div>

        {/* Edit Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900">Personal Information</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 font-bold hover:bg-blue-50"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name</label>
              {isEditing ? (
                <Input 
                  defaultValue={user?.name || ""} 
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl"
                  onChange={(e) => (user!.name = e.target.value)}
                />
              ) : (
                <p className="font-medium text-slate-900">{user?.name || "Not set"}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</label>
              {isEditing ? (
                <Input 
                  defaultValue={user?.email || ""} 
                  className="h-11 bg-slate-50 border-slate-200 rounded-xl"
                  onChange={(e) => (user!.email = e.target.value)}
                />
              ) : (
                <p className="font-medium text-slate-900">{user?.email || "Not set"}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bio</label>
              {isEditing ? (
                <Textarea 
                  defaultValue={user?.bio || ""} 
                  className="bg-slate-50 border-slate-200 rounded-xl min-h-[80px]"
                  onChange={(e) => (user!.bio = e.target.value)}
                />
              ) : (
                <p className="font-medium text-slate-900">{user?.bio || "No bio added"}</p>
              )}
            </div>

            {isEditing && (
              <Button 
                className="w-full h-11 bg-black text-white rounded-xl font-bold mt-2"
                onClick={() => updateProfile.mutate(user!)}
                disabled={updateProfile.isPending}
              >
                Save Changes
              </Button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full h-14 border-slate-200 rounded-2xl justify-between px-6 font-bold text-slate-900 hover:bg-slate-50 group"
            onClick={() => setLocation("/history")}
          >
            Ride History
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-14 border-slate-200 rounded-2xl justify-between px-6 font-bold text-slate-900 hover:bg-slate-50 group"
          >
            Payment Methods
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
          </Button>
          <Button 
            variant="ghost" 
            className="w-full h-14 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl font-bold mt-4"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </div>
      </main>
    </div>
  );
}
