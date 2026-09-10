import "@/assets/css/vendors/simplebar.css";
import userIcon from "@/assets/images/users/user_icon_profile.png";
import { FormInput, FormTextarea } from "@/components/Base/Form";
import { Menu, Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Tippy from "@/components/Base/Tippy";
import clsx from "clsx";
import _ from "lodash";
import { createRef, useEffect, useState } from "react";
import SimpleBar from "simplebar";
import ImageZoom from "../../components/Base/ImageZoom";
import PageHeader from "../../components/Base/PageHeader";
import withSessionCheck from "../../components/SessionChecker";
import { formatTimestamp, mockChats, mockMessages, type User } from "./mockData";
const AUDIO_BAR_HEIGHTS = [
    "15%", "25%", "35%", "45%", "40%", "30%", "20%", "25%", "35%", "45%",
    "40%", "30%", "40%", "50%", "70%", "100%", "90%", "70%", "50%", "40%",
    "30%", "40%", "45%", "35%", "25%", "15%", "15%", "25%", "35%", "45%",
    "40%", "30%", "20%",
];

type AudioBarsProps = {
    /** se vuoi ridurle un pochino in futuro, es: compact=true */
    compact?: boolean;
};

const AudioBars: React.FC<AudioBarsProps> = ({ compact }) => {
    return (
        <div
            className={clsx(
                "flex items-end h-6 gap-0.5",
                compact && "scale-90 origin-bottom"
            )}
        >
            {AUDIO_BAR_HEIGHTS.map((height, index) => {
                // qui puoi cambiare la logica di cosa è "attivo"
                const isActive = index < 16; // prime 16 barre "vive"

                return (
                    <div
                        key={index}
                        style={{ height }}
                        className={clsx(
                            "w-0.5 rounded-full transition-all duration-300",
                            isActive
                                ? "bg-gradient-to-b from-theme-1/70 to-theme-2/70"
                                : "bg-slate-300/80"
                        )}
                    />
                );
            })}
        </div>
    );
};

function Main() {
    const scrollableRef = createRef<HTMLDivElement>();
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        if (scrollableRef.current) {
            new SimpleBar(scrollableRef.current);
        }
    });

    return (
        <div className="grid grid-cols-12 gap-y-8 gap-x-6 mx-4 lg:mx-10 2xl:mx-20">
            <div className="col-span-12">
                <div className="flex flex-col mt-4 md:mt-0 md:h-10 gap-y-3 md:items-center md:flex-row">
                    <PageHeader title="Business Chat WhatsApp" />
                </div>

                <div className="mt-4 flex flex-col lg:flex-row gap-y-8 gap-x-6">
                    {/* COLONNA SINISTRA */}
                    <div className="w-full lg:w-[23rem] flex-none">
                        <Tab.Group className="flex flex-col gap-y-6">
                            <div className="flex flex-col p-2 box box--stacked rounded-2xl border border-slate-200/70 dark:border-darkmode-400/60  dark:bg-darkmode-600/80 shadow-sm">
                                <Tab.List
                                    variant="boxed-tabs"
                                    className="bg-transparent border-transparent"
                                >
                                    <Tab className="first:rounded-l-[0.8rem] last:rounded-r-[0.8rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-theme-1 [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-theme-1/5 [&[aria-selected='true']_button]:border-theme-1/20">
                                        <Tab.Button
                                            className="w-full text-slate-600 dark:text-slate-300 whitespace-nowrap rounded-[0.8rem] py-2.5 px-3 flex items-center gap-2 justify-center text-sm transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-darkmode-500/70"
                                            as="button"
                                        >
                                            <Lucide
                                                icon="MessagesSquare"
                                                className="w-4 h-4 stroke-[1.4]"
                                            />
                                            Chats
                                            <div className="min-w-[1.15rem] rounded-full bg-white flex items-center justify-center text-[0.65rem]">
                                                <div className="w-full h-full px-1.5 py-0.5 leading-none rounded-full bg-theme-1 text-white font-medium">
                                                    {_.random(5, 15)}
                                                </div>
                                            </div>
                                        </Tab.Button>
                                    </Tab>
                                    <Tab className="first:rounded-l-[0.8rem] last:rounded-r-[0.8rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-theme-1 [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-theme-1/5 [&[aria-selected='true']_button]:border-theme-1/20">
                                        <Tab.Button
                                            className="w-full text-slate-600 dark:text-slate-300 whitespace-nowrap rounded-[0.8rem] py-2.5 px-3 flex items-center gap-2 justify-center text-sm transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-darkmode-500/70"
                                            as="button"
                                        >
                                            <Lucide
                                                icon="UserPlus"
                                                className="w-4 h-4 stroke-[1.4]"
                                            />
                                            Contacts
                                        </Tab.Button>
                                    </Tab>
                                </Tab.List>
                            </div>

                            <div className="flex flex-col p-5 box box--stacked rounded-2xl border border-slate-200/70 dark:border-darkmode-400/60  dark:bg-darkmode-600/90 shadow-sm">
                                <Tab.Panels>
                                    <Tab.Panel>
                                        <div>
                                            {/* SEARCH */}
                                            <div className="relative">
                                                <Lucide
                                                    icon="Search"
                                                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-4 stroke-[1.3] text-slate-500/90"
                                                />
                                                <FormInput
                                                    type="text"
                                                    rounded
                                                    placeholder="Search for messages..."
                                                    className="pl-10 py-2.5 text-sm bg-slate-50/80 dark:bg-darkmode-600/80 border-slate-200/70 dark:border-darkmode-400/70 focus:ring-2 focus:ring-theme-1/30 focus:border-theme-1/60"
                                                />
                                            </div>

                                            {/* LISTA CHAT */}
                                            <div className="flex flex-col gap-3.5 mt-4">
                                                {_.map(mockChats, (chat) => {
                                                    const otherParticipant = chat.participants.find(
                                                        (p) => p.id !== "1"
                                                    );
                                                    const isSelected = selectedUser?.id === otherParticipant?.id;
                                                    const isPinned = chat.isPinned;

                                                    return (
                                                        <div
                                                            key={chat.id}
                                                            onClick={() => setSelectedUser(otherParticipant ?? null)}
                                                            className={clsx(
                                                                "flex items-center gap-4 px-2.5 py-2.5 -mx-2 rounded-xl cursor-pointer border transition-colors duration-150",
                                                                "hover:bg-theme-1/5 hover:border-theme-1/30 dark:hover:bg-darkmode-500/80",
                                                                isSelected
                                                                    ? "bg-theme-1/10 border-theme-1/40 shadow-sm"
                                                                    : "border-transparent"
                                                            )}
                                                        >
                                                            <div className="relative">
                                                                <div className="w-12 h-12 overflow-hidden border-2 rounded-full image-fit border-theme-1/20 shadow-sm">
                                                                    <img
                                                                        alt={otherParticipant?.name}
                                                                        src={otherParticipant?.avatar}
                                                                    />
                                                                </div>
                                                                {otherParticipant?.status === "online" && (
                                                                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border border-white rounded-full bg-success/80 mt-0.5 ml-0.5 shadow-sm"></div>
                                                                )}
                                                            </div>

                                                            <div className="w-full">
                                                                <div className="flex items-center w-full">
                                                                    <div
                                                                        className={clsx(
                                                                            "max-w-[7rem] md:max-w-[8rem] truncate text-sm",
                                                                            isSelected
                                                                                ? "font-semibold text-theme-1"
                                                                                : "font-medium text-slate-700 dark:text-slate-100"
                                                                        )}
                                                                    >
                                                                        {otherParticipant?.name}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 ml-auto">
                                                                        {chat.lastMessage?.isRead && (
                                                                            <Lucide
                                                                                icon="CheckCheck"
                                                                                className={clsx(
                                                                                    "w-3.5 h-3.5 stroke-[1.4]",
                                                                                    isSelected
                                                                                        ? "text-theme-1"
                                                                                        : "text-slate-500/90"
                                                                                )}
                                                                            />
                                                                        )}
                                                                        <div className="text-xs text-slate-500/90">
                                                                            {chat.lastMessage?.timestamp
                                                                                ? formatTimestamp(chat.lastMessage.timestamp)
                                                                                : ""}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center mt-1.5">
                                                                    <div className="text-slate-500/90 max-w-[7rem] md:max-w-[10rem] truncate dark:text-slate-400 text-xs">
                                                                        {chat.lastMessage?.content}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 ml-auto">
                                                                        {isPinned && (
                                                                            <Lucide
                                                                                icon="Pin"
                                                                                className="w-3.5 h-3.5 stroke-[1] text-theme-1/90 fill-theme-1/10 rotate-45"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                            </div>
                                        </div>
                                    </Tab.Panel>
                                </Tab.Panels>
                            </div>
                        </Tab.Group>
                    </div>

                    {/* COLONNA DESTRA */}
                    <div className="flex flex-col w-full gap-y-6">
                        <div className="flex flex-col p-5 box box--stacked rounded-2xl border border-slate-200/70 dark:border-darkmode-400/60  dark:bg-darkmode-600/90 shadow-sm">
                            {/* HEADER CON CONTATTO */}
                            <div className="flex items-center gap-3.5 border-b border-dashed border-slate-200/80 dark:border-darkmode-400/80 pb-5">
                                <div>
                                    <div className="w-12 h-12 overflow-hidden rounded-full image-fit border-[3px] border-theme-1/40 shadow-sm">
                                        <img
                                            alt={selectedUser?.name ?? "User avatar"}
                                            src={selectedUser?.avatar ?? userIcon}
                                        />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium truncate max-w-[9rem] md:max-w-none text-sm text-slate-800 dark:text-slate-50">
                                        {selectedUser
                                            ? selectedUser.name
                                            : "Seleziona una chat"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs mt-0.5 truncate max-w-[9rem] md:max-w-none">
                                        {selectedUser ? (
                                            <>
                                                <span
                                                    className={clsx(
                                                        "w-2 h-2 rounded-full",
                                                        selectedUser.status === "online"
                                                            ? "bg-success/80"
                                                            : "bg-slate-400/80"
                                                    )}
                                                />
                                                <span className="text-slate-500">
                                                    {selectedUser.status === "online"
                                                        ? "Online"
                                                        : "Offline"}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-slate-500">
                                                Seleziona una conversazione per iniziare a
                                                scrivere
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-auto">
                                    <Tippy
                                        as="a"
                                        className={clsx(
                                            "flex items-center justify-center border rounded-full w-9 h-9 transition-colors",
                                            "border-theme-1/40 bg-theme-1/5 hover:bg-theme-1/15",
                                            !selectedUser && "opacity-50 pointer-events-none"
                                        )}
                                        content="Call"
                                    >
                                        <Lucide
                                            icon="Phone"
                                            className="w-4 h-4 text-theme-1 fill-theme-1/10"
                                        />
                                    </Tippy>
                                    <Tippy
                                        as="a"
                                        className={clsx(
                                            "flex items-center justify-center border rounded-full w-9 h-9 transition-colors",
                                            "border-theme-1/40 bg-theme-1/5 hover:bg-theme-1/15",
                                            !selectedUser && "opacity-50 pointer-events-none"
                                        )}
                                        content="Send a message"
                                    >
                                        <Lucide
                                            icon="Mail"
                                            className="w-4 h-4 text-theme-1 fill-theme-1/10"
                                        />
                                    </Tippy>
                                </div>
                            </div>

                            {/* AREA MESSAGGI */}
                            <div
                                className={clsx([
                                    "flex-1 min-h-0 overflow-y-auto [&:-webkit-scrollbar]:w-0 [&:-webkit-scrollbar]:bg-transparent",
                                    "[&_.simplebar-content]:p-0 [&_.simplebar-track.simplebar-vertical]:w-[8px] [&_.simplebar-track.simplebar-vertical]:mr-0.5 [&_.simplebar-track.simplebar-vertical_.simplebar-scrollbar]:before:bg-slate-400/25",
                                ])}
                                ref={scrollableRef}
                                style={{ maxHeight: "calc(100vh - 410px)" }}
                            >
                                <div className="flex flex-col gap-4 py-5 px-3">
                                    {_.take(mockMessages, 9).map((faker, fakerKey) => (
                                        <div
                                            key={fakerKey}
                                            className={clsx([
                                                "max-w-[85%] md:max-w-[70%] relative mr-auto group [&.right]:mr-0 [&.right]:ml-auto flex items-end gap-3 [&.right]:flex-row-reverse",
                                                { right: [0, 0, 1, 1, 1][_.random(0, 5)] },
                                            ])}
                                        >
                                            <div className="hidden sm:block">
                                                <div className="w-9 h-9 overflow-hidden rounded-full image-fit border-[2px] border-theme-1/30 shadow-sm">
                                                    <img
                                                        alt={selectedUser?.name ?? "Tailwise - Admin Dashboard Template"}
                                                        src={selectedUser?.avatar ?? userIcon}
                                                    />
                                                </div>
                                            </div>
                                            <div
                                                className={clsx(
                                                    "border px-4 pt-3 pb-3.5 rounded-2xl rounded-bl-md bg-white dark:bg-darkmode-500/90 border-slate-200/80 dark:border-darkmode-400/80 shadow-sm text-[0.92rem] leading-relaxed text-slate-800 dark:text-slate-100",
                                                    // messaggi "miei" (a destra): bubble a tema viola/blue
                                                    "group-[.right]:text-right group-[.right]:rounded-l-2xl group-[.right]:rounded-br-md group-[.right]:border-transparent group-[.right]:bg-gradient-to-br group-[.right]:from-theme-1 group-[.right]:to-theme-2 group-[.right]:text-white"
                                                )}
                                            >
                                                <div>{faker.content}</div>

                                                {_.random(0, 1) === 0 &&
                                                    (_.random(0, 1) ? (
                                                        <div className="flex items-center gap-3 mt-3.5 mb-3 group-[.right]:justify-end">
                                                            <Tippy
                                                                as="a"
                                                                className="flex items-center justify-center w-7 h-7 rounded-full bg-theme-1 hover:bg-theme-2 transition-colors shadow-sm"
                                                                content="Play"
                                                            >
                                                                <Lucide
                                                                    icon="Play"
                                                                    className="w-3 h-3 -mr-0.5 fill-white/90"
                                                                />
                                                            </Tippy>
                                                            <div className="flex items-center h-6 gap-0.5">
                                                                <AudioBars />
                                                            </div>
                                                            <Tippy
                                                                as="a"
                                                                className={clsx(
                                                                    "flex items-center justify-center gap-1 pl-1 pr-1.5 py-px text-[0.7rem] border rounded-md",
                                                                    "border-theme-1/40 bg-theme-1/10 text-theme-1 group-[.right]:border-white/40 group-[.right]:bg-white/10 group-[.right]:text-white"
                                                                )}
                                                                content="Call"
                                                            >
                                                                <Lucide
                                                                    icon="MoveRight"
                                                                    className="w-3.5 h-3.5 fill-white/80 stroke-[1.3]"
                                                                />
                                                                A
                                                            </Tippy>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-3 mb-3.5 w-64 h-32 overflow-hidden rounded-lg image-fit group-[.right]:ml-auto">
                                                            <ImageZoom
                                                                alt="Tailwise - Admin Dashboard Template"
                                                                className="p-0.5 border rounded-lg saturate-150 border-slate-200/80 group-[.right]:border-white/40"
                                                                src={"https://picsum.photos/200/300"}
                                                            />
                                                        </div>
                                                    ))}

                                                <div className="flex group-[.right]:flex-row-reverse items-center mt-3 gap-10">
                                                    <div className="flex items-center gap-2 mr-auto group-[.right]:mr-0 group-[.right]:ml-auto group-[.right]:flex-row-reverse">
                                                        <div className="text-[0.7rem] text-slate-500/70 group-[.right]:text-white/70">
                                                            {/* timestamp qui in futuro */}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Lucide
                                                                icon="Eye"
                                                                className="w-3.5 h-3.5 stroke-[1] text-slate-500/80 fill-slate-100 group-[.right]:text-white/80 group-[.right]:fill-white/10"
                                                            />
                                                            <div className="text-[0.7rem] text-slate-500/70 group-[.right]:text-white/70">
                                                                {/* letto da... */}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <Menu className="absolute inset-y-0 right-0 w-5 h-5 my-auto -mr-8 group-[.right]:-ml-8 group-[.right]:left-0">
                                                <Menu.Button className="w-5 h-5 text-slate-400 hover:text-theme-1 dark:hover:text-slate-200 transition-colors">
                                                    <Lucide
                                                        icon="EllipsisVertical"
                                                        className="w-5 h-5 stroke-slate-400/80 fill-slate-400/70"
                                                    />
                                                </Menu.Button>
                                                <Menu.Items className="w-40">
                                                    <Menu.Item>
                                                        <Lucide icon="Copy" className="w-4 h-4 mr-2" /> Copy
                                                        Link
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        <Lucide icon="Trash" className="w-4 h-4 mr-2" />
                                                        Delete
                                                    </Menu.Item>
                                                </Menu.Items>
                                            </Menu>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* AREA INPUT */}
                            <div className="relative mt-3">
                                <FormTextarea
                                    className="-mb-1.5 pr-16 rounded-xl resize-none text-sm bg-slate-50/95 dark:bg-darkmode-500/90 border-slate-200/80 dark:border-darkmode-400/80 focus:ring-theme-1/30 focus:border-theme-1/60"
                                    placeholder={`Rispondi a ${selectedUser ? selectedUser.name : '...'}...`}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center justify-center w-[3.8rem]">
                                    <button
                                        type="button"
                                        className="flex items-center justify-center border-transparent rounded-full cursor-pointer w-9 h-9 box bg-gradient-to-b from-theme-1 to-theme-2 shadow-sm hover:shadow-md hover:scale-[1.03] active:scale-100 transition-transform"
                                    >
                                        <Lucide
                                            icon="Send"
                                            className="stroke-[1.3] w-4 h-4 -ml-0.5 text-white/80"
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* FINE COLONNA DESTRA */}
                </div>
            </div>
        </div>
    );
}

export default withSessionCheck(Main);
