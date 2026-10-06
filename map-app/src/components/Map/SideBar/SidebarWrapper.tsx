// src/components/Sidebar/SidebarWrapper.tsx
import React, {useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronLeft, faChevronRight} from "@fortawesome/free-solid-svg-icons";
import "./become-cube-sidebar.css";
import {useTranslation} from "react-i18next";

type SidebarWrapperProps = {
  side: "left" | "right";       // determines positioning & button direction
  width?: number;               // expanded width (default 370)
  collapsedWidth?: number;      // collapsed width (default 0)
  collapsed?: boolean;
  onToggleCollapsed?: (collapsed: boolean) => void;
  children: React.ReactNode;
  /** extra small controls stacked under the collapse button */
  extraControls?: React.ReactNode;
};

const SidebarWrapper: React.FC<SidebarWrapperProps> = ({
                                                         side = "left",
                                                         width = 370,
                                                         collapsedWidth = 0,
                                                         collapsed = false,
                                                         onToggleCollapsed,
                                                         children,
                                                         extraControls,
                                                       }) => {
  const { t } = useTranslation("common");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(collapsed);
  const isLeft = side === "left";

  const toggle = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed(!collapsed);
    }
    setSidebarCollapsed((v) => !v);
  }

  const sideAlignClasses = isLeft
    ? "right-0 translate-x-full rounded-r-md rounded-l-none"
    : "left-0 -translate-x-full rounded-l-md rounded-r-none";

  return (
    <aside
      className={`
        cube-map-sidebar relative h-full flex flex-col bg-sidebar transition-all duration-300
      `}
      style={{
        width: sidebarCollapsed ? collapsedWidth : width,
        maxWidth: width,
      }}
    >
      {/* CONTENT */}
      <div className="flex-1 overflow-y-scroll sidebar-scroll">{children}</div>

      {/* COLLAPSE BUTTON */}
      <button
        onClick={toggle}
        className={`
          absolute top-[100px] flex flex-col items-center justify-center z-[20000]
          w-8 h-12 bg-sidebar-collapse text-default-700 select-none
          ${sideAlignClasses}
        `}
      >
        <FontAwesomeIcon
          icon={
            isLeft
              ? (sidebarCollapsed ? faChevronRight : faChevronLeft)
              : (sidebarCollapsed ? faChevronLeft : faChevronRight)
          }
          className="text-sm"
        />
        <span className="text-[10px] leading-tight mt-0.5 whitespace-normal text-center px-0.5">
          {sidebarCollapsed ? t("menu.expand", "Expand") : t("menu.collapse", "Collapse")}
        </span>
      </button>

      {/* EXTRA CONTROLS BELOW COLLAPSE BUTTON */}
      {extraControls && (
        <div
          className={`
            absolute top-[160px] z-[20000]
            flex flex-col items-center
            ${isLeft ? "right-0 translate-x-full" : "left-0 -translate-x-full"}
          `}
        >
          {extraControls}
        </div>
      )}
    </aside>
  );
};

export default SidebarWrapper;
