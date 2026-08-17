"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useUpdateJob } from "@/lib/queries";
import type { Job } from "@nnunet-3d-medical-image-segmentation/shared";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  tags: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

type Values = z.infer<typeof schema>;

export function JobEditForm({ job }: { job: Job }) {
  const router = useRouter();
  const updateJob = useUpdateJob();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    // Pre-filled from the real job; no default hints on edit.
    defaultValues: {
      name: job.name,
      tags: job.tags.join(", "),
      notes: job.notes ?? "",
    },
  });

  const onSubmit = async (values: Values) => {
    try {
      await updateJob.mutateAsync({
        id: job.id,
        name: values.name,
        notes: values.notes || null,
        tags: (values.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success("Job updated");
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      toast.error("Could not update job", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <Alert>
          <AlertDescription>
            Editing changes <strong>metadata only</strong> (name, tags, notes).
            The input volume and model are immutable — a job is the record of one
            inference. To change the input, create a new job.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Edit job metadata</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/jobs/${job.id}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateJob.isPending}>
            {updateJob.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
