import { useParams } from "react-router-dom";
import { Character } from "./Character";

/** One fresh Character per region/server/name, so opening another character in the same tab never carries over
 * the previous character's state or leftover results. */
export function CharacterPage() {
  const { region = "", serverId = "", name = "" } = useParams();
  return <Character key={`${region}/${serverId}/${name}`} />;
}
