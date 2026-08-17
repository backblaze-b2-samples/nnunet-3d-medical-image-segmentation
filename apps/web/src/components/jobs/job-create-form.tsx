"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateJob, useVolumes } from "@/lib/queries";
import { pendingAutoRun } from "@/lib/pending-autorun";
import {
  MODALITIES,
  SEGMENTATION_MODELS,
} from "@nnunet-3d-medical-image-segmentation/shared";

const schema = z.object({
  name: z.string().min(1, "Give the job a name").max(120),
  input_volume_key: z.string().min(1, "Pick an ingested volume"),
  modality: z.enum(["CT", "MRI", "Other"]),
  model: z.string().min(1),
  site_id: z.string().max(120).optional(),
  patient_id: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function JobCreateForm() {
  const router = useRouter();
  const volumes = useVolumes();
  const createJob = useCreateJob();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      input_volume_key: "",
      modality: "CT",
      model: SEGMENTATION_MODELS[0].key,
      site_id: "",
      patient_id: "",
      notes: "",
      tags: "",
    },
  });

  // `run` auto-chains create → run so a first-time user reaches inference in one
  // action. Inputs stay immutable: we still create the job, then trigger its run.
  const onSubmit = async (values: Values, run: boolean) => {
    try {
      const job = await createJob.mutateAsync({
        name: values.name,
        input_volume_key: values.input_volume_key,
        modality: values.modality,
        model: values.model,
        site_id: values.site_id || null,
        patient_id: values.patient_id || null,
        notes: values.notes || null,
        tags: (values.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (run) {
        // Hand the run off to the detail page (see lib/pending-autorun.ts): it
        // triggers the run on mount so the page lands already in the running
        // state, and the run's optimistic state + poll + reconcile are owned by
        // that still-mounted page — exactly like the in-place Run button.
        pendingAutoRun.add(job.id);
        toast.success("Job created — starting nnU-Net");
      } else {
        toast.success("Job created", {
          description: "Open it and click Run segmentation to start nnU-Net.",
        });
      }
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      toast.error("Could not create job", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const noVolumes = !volumes.isLoading && (volumes.data?.length ?? 0) === 0;
  const submitting = createJob.isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => onSubmit(v, true))}
        className="max-w-2xl space-y-6"
      >
        {noVolumes && (
          <Alert>
            <AlertDescription>
              No volumes ingested yet.{" "}
              <Link href="/volumes" className="font-medium underline">
                Ingest a volume
              </Link>{" "}
              or run <code>pnpm run seed</code> to populate the cohort first.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">New segmentation job</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="liver-lesion-0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="input_volume_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Input volume</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an ingested volume" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(volumes.data ?? []).map((v) => (
                        <SelectItem key={v.key} value={v.key}>
                          {v.key.replace(/^volumes\//, "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Pick a volume seeded under <code>volumes/</code> or ingest a{" "}
                    <code>.nii.gz</code> on the{" "}
                    <Link href="/volumes" className="underline">
                      Volumes
                    </Link>{" "}
                    page. Inputs are immutable once the job is created.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modality</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODALITIES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Defaults to CT.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model / task</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEGMENTATION_MODELS.map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The seed-trained demo model runs on CPU.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="site-a" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient ID (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="patient-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="liver, contrast, cohort-1" {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anything worth recording about this run"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/jobs")}>
            Cancel
          </Button>
          {/* Plain create path preserved; the primary action auto-runs so a
              first-time user reaches inference in one click. */}
          <Button
            type="button"
            variant="outline"
            disabled={submitting || noVolumes}
            onClick={form.handleSubmit((v) => onSubmit(v, false))}
          >
            Create job
          </Button>
          <Button type="submit" disabled={submitting || noVolumes}>
            {submitting ? "Creating..." : "Create & run"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
