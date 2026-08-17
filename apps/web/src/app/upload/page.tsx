import { UploadForm } from "@/components/upload/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Ingest volume</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground text-pretty">
          Upload a 3D imaging volume — NIfTI (<code>.nii</code> /{" "}
          <code>.nii.gz</code>) or a zipped DICOM series — straight to Backblaze
          B2 under <code>volumes/</code>. It then appears on the Volumes page and
          in the create-job selector. Up to 512 MB per file.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <UploadForm />
      </div>
    </div>
  );
}
