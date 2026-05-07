import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="h-16 border-b flex items-center px-8 justify-between shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl text-primary">
          <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`} alt="Logo" className="w-6 h-6" />
          TaskFlow
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign In
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="py-24 px-8 max-w-6xl mx-auto flex flex-col items-center text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl mb-6">
            The collaborative hub for <br className="hidden sm:block" />
            <span className="text-primary">high-performing teams</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
            TaskFlow brings your team's work together in one beautifully organized space. Track projects, assign tasks, and hit your deadlines with ease.
          </p>
          <div className="flex gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 px-8 text-lg">Start for free</Button>
            </Link>
          </div>
          
          <div className="mt-20 w-full aspect-video rounded-xl border bg-muted shadow-2xl overflow-hidden flex items-center justify-center">
             <div className="text-muted-foreground">Product Preview Placeholder</div>
          </div>
        </section>
      </main>
    </div>
  );
}
