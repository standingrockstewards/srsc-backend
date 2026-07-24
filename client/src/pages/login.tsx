import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";
import logoLight from "@assets/logo-light.png";

export default function LoginPage() {
  const { login, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    const dest = (user.role === "admin" || user.role === "supervisor") ? "/dashboard"
      : user.role === "field_tech" ? "/tech"
      : "/portal";
    setLocation(dest);
    return null;
  }

  const doLogin = async (u: string, p: string) => {
    setIsLoading(true);
    try {
      await login(u, p);
      // after login, user state updates and this component re-renders with redirect above
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(username, password);
  };

  const demoLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    await doLogin(u, p);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — brand (charcoal background) */}
      <div
        className="text-white flex flex-col justify-center items-center p-10 md:w-1/2 min-h-[280px] md:min-h-screen relative overflow-hidden"
        style={{ backgroundColor: '#1C1C1C' }}
      >
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #A0432F 0, #A0432F 1px, transparent 0, transparent 50%)',
          backgroundSize: '12px 12px'
        }} />

        {/* Red clay accent bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: '#A0432F' }} />

        <div className="relative z-10 text-center max-w-xs">
          {/* Real logo */}
          <div className="flex justify-center mb-6">
            <img
              src={logoLight}
              alt="Standing Rock Stewardship Co."
              style={{ height: '96px', width: 'auto' }}
            />
          </div>

          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-serif)', color: '#F5F0EA' }}
          >
            Standing Rock
          </h1>
          <p className="text-xl font-semibold mb-4" style={{ color: '#A0432F' }}>
            Stewardship Co.
          </p>

          <div className="border-t border-white/10 pt-4 mt-2">
            <p
              className="text-base font-bold leading-snug"
              style={{ color: '#F5F0EA', fontFamily: 'var(--font-serif)' }}
            >
              "We stand watch.<br />Your investment stands firm."
            </p>
          </div>

          <p className="text-sm mt-5" style={{ color: 'rgba(245,240,234,0.55)' }}>
            Lake Eufaula, Oklahoma
          </p>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
              style={{ color: 'rgba(245,240,234,0.45)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Website
            </Link>
          </div>
        </div>
      </div>

      {/* Right panel — login form (cream background) */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <h2
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-serif)', color: '#1C1C1C' }}
          >
            Sign In
          </h2>
          <p className="text-muted-foreground text-base mb-8">
            Access your Standing Rock portal
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="username" className="text-base font-medium">Username</Label>
              <Input
                id="username"
                data-testid="input-username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                className="mt-1 text-base h-12"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-base font-medium">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="text-base h-12 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  style={{ minHeight: 'unset' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: '#A0432F', color: '#F5F0EA' }}
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Demo logins */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-3 text-center font-medium">Demo Accounts</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-sm h-10"
                onClick={() => demoLogin("admin", "admin123")}
                data-testid="button-demo-admin"
              >
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-sm h-10"
                onClick={() => demoLogin("jake", "jake123")}
                data-testid="button-demo-tech"
              >
                Field Tech
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-sm h-10"
                onClick={() => demoLogin("jsmith", "client123")}
                data-testid="button-demo-client"
              >
                Client
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-8">
            (918) 707-2228 · standingrockstewards.com
          </p>

          <div className="text-center mt-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Back to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
