import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Anchor } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Anchor className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-xl font-bold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground text-sm mb-6">
        The page you're looking for doesn't exist or you don't have access.
      </p>
      <Link href="/">
        <Button>
          <Home className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
