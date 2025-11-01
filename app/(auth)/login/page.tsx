"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";

export default function Page() {
  const router = useRouter();
  const [isSuccessful, setIsSuccessful] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSuccessful(true);
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Google sign in error:", error);
      toast({
        type: "error",
        description: "Failed to sign in with Google!",
      });
      setIsSuccessful(false);
    }
  };

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Sign in with your Google account to continue
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 sm:px-16">
          <SubmitButton
            isSuccessful={isSuccessful}
            onClick={handleGoogleSignIn}
            type="button"
          >
            Continue with Google
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}
