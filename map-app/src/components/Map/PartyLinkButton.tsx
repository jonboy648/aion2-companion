import {useState} from "react";
import {Button} from "@heroui/react";
import {useGameMap} from "@/context/GameMapContext";
import {useUserMarkers} from "@/context/UserMarkersContext";
import {encodePartyLink} from "@/utils/partyLink";

export default function PartyLinkButton() {
  const {selectedMap} = useGameMap();
  const {userMarkers} = useUserMarkers();
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");
  const copy = async () => {
    if (!selectedMap) return;
    const url = new URL(import.meta.env.BASE_URL, window.location.origin);
    url.searchParams.set("p", encodePartyLink(selectedMap, userMarkers));
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
    } catch { setFallback(url.href); }
  };
  return <div className="px-5 mt-3">
    <Button fullWidth size="sm" variant="bordered" isDisabled={!selectedMap} onPress={copy} onBlur={() => setCopied(false)}>
      {copied ? "Party link copied" : "Copy party link"}
    </Button>
    {fallback && <input aria-label="Party share link" className="mt-2 w-full bg-transparent text-sm" readOnly value={fallback} onFocus={e => e.currentTarget.select()} />}
  </div>;
}
