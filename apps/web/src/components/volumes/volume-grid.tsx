"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { volumeSliceUrl } from "@/lib/api-client";
import type { VolumeSummary } from "@nnunet-3d-medical-image-segmentation/shared";

export function VolumeGrid({ volumes }: { volumes: VolumeSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {volumes.map((v) => (
        <Card key={v.key} className="overflow-hidden">
          <div className="aspect-square bg-black/90">
            {/* Server-rendered mid-slice PNG (volumes aren't browser-native). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={volumeSliceUrl(v.key)}
              alt={`Mid-slice of ${v.filename}`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
          <CardContent className="space-y-2 p-4">
            <p className="truncate font-medium" title={v.filename}>
              {v.filename}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {v.modality && <Badge variant="secondary">{v.modality}</Badge>}
              {v.site && <Badge variant="outline">{v.site}</Badge>}
              {v.patient && <Badge variant="outline">{v.patient}</Badge>}
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {v.key}
            </p>
            <p className="text-xs text-muted-foreground">{v.size_human}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
