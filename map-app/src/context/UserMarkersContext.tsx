// src/context/UserMarkersContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {v4 as uuidv4} from "uuid";
import {keyBy} from "lodash";
import type {UserMarkerInstance} from "@/types/game";
import {useGameMap} from "@/context/GameMapContext.tsx";
import {decodePartyLink, MAX_PARTY_PINS} from "@/utils/partyLink";
import {setQueryParam} from "@/utils/url";

type ContextValue = {
  pickMode: boolean;
  setPickMode: (v: boolean) => void;

  userMarkers: UserMarkerInstance[];
  userMarkersByMarkerId: Record<string, UserMarkerInstance>;

  createMarker: (x: number, y: number) => void;
  createMarkerRemote: (marker: UserMarkerInstance) => void;
  updateMarker: (marker: UserMarkerInstance) => void;
  deleteMarker: (id: string) => void;

  editingMarker: UserMarkerInstance | null;
  setEditingMarker: (m: UserMarkerInstance | null) => void;

  hideUserMarkers: boolean;
  setHideUserMarkers: (value: boolean) => void;
};

const STORAGE_PREFIX = "aion2.userMarkers.v1.";

const UserMarkersContext = createContext<ContextValue | null>(null);

export const UserMarkersProvider: React.FC<{ children: React.ReactNode }> = ({
                                                                               children,
                                                                             }) => {
  const {selectedMap, maps} = useGameMap();
  const appliedShare = useRef(false);
  const [loadedMapId, setLoadedMapId] = useState<string | null>(null);

  const [pickMode, setPickMode] = useState(false);
  const [userMarkers, setUserMarkers] = useState<UserMarkerInstance[]>([]);
  const [userMarkersByMarkerId, setUserMarkersByMarkerId] = useState<Record<string, UserMarkerInstance>>({});
  const [editingMarker, setEditingMarker] =
    useState<UserMarkerInstance | null>(null);
  const [hideUserMarkers, setHideUserMarkers] = useState<boolean>(false);

  /** Helper: storage key per map */
  const getStorageKey = useCallback(
    (mapName: string) => `${STORAGE_PREFIX}${mapName}`,
    [],
  );

  /** 🔁 Load markers when switching map */
  useEffect(() => {
    const load = async () => {
      if (!selectedMap) {
        setUserMarkers([]);
        setEditingMarker(null);
        return;
      }

      const markers = new Map<string, UserMarkerInstance>();
      const shared = !appliedShare.current
        ? decodePartyLink(new URLSearchParams(window.location.search).get("p"), maps) : null;
      if (shared?.zone === selectedMap.name) {
        appliedShare.current = true;
        shared.pins.forEach(marker => markers.set(marker.id, marker));
        setHideUserMarkers(false);
      }
      try {
        if (shared?.zone === selectedMap.name) {
          localStorage.setItem(getStorageKey(selectedMap.name), JSON.stringify(shared.pins));
          setQueryParam("p", null);
        }
        const raw = shared?.zone === selectedMap.name ? null : localStorage.getItem(getStorageKey(selectedMap.name));
        if (raw) {
          const results = JSON.parse(raw);
          results.forEach((marker: UserMarkerInstance) => {
            if (marker.type === "local") {
              markers.set(marker.id, marker)
            }
          });
        }
      } catch (e) {
        console.error(e);
      }

      const markersArray = [...markers.values()]
      setLoadedMapId(selectedMap.id);
      setEditingMarker(null);
      setUserMarkers(markersArray);
      setUserMarkersByMarkerId(keyBy(markersArray.filter(marker => marker.type === "feedback"), "markerId"));
    }
    load();

  }, [selectedMap, maps, getStorageKey]);

  /** 💾 Persist markers for current map only */
  useEffect(() => {
    if (!selectedMap || loadedMapId !== selectedMap.id) return;
    localStorage.setItem(
      getStorageKey(selectedMap.name),
      JSON.stringify(userMarkers.filter(marker => marker.type === "local")),
    );
  }, [userMarkers, selectedMap, loadedMapId, getStorageKey]);

  const createMarker = useCallback(
    (x: number, y: number) => {
      if (!selectedMap) return;

      const marker: UserMarkerInstance = {
        id: uuidv4(),
        markerId: "",
        subtype: "",
        mapId: selectedMap.id,
        x,
        y,
        name: "",
        description: "",
        image: "",
        type: "local",
        localType: "fox",
      };

      setUserMarkers((prev) => prev.length < MAX_PARTY_PINS ? [...prev, marker] : prev);
      setEditingMarker(marker);
      setPickMode(false);
    },
    [selectedMap],
  );

  const createMarkerRemote = useCallback(
    (marker: UserMarkerInstance) => {
      setUserMarkers((prev) => [...prev, marker]);
      setUserMarkersByMarkerId((prev) => ({
        ...prev,
        [marker.markerId]: marker,
      }));
    },
    [],
  );

  const updateMarker = useCallback((marker: UserMarkerInstance) => {
    setUserMarkers((prev) =>
      prev.map((m) => (m.id === marker.id ? marker : m)),
    );
    setUserMarkersByMarkerId((prev) => ({
      ...prev,
      [marker.markerId]: marker,
    }));
  }, []);

  const deleteMarker = useCallback((id: string) => {
    setUserMarkers((prev) => prev.filter((m) => m.id !== id));
    setEditingMarker(null);
  }, []);

  // const getUserMarkerById = useCallback((markerId: string) => {
  //   return userMarkersByMarkerId[markerId] || null;
  // }, []);

  return (
    <UserMarkersContext.Provider
      value={{
        pickMode,
        setPickMode,
        userMarkers,
        userMarkersByMarkerId,
        createMarker,
        createMarkerRemote,
        updateMarker,
        deleteMarker,
        editingMarker,
        setEditingMarker,
        hideUserMarkers,
        setHideUserMarkers,
      }}
    >
      {children}
    </UserMarkersContext.Provider>
  );
};

export function useUserMarkers() {
  const ctx = useContext(UserMarkersContext);
  if (!ctx) {
    throw new Error("useUserMarkers must be used inside <UserMarkersProvider>");
  }
  return ctx;
}
