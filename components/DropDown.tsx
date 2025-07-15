import { Menu, Transition } from "@headlessui/react";
import {
    CheckIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "@heroicons/react/20/solid";
import { Fragment, useEffect, useState } from "react";

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

interface DropDownProps {
    theme: string;
    setTheme: (theme: string) => void;
    themes: string[];
    names: Map<string, string>;
    disabled?: boolean;
    blink?: boolean;
}

export default function DropDown({ theme, setTheme, themes, names, disabled, blink=false }: DropDownProps) {
    function getName(t: string): string {
        return names.get(t) || t;
    }

    const themeList = themes && themes.length > 0 ? themes : Array.from(names.keys());

    const [label, setLabel] = useState<string>(getName(theme)); // 显示的选择结果
    const [selected, setSelected] = useState<string>(theme);
    const [isDisabled, setIsDisabled] = useState(!!disabled);

    useEffect(() => {
        setSelected(theme);
        setLabel(getName(theme));
    }, [theme]);

    useEffect(() => {
        setLabel(getName(theme));
    }, [names]);

    return (
        <Menu as="div" className="relative block text-left text-xs sm:text-sm">
            <div>
                <Menu.Button
                    disabled={isDisabled}
                    className={classNames(
                        blink ? "blink" : "",
                        "inline-flex w-full justify-between items-center rounded-md border border-gray-600 bg-slate-800 px-4 py-2 text-gray-100 shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-black"
                        )}
                    >
                    {label}
                    <ChevronUpIcon
                        className="-mr-1 ml-2 h-5 w-5 ui-open:hidden"
                        aria-hidden="true"
                    />
                    <ChevronDownIcon
                        className="-mr-1 ml-2 h-5 w-5 hidden ui-open:block"
                        aria-hidden="true"
                    />
                </Menu.Button>
            </div>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items
                    key={selected}
                    className="absolute left-0 z-10 mt-2 w-full origin-top-right rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden max-h-[32rem] overflow-y-auto"
                >
                    <div>
                        {themeList.map((themeItem) => (
                            <Menu.Item key={themeItem}>
                                {({ active }) => (
                                    <button
                                        onClick={() => {
                                            setTheme(themeItem);
                                            setSelected(themeItem);
                                            setLabel(getName(themeItem));
                                        }}
                                        className={classNames(
                                            active ? "bg-gray-600 text-gray-100" : "text-gray-200",
                                            themeItem === selected ? "bg-gray-700" : "",
                                            "px-4 py-2 w-full text-left flex items-center space-x-2 justify-between tracking-wider"
                                        )}
                                    >
                                        <span>{getName(themeItem)}</span>
                                        {themeItem === selected ? (
                                            <CheckIcon className="w-4 h-4 text-bold text-yellow-400" />
                                        ) : null}
                                    </button>
                                )}
                            </Menu.Item>
                        ))}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}
