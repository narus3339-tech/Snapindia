import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
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
          <CardDescription>Welcome back to the celebration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
                data-testid="input-login-email"
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
                data-testid="input-login-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-snap text-white hover:opacity-90" 
              disabled={loading}
              data-testid="button-login-submit"
            >
              {loading ? "Signing in..." : "Log In"}
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
              data-testid="button-login-google"
            >
              Google
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline" data-testid="link-signup">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
