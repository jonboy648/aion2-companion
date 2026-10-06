// src/components/LeftSidebar/SelectMap.tsx
import React from "react";
import { Select, SelectItem } from "@heroui/react";
import {useGameMap} from "@/context/GameMapContext.tsx";
import {useTranslation} from "react-i18next";

const SelectMap: React.FC = () => {
  const { maps, selectedMap, setSelectedMap } = useGameMap();
  const { t } = useTranslation();

  return (
    <div className="w-full flex justify-center mt-5">
      {/* Outer styled bar */}
      <div
        className="
          w-[323px] h-[38px]
          flex items-center justify-center
          border border-transparent
          rounded-none
        "
        style={{
          background: "rgba(255,255,255,0.025)",
          borderImage:
            "linear-gradient(90deg, rgba(217,168,64,0), rgba(217,168,64,0.35), rgba(217,168,64,0)) 1",
        }}
      >
        {/* HeroUI Select */}
        <Select
          aria-label="Select map"
          size="sm"
          selectedKeys={selectedMap ? [selectedMap.name] : []}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0];
            const found = maps.find((m) => m.name === key);
            if (found) {
              setTimeout(() => {
                setSelectedMap(found);
              }, 50);
            }
          }}
          // prevents hover background
          classNames={{
            trigger: [
              "w-auto",
              "px-2 py-1",
              "bg-transparent shadow-none",
              "flex items-center justify-center gap-2",
              "hover:bg-transparent",
              "data-[hover=true]:bg-transparent",
              "active:bg-transparent",
              "focus:bg-transparent",
            ].join(" "),
            value: "!text-[#eaeefa] text-sm font-medium text-center text-lg leading-[18px] ",
            innerWrapper: "static flex items-center justify-center",
            selectorIcon: [
              // "!relative !static order-2 ml-1",
              "text-default-900",
            ].join(" "),
            popoverContent: "bg-content1 rounded-none",
          }}
          className="text-center max-w-[260px]"
          radius="none"
          popoverProps={{
            radius: "none",
          }}
        >
          {maps.map((m) => (
            <SelectItem key={m.name}>
              {t(`maps:${m.name}.name`, m.name)}
            </SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
};

export default SelectMap;
