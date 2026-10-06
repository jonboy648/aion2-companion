// src/components/MarkerPopupContent.tsx
import React from "react";
import {Trans, useTranslation} from "react-i18next";
import {Button, Card, Divider} from "@heroui/react";
import {useGameMap} from "@/context/GameMapContext.tsx";
import type {MarkerWithTranslations} from "@/types/game.ts";
import {useGameData} from "@/context/GameDataContext.tsx";
import {useMarkers} from "@/context/MarkersContext.tsx";

type Props = {
  marker: MarkerWithTranslations;
  onSelectMarker: (markerId: string | null) => void;
};

const MarkerPopupContent: React.FC<Props> = ({
                                               marker,
                                               onSelectMarker,
                                             }) => {
  const {selectedMap, types} = useGameMap();
  const {allSubtypes} = useGameData();
  const regionNs = `regions/${selectedMap?.name}`;
  const {t} = useTranslation([regionNs]);
  const {completedBySubtype, toggleMarkerCompleted} = useMarkers();

  if (!selectedMap) return null;

  const sub = allSubtypes.get(marker.subtype);
  const cat = types.find((c) => c.name === sub?.category);

  // Category & subtype labels from types namespace (fully-qualified keys)
  const categoryLabel = t(
    `types:categories.${cat?.name}.name`,
  );
  const subtypeLabel = t(
    `types:subtypes.${sub?.name}.name`,
  );
  const regionKeyPrefix = `${regionNs}:${marker.region}`;
  const regionLabel = marker.region ? t(`${regionKeyPrefix}.name`) : "";
  const canComplete = !!sub?.canComplete;

  let name = marker.localizedName;
  if (!name) {
    if (!marker.name || cat?.name == "collection") {
      name = subtypeLabel;
    } else {
      name = marker.name;
    }
  }

  const description = marker.localizedDescription || "";

  let isCompleted = false;
  if (sub?.name && completedBySubtype[sub.name]) {
    const completedSet = completedBySubtype[sub.name];
    isCompleted = completedSet.has(marker.indexInSubtype);
  }

  return (
    <Card
      className="
      w-[360px]
      p-5 text-xs leading-snug
      text-foreground
      bg-sidebar
      space-y-5
    "
      radius="sm"
    >
      {/* Title */}
      <div>
        <div className="text-[18px] leading-[18px] font-bold">{name}</div>
        {(marker.contributors?.length ?? 0) > 0 && (
          <div className="text-[14px] leading-[14px] mt-2">
            <Trans
              t={t}
              i18nKey="common:markerActions.providedBy"
              defaults="This location is provided by <emph>{{contributor}}</emph>"
              values={{
                contributor: (marker.contributors ?? []).join(", ")
              }}
              components={{
                emph: <span className="text-success-600"/>
              }}
            />
          </div>
        )}
      </div>

      {/* Category / subtype + coordinates */}
      <div className="text-[14px] leading-[14px]">
        {categoryLabel} / {subtypeLabel}{" "}
        <span className="opacity-80">
          ({marker.x.toFixed(0)}, {marker.y.toFixed(0)})
        </span>
        {regionLabel ? ` / ${regionLabel}` : null}
      </div>

      <Divider/>

      {/* Description */}
      {description && (<div className="text-[14px] leading-[14px]">{description}</div>)}

      {canComplete && (
        <>
          <Divider/>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="flat"
              color={isCompleted ? "success" : "primary"}
              onPress={() => {
                onSelectMarker(null);
                toggleMarkerCompleted(marker);
              }}
            >
              {isCompleted
                ? t("common:markerActions:markNotCompleted", "Completed")
                : t("common:markerActions:markCompleted", "Mark as completed")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default MarkerPopupContent;
