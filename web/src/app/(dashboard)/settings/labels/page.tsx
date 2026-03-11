import { PageHeader } from "@/components/layout/page-header";
import { LabelDesigner } from "./label-designer";

export default function LabelsPage() {
  return (
    <div>
      <PageHeader
        title="Label Designer"
        description="Create and customize label templates for your filament spools."
      />
      <LabelDesigner />
    </div>
  );
}
