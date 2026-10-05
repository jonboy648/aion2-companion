// src/components/MarkerPopupEdit.tsx
import React, {useState, useEffect} from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Button,
  Select,
  SelectItem, Divider
} from "@heroui/react";
import {useUserMarkers} from "@/context/UserMarkersContext";
import {useTranslation} from "react-i18next";
import {useGameMap} from "@/context/GameMapContext.tsx";
import type {UserMarkerLocalType} from "@/types/game.ts";
import {getStaticUrl} from "@/utils/url.ts";
import {
  USER_MARKER_LOCAL_ICON_ORDER,
  USER_MARKER_LOCAL_ICON_MAP,
} from "@/utils/userMarkerLocalIcons.ts";


const MarkerPopupEdit: React.FC = () => {
  const {
    editingMarker,
    setEditingMarker,
    updateMarker,
    deleteMarker,
  } = useUserMarkers();

  const {types} = useGameMap();
  const {t} = useTranslation();

  // const [tab, setTab] = useState<"local" | "feedback">("local");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // two-level select state
  const [selectedLocalType, setSelectedLocalType] = useState<UserMarkerLocalType | "">("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubtype, setSelectedSubtype] = useState<string>("");


  // when marker or types change, sync local state
  useEffect(() => {
    if (!editingMarker) return;

    setName(editingMarker.name ?? "");
    setDescription(editingMarker.description ?? "");
    setSelectedLocalType(editingMarker.localType ?? "");
    // setTab(editingMarker.type ?? "local");

    // find category that contains marker's subtype
    const currentSubtype = editingMarker.subtype ?? "";
    let foundCategory = "";
    for (const cat of types) {
      if (cat.subtypes.some((s) => s.id === currentSubtype)) {
        foundCategory = cat.id;
        break;
      }
    }
    setSelectedCategory(foundCategory);
    setSelectedSubtype(currentSubtype);
  }, [editingMarker, types]);

  if (!editingMarker) return null;

  const subtypesInCategory =
    types.find((cat) => cat.id === selectedCategory)?.subtypes ?? [];

  const inputClassNames = {
    inputWrapper: ` bg-input hover:!bg-input focus:!bg-input transition-none
                    group-data-[hover=true]:!bg-input
                    group-data-[focus=true]:!bg-input
                    group-data-[focus-visible=true]:!bg-input
                    group-data-[invalid=true]:!bg-input
                  `,
    innerWrapper: `h-10 py-0`
  }


  const handleSave = async () => {
    const finalSubtype = selectedSubtype || editingMarker.subtype || "";
    updateMarker({
      ...editingMarker,
      x: Math.round(editingMarker.x),
      y: Math.round(editingMarker.y),
      subtype: finalSubtype,
      name: name,
      description: description,
      localType: selectedLocalType || undefined,
    });
    setEditingMarker(null);
  }

  const handleDelete = () => {
    deleteMarker(editingMarker.id);
  }

  return (
    <Modal
      isOpen
      onOpenChange={() => setEditingMarker(null)}
      placement="center"
      size="md"
      classNames={{wrapper: "z-[30000]"}}
      hideCloseButton
      backdrop="transparent"
    >
      <ModalContent className="bg-sidebar">
        {() => (
          <>
            <ModalHeader className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold">
                {t("common:markerActions.editUserMarker", "Edit custom marker")}
              </span>
              <span className="text-sm text-default-700">{t("common:markerActions.local", "Local marker")}</span>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-3">
              {editingMarker.type === "local" && (
                <div className="flex items-center gap-2 flex-wrap">
                  {USER_MARKER_LOCAL_ICON_ORDER.map((k) => {
                    const selected = selectedLocalType === k;
                    const iconPath = USER_MARKER_LOCAL_ICON_MAP[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSelectedLocalType(k)}
                        className={[
                          "w-[30px] h-[30px] rounded-full border flex items-center justify-center shrink-0",
                          selected
                            ? "bg-[radial-gradient(50%_50%_at_50%_50%,_#2E97FF_75%,_#B2D9FF_76%)] border-white"
                            : "bg-[radial-gradient(50%_50%_at_50%_50%,_#5D5D5D_75%,_#ADADAD_76%)] border-white",
                        ].join(" ")}
                      >
                        <img
                          src={getStaticUrl(iconPath)}
                          alt=""
                          className="w-[22px] h-[22px] object-contain pointer-events-none select-none"
                          draggable={false}
                        />
                      </button>
                    );
                  })}
                </div>
              )}


              {/* Type / Subtype + Coordinates */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                {/* Category */}
                <Select
                  aria-label="Category"
                  selectedKeys={selectedCategory ? new Set([selectedCategory]) : new Set()}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as string | undefined;
                    setSelectedCategory(key ?? "");
                    setSelectedSubtype("");
                  }}
                  size="sm"
                  className="w-[100px]"
                  radius="none"
                >
                  {types.map((cat) => (
                    <SelectItem
                      key={cat.id}
                      textValue={t(`types:categories.${cat.name}.name`, cat.name)}
                    >
                      {t(`types:categories.${cat.name}.name`, cat.name)}
                    </SelectItem>
                  ))}
                </Select>

                <span className="opacity-60">/</span>

                {/* Subtype */}
                <Select
                  aria-label="Subtype"
                  selectedKeys={selectedSubtype ? new Set([selectedSubtype]) : new Set()}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as string | undefined;
                    setSelectedSubtype(key ?? "");
                  }}
                  size="sm"
                  isDisabled={!selectedCategory}
                  className="w-[140px]"
                  radius="none"
                >
                  {subtypesInCategory.map((sub) => (
                    <SelectItem
                      key={sub.id}
                      textValue={t(`types:subtypes.${sub.name}.name`, sub.name)}
                    >
                      {t(`types:subtypes.${sub.name}.name`, sub.name)}
                    </SelectItem>
                  ))}
                </Select>

                {/* Coordinates */}
                <span className="opacity-80 whitespace-nowrap">
                  ({Math.round(editingMarker.x)}, {Math.round(editingMarker.y)})
                </span>
              </div>

              <Divider className="mt-2"/>

              {/* Title */}
              <Input
                label={t("common:markerActions.name", "Name")}
                labelPlacement="outside-top"
                value={name}
                onValueChange={setName}
                classNames={inputClassNames}
                radius="none"
              />

              {/* Description */}
              <Input
                label={t("common:markerActions.description", "Description")}
                labelPlacement="outside-top"
                value={description}
                onValueChange={setDescription}
                classNames={inputClassNames}
                radius="none"
              />



            </ModalBody>
            <ModalFooter className="flex gap-6">
              {/* Delete (with tooltip) */}
              <div className="flex-1">
                {editingMarker?.type !== "feedback" && (
                  <Button
                    color="danger"
                    radius="sm"
                    className="w-full text-background"
                                        onPress={handleDelete}
                  >
                    {t("common:ui.delete", "Delete")}
                  </Button>
                )}
              </div>

              <div className="flex-1">
                {editingMarker?.type === "local" && (
                  <Button
                    color="default"
                    // variant="flat"
                    onPress={handleSave}
                    radius="sm"
                    className="w-full"
                  >
                    {t("common:ui.save", "Save")}
                  </Button>
                )}
              </div>

            </ModalFooter>

          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default MarkerPopupEdit;
