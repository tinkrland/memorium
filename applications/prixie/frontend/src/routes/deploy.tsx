import { createFileRoute } from '@tanstack/react-router';
import { DeployForm } from '../components/DeployForm';

export const Route = createFileRoute('/deploy')({
  component: DeployPage
});

function DeployPage() {
  return (
    <div className="space-y-6 font-mono lowercase">
      <div className="border border-primary bg-card p-6">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          deploy // meeting configuration
        </span>
        <h1 className="mt-1 text-xl sm:text-2xl font-black uppercase text-foreground">
          deploy prixie to meeting
        </h1>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          configure meeting url, arrival timing, attendance check-in, and explicit information capture goals.
          prixie will arrive, listen, execute your requests, and return with the findings.
        </p>
      </div>

      <DeployForm />
    </div>
  );
}
