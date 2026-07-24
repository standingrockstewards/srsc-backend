/**
 * Public Self Sign-Up Page
 * Prospect creates account → status=pending → Admin activates
 */
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import logoLight from "@assets/logo-light.png";

const TERRACOTTA = "#C05A43";
const CREAM = "#F5F0EA";
const CHARCOAL = "#1C1C1C";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";

export default function SignUpPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const refCode = new URLSearchParams(search).get("ref") ?? "";

  const [form, setForm] = useState({ name: "", email: "", phone: "", username: "", password: "", confirmPassword: "", referralCode: refCode });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/signup", {
        name: form.name, email: form.email, phone: form.phone,
        username: form.username, password: form.password,
        referralCode: form.referralCode || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Sign-up failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: CHARCOAL }}>
        <div className="w-full max-w-md text-center">
          <CheckCircle2 size={64} style={{ color: "#7A8C6E", margin: "0 auto 20px" }} />
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: SERIF, color: CREAM }}>
            Application Submitted
          </h2>
          <p className="text-base mb-6" style={{ color: "rgba(245,240,234,0.7)", fontFamily: SANS }}>
            Your account is pending review. Our team will activate your portal and reach out within 1–2 business days.
          </p>
          <p className="text-sm mb-8" style={{ color: "rgba(245,240,234,0.5)", fontFamily: SANS }}>
            Questions? Call us at <strong style={{ color: CREAM }}>(918) 707-2228</strong>
          </p>
          <Button
            onClick={() => setLocation("/login")}
            style={{ backgroundColor: TERRACOTTA, color: CREAM, fontFamily: SANS }}
            className="h-12 px-8 text-base font-semibold"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left brand panel */}
      <div
        className="text-white flex flex-col justify-center items-center p-10 md:w-5/12 min-h-[220px] md:min-h-screen relative overflow-hidden"
        style={{ backgroundColor: CHARCOAL }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: "#A0432F" }} />
        <div className="relative z-10 text-center max-w-xs">
          <div className="flex justify-center mb-6">
            <img src={logoLight} alt="Standing Rock Stewardship Co." style={{ height: "80px", width: "auto" }} />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: SERIF, color: CREAM }}>Standing Rock</h1>
          <p className="text-lg font-semibold mb-4" style={{ color: "#A0432F" }}>Stewardship Co.</p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(245,240,234,0.6)", fontFamily: SANS }}>
            Professional property stewardship for Lake Eufaula's finest lake homes.
          </p>
          <div className="space-y-2 text-left text-sm" style={{ color: "rgba(245,240,234,0.7)", fontFamily: SANS }}>
            {["Real-time monitoring & alerts", "Storm response & inspections", "Dedicated property steward", "Transparent billing & reporting"].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TERRACOTTA }} />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm" style={{ color: "rgba(245,240,234,0.45)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Already have an account?
            </Link>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 overflow-y-auto" style={{ backgroundColor: "#f7f4f0" }}>
        <div className="w-full max-w-md py-6">
          <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: SERIF, color: CHARCOAL }}>
            Request Property Access
          </h2>
          <p className="text-base text-muted-foreground mb-8" style={{ fontFamily: SANS }}>
            Create your account — we'll review and activate your portal.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-base font-medium">Full Name</Label>
                <Input value={form.name} onChange={set("name")} placeholder="John Smith" required className="mt-1 h-12 text-base" />
              </div>
              <div>
                <Label className="text-base font-medium">Email Address</Label>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="john@example.com" required className="mt-1 h-12 text-base" />
              </div>
              <div>
                <Label className="text-base font-medium">Phone Number</Label>
                <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="(918) 555-0100" className="mt-1 h-12 text-base" />
              </div>
              <div>
                <Label className="text-base font-medium">Choose a Username</Label>
                <Input value={form.username} onChange={set("username")} placeholder="johnsmith" required className="mt-1 h-12 text-base" autoComplete="username" />
              </div>
              <div>
                <Label className="text-base font-medium">Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Minimum 6 characters"
                    required
                    className="h-12 text-base pr-10"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-base font-medium">Confirm Password</Label>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  placeholder="Re-enter password"
                  required
                  className="mt-1 h-12 text-base"
                  autoComplete="new-password"
                />
              </div>
              {form.referralCode && (
                <div>
                  <Label className="text-base font-medium">Referral Code</Label>
                  <Input value={form.referralCode} onChange={set("referralCode")} className="mt-1 h-12 text-base" readOnly style={{ opacity: 0.7 }} />
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold mt-2"
              style={{ backgroundColor: TERRACOTTA, color: CREAM }}
            >
              {loading ? "Submitting…" : "Submit Application"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6" style={{ fontFamily: SANS }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: TERRACOTTA }}>Sign in</Link>
          </p>

          <p className="text-xs text-center text-muted-foreground mt-8" style={{ fontFamily: SANS }}>
            By submitting, you agree to our Terms of Service once your account is activated.<br />
            Questions? <strong>(918) 707-2228</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
