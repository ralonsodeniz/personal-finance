import { WaypointMark } from "./waypoint-mark";

export function WayfinderWordmark() {
  return (
    <a className="wordmark" href="/" aria-label="Wayfinder home">
      <WaypointMark className="wordmark-mark" />
      <span>Wayfinder</span>
    </a>
  );
}
