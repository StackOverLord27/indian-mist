import { LogOut } from "lucide-react";
import type { UserData } from "./types";

export function ProfileHeader({
  user,
  onSignOut,
}: {
  user: UserData;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center justify-between mt-2 mb-8 pb-6 border-b border-olive-leaf/15">
      <div className="flex items-center gap-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-olive-leaf text-cornsilk">
          <span className="font-merriweather text-xl font-normal">
            {user.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-montserrat text-xs font-semibold uppercase tracking-widest text-olive-leaf/85">My Profile</p>
          <h1 className="font-merriweather text-2xl md:text-3xl font-normal text-forest mt-1">{user.name}</h1>
          <p className="font-montserrat text-xs text-muted-text font-normal mt-0.5">{user.email}</p>
        </div>
      </div>
      <button
        onClick={onSignOut}
        className="flex items-center gap-2 font-montserrat text-xs font-semibold uppercase tracking-widest text-muted-text transition-colors hover:text-forest"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </div>
  );
}
