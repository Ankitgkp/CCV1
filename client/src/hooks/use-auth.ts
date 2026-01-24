import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

type MobileLoginInput = z.infer<typeof api.auth.loginWithMobile.input>;

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const userQuery = useQuery({
    queryKey: [api.user.getProfile.path],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", api.user.getProfile.path);
        return await res.json();
      } catch (e) {
        return null;
      }
    },
    retry: false,
  });

  const loginWithMobileMutation = useMutation({
    mutationFn: async (data: MobileLoginInput) => {
      const res = await apiRequest(api.auth.loginWithMobile.method, api.auth.loginWithMobile.path, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.user.getProfile.path], user);
      toast({
        title: "Welcome back!",
        description: `Logged in with ${user.mobile}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(api.auth.logout.method, api.auth.logout.path);
    },
    onSuccess: () => {
      queryClient.setQueryData([api.user.getProfile.path], null);
      toast({
        title: "Logged out",
        description: "See you soon!",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<typeof api.user.updateProfile.input._type>) => {
      const res = await apiRequest(api.user.updateProfile.method, api.user.updateProfile.path, data);
      if (!res.ok) {
        throw new Error("Failed to update profile");
      }
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.user.getProfile.path], user);
    },
  });

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    loginWithMobile: loginWithMobileMutation,
    logout: logoutMutation,
    updateProfile: updateProfileMutation,
  };
}
