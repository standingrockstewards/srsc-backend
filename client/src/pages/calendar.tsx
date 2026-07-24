import { AppLayout } from "@/components/app-layout";
import { OutlookCalendar } from "@/components/outlook-calendar";

export default function CalendarPage() {
  return (
    <AppLayout
      title="Calendar"
      subtitle="Standing Rock Stewardship Co."
    >
      <div className="h-full flex flex-col" style={{ minHeight: "calc(100vh - 60px)" }}>
        <OutlookCalendar />
      </div>
    </AppLayout>
  );
}
