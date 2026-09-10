import Lucide from "@/components/Base/Lucide";
import { Tab, Menu } from "@/components/Base/Headless";
import Button from "@/components/Base/Button";
import Calendar from "@/components/Calendar";
import { Draggable as FullCalendarDraggable } from "@/components/Base/Calendar";
import { Draggable } from "@fullcalendar/interaction";
import _ from "lodash";

function Main() {
  const dragableOptions: Draggable["settings"] = {
    itemSelector: ".event",
    eventData(eventEl) {
      const getDays = () => {
        const days = eventEl.querySelectorAll(".event__days")[0]?.textContent;
        return days ? days : "0";
      };
      return {
        title: eventEl.querySelectorAll(".event__title")[0]?.innerHTML,
        duration: {
          days: parseInt(getDays()),
        },
      };
    },
  };

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <div className="flex flex-col md:h-10 gap-y-3 md:items-center md:flex-row">
          <div className="text-base font-medium group-[.mode--light]:text-white">
            Calendar
          </div>
          <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 md:ml-auto">
            <Button
              variant="primary"
              className="group-[.mode--light]:!bg-white/[0.12] group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-transparent"
            >
              <Lucide icon="CopyPlus" className="stroke-[1.3] w-4 h-4 mr-3" />{" "}
              Add New Schedule
            </Button>
          </div>
        </div>
        <div className="mt-3.5 flex flex-col lg:flex-row gap-y-10 gap-x-6">
          <div className="w-full lg:w-[23rem] flex-none">
            <Tab.Group className="flex flex-col gap-y-7">
              <div className="flex flex-col p-2 box box--stacked">
                <Tab.List
                  variant="boxed-tabs"
                  className="bg-transparent border-transparent"
                >
                  <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.04] [&[aria-selected='true']_button]:border-primary/[0.15]">
                    <Tab.Button
                      className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center"
                      as="button"
                    >
                      <Lucide icon="Send" className="w-4 h-4 stroke-[1.4]" />
                      Upcoming
                      <div className="min-w-[1.15rem] rounded-full bg-white flex items-center justify-center text-xs">
                        <div className="w-full h-full px-1.5 py-0.5 leading-none rounded-full bg-theme-1/[0.75] text-white">
                          {_.random(5, 15)}
                        </div>
                      </div>
                    </Tab.Button>
                  </Tab>
                  <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.04] [&[aria-selected='true']_button]:border-primary/[0.15]">
                    <Tab.Button
                      className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center"
                      as="button"
                    >
                      <Lucide
                        icon="UserPlus"
                        className="w-4 h-4 stroke-[1.4]"
                      />
                      Invite
                    </Tab.Button>
                  </Tab>
                </Tab.List>
              </div>
              <Tab.Panels>
                <Tab.Panel>
                  <FullCalendarDraggable
                    id="calendar-events"
                    options={dragableOptions}
                    className="flex flex-col gap-y-6"
                  >
                   
                    <div
                      className="hidden p-3 text-center text-slate-500"
                      id="calendar-no-events"
                    >
                      No events yet
                    </div>
                  </FullCalendarDraggable>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>
          <div className="flex flex-col w-full gap-y-7">
            <div className="flex flex-col p-5 box box--stacked">
              <Calendar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;
