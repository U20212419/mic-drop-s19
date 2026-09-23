"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CollectionItem {
  subLink: string;
  title: string | null;
  artist: string | null;
  quantity: number;
}

interface SpecialRoundComboboxProps {
  judge: any;
  collection: CollectionItem[];
  onSelectLink: (discordId: string, subLink: string) => void;
}

export function SpecialRoundCombobox({
  judge,
  collection,
  onSelectLink,
}: SpecialRoundComboboxProps) {
  const [open, setOpen] = useState(false);
  const [triggerWidth, setTriggerWidth] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Keep the width of the popover in sync with the trigger button
  useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const selectedItem = collection.find((item) => item.subLink === judge.subLink);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        className="w-full p-0 bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] hover:bg-[#111214] hover:text-white rounded-md transition-all focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] outline-none"
      >
        <div className="flex items-center justify-between w-full h-13 px-3">
          <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
            {selectedItem ? (
              <>
                <span className="truncate font-bold text-[#DBDEE1] w-full leading-tight">
                  {selectedItem.title || "Unknown Title"}
                </span>
                <span className="text-xs text-[#80848E] truncate w-full leading-tight mt-0.5">
                  {selectedItem.artist || "Unknown Artist"}
                </span>
              </>
            ) : (
              <span className="text-[#80848E] truncate text-base leading-none">
                Select from your Collection...
              </span>
            )}
          </div>
          <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-[#80848E] opacity-50" />
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 bg-[#2B2D31] border border-[#1E1F22] shadow-xl rounded-md"
        align="start"
        style={{ width: triggerWidth ? `${triggerWidth}px` : "auto" }}
      >
        <Command className="bg-transparent text-[#DBDEE1]">
          <CommandInput
            placeholder="Search title or artist..."
            className="text-[#DBDEE1] placeholder:text-[#80848E] h-10"
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-60 overflow-y-auto overflow-x-hidden border-t border-[#1E1F22]">
            <CommandEmpty className="py-6 text-center text-sm text-[#80848E]">
              No tracks found.
            </CommandEmpty>
            <CommandGroup className="p-1">
              {/* Clear Selection */}
              {selectedItem && searchValue === "" && (
                <CommandItem
                  value="clear selection remove"
                  onSelect={() => {
                    onSelectLink(judge.discordId, "");
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 px-2 py-2 cursor-pointer text-[#80848E] aria-selected:bg-[#1E1F22] aria-selected:text-[#DBDEE1] mb-1 border-b border-[#1E1F22]"
                >
                  <X className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-sm">Clear selection</span>
                </CommandItem>
              )}

              {/* Song List */}
              {collection
                .filter((item) => item.quantity > 0)
                .map((item) => (
                  <CommandItem
                    key={item.subLink}
                    value={`${item.title} ${item.artist}`}
                    onSelect={() => {
                      onSelectLink(judge.discordId, item.subLink);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 px-2 py-2 cursor-pointer aria-selected:bg-[#1E1F22] aria-selected:text-white"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold truncate text-[#DBDEE1]">
                        {item.title || "Unknown Title"}
                      </span>
                      <span className="text-xs text-[#80848E] truncate">
                        {item.artist || "Unknown Artist"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="bg-[#1E1F22] border border-[#35373C] rounded px-2 py-0.5 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-[#80848E] uppercase">
                          x{item.quantity}
                        </span>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4 text-[#5865F2] transition-opacity",
                          judge.subLink === item.subLink ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
