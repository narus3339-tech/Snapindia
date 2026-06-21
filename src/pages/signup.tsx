import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Signup() {
  const { signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        username: email.split("@")[0],
        photoURL: "",
        bio: "",
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: new Date().toISOString()
      });

      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Google sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gradient-snap mb-2">SnapIndia</CardTitle>
          <CardDescription>Join the celebration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background/50"
                data-testid="input-signup-name"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
                data-testid="input-signup-email"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
                data-testid="input-signup-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-snap text-white hover:opacity-90" 
              disabled={loading}
              data-testid="button-signup-submit"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full mt-4" 
              onClick={handleGoogleLogin}
              data-testid="button-signup-google"
            >
              Google
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
