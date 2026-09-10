import { Slideover } from "@/components/Base/Headless";
import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import FileIcon from "@/components/Base/FileIcon";
import _ from "lodash";
import clsx from "clsx";

interface MainProps {
  activitiesPanel: boolean;
  setActivitiesPanel: (val: boolean) => void;
}

function Main(props: MainProps) {
  return (
    <div>
      <Slideover
        open={props.activitiesPanel}
        onClose={() => {
          props.setActivitiesPanel(false);
        }}
      >
        <Slideover.Panel className="w-72 rounded-[0.75rem_0_0_0.75rem/1.1rem_0_0_1.1rem]">
          <a
            href=""
            className="focus:outline-none hover:bg-white/10 bg-white/5 transition-all hover:rotate-180 absolute inset-y-0 left-0 right-auto flex items-center justify-center my-auto -ml-[60px] sm:-ml-[105px] border rounded-full text-white/90 w-8 h-8 sm:w-14 sm:h-14 border-white/90 hover:scale-105"
            onClick={(e) => {
              e.preventDefault();
              props.setActivitiesPanel(false);
            }}
          >
            <Lucide className="w-8 h-8 stroke-[1]" icon="X" />
          </a>
          <Slideover.Title className="px-6 py-5">
            <h2 className="mr-auto text-base font-medium">Latest Activities</h2>
          </Slideover.Title>
          <Slideover.Description className="p-0">
            <div className="px-5 py-3 flex flex-col gap-3.5">
              <div className="relative overflow-hidden before:content-[''] before:absolute before:w-px before:bg-slate-200/60 before:left-0 before:inset-y-0 before:dark:bg-darkmode-400 before:ml-[14px]">
               
              </div>
            </div>
          </Slideover.Description>
        </Slideover.Panel>
      </Slideover>
    </div>
  );
}

export default Main;
