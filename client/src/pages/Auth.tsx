import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

const mobileSchema = z.object({
  mobile: z.string().min(10, "Enter a valid mobile number"),
});

const otpSchema = z.object({
  otp: z.string().length(4, "OTP must be 4 digits"),
});

const nameSchema = z.object({
  name: z.string().min(2, "Name is required"),
});

export default function Auth() {
  const [, setLocation] = useLocation();
  const { loginWithMobile, updateProfile } = useAuth();
  const [step, setStep] = useState<"role" | "mobile" | "otp" | "name">("role");
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [mobile, setMobile] = useState("");

  const mobileForm = useForm({
    resolver: zodResolver(mobileSchema),
    defaultValues: { mobile: "" },
  });

  const otpForm = useForm({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "1234" }, // Hardcoded as requested
  });

  const nameForm = useForm({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: "" },
  });

  const onRoleSelect = (selectedRole: "passenger" | "driver") => {
    setRole(selectedRole);
    setStep("mobile");
  }

  const onMobileSubmit = (data: { mobile: string }) => {
    setMobile(data.mobile);
    setStep("otp");
  };

  const onOtpSubmit = async (data: { otp: string }) => {
    try {
      const user = await loginWithMobile.mutateAsync({ mobile, otp: data.otp, role }); 
      
      // If user has no name, ask for it
      if (!user.name) {
          setStep("name");
          return;
      }

      if (role === "driver") {
          setLocation("/driver/home");
      } else {
          setLocation("/home");
      }
    } catch (e) {
      // Handled by query client
    }
  };

  const onNameSubmit = async (data: { name: string }) => {
    try {
        await updateProfile.mutateAsync({ name: data.name });
        if (role === "driver") {
            setLocation("/driver/home");
        } else {
            setLocation("/home");
        }
    } catch (e) {
        // Handled by query client
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col p-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto flex-1 flex flex-col pt-12"
      >
        <div className="mb-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {step === "role" ? "Choose your account" : step === "mobile" ? "Enter your mobile number" : step === "otp" ? "Enter the 4-digit code" : "What's your name?"}
            </h1>
            <p className="text-slate-500 font-medium">
              {step === "role" ? "Are you driving or riding today?" : step === "mobile" ? "We'll send you a code for verification" : step === "otp" ? `A code has been sent to ${mobile}` : "Let us know what to call you"}
            </p>
          </div>
          {step !== "role" && (
             <Button 
                variant="ghost" 
                className="text-slate-400 font-bold"
                onClick={() => setLocation(role === "driver" ? "/driver/home" : "/home")}
              >
                Skip
              </Button>
          )}
        </div>

        <div className="flex-1">
          {step === "role" ? (
             <div className="space-y-4">
                <Button 
                    variant="outline" 
                    className="w-full h-32 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 hover:border-black hover:bg-slate-50 transition-all group"
                    onClick={() => onRoleSelect("passenger")}
                >
                    <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <span className="text-xl font-bold">Passenger</span>
                </Button>
                <Button 
                    variant="outline" 
                    className="w-full h-32 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 hover:border-black hover:bg-slate-50 transition-all group"
                    onClick={() => onRoleSelect("driver")}
                >
                    <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <span className="text-xl font-bold">Driver</span>
                </Button>
             </div>
          ) : step === "mobile" ? (
            <Form {...mobileForm} key="mobile-form">
              <form onSubmit={mobileForm.handleSubmit(onMobileSubmit)} className="space-y-6">
                <FormField
                  control={mobileForm.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-900">+91</span>
                           <Input 
                            className="h-16 pl-14 bg-slate-50 border-slate-200 rounded-2xl text-lg font-bold focus:ring-2 focus:ring-black" 
                            placeholder="Mobile number" 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-16 bg-black text-white hover:bg-slate-900 rounded-2xl text-lg font-bold"
                >
                  Next
                </Button>
              </form>
            </Form>
          ) : step === "otp" ? (
            <Form {...otpForm} key="otp-form">
              <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <input type="password" className="hidden" autoComplete="off" />
                      <FormControl>
                        <Input 
                          className="h-16 bg-slate-50 border-slate-200 rounded-2xl text-center text-3xl font-bold tracking-widest focus:ring-2 focus:ring-black" 
                          placeholder="0000" 
                          maxLength={4}
                          autoComplete="off"
                          id="otp_input_safe"
                          type="tel"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-4">
                  <Button 
                    type="submit" 
                    className="w-full h-16 bg-black text-white hover:bg-slate-900 rounded-2xl text-lg font-bold"
                    disabled={loginWithMobile.isPending}
                  >
                    {loginWithMobile.isPending ? "Verifying..." : "Verify"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full h-14 text-slate-500 font-bold"
                    onClick={() => setStep("mobile")}
                  >
                    Change Number
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...nameForm} key="name-form">
                <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="space-y-6">
                  <FormField
                    control={nameForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                            <Input 
                              className="h-16 bg-slate-50 border-slate-200 rounded-2xl text-lg font-bold focus:ring-2 focus:ring-black px-6 text-slate-900 relative z-50" 
                              placeholder="Your Name" 
                              autoFocus
                              type="text"
                              {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full h-16 bg-black text-white hover:bg-slate-900 rounded-2xl text-lg font-bold"
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? "Saving..." : "Continue"}
                  </Button>
                </form>
            </Form>
          )}
        </div>

        <p className="text-[10px] text-slate-400 text-center pb-8">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
