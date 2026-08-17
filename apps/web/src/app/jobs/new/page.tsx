import { JobCreateForm } from "@/components/jobs/job-create-form";

export default function NewJobPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">New segmentation job</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Pick an ingested volume and a model. The job starts as{" "}
          <em>pending</em>; run it to execute real nnU-Net inference on-device.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <JobCreateForm />
      </div>
    </div>
  );
}
