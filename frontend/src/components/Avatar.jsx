import { avatarColor, initials } from "../lib/format";

export default function Avatar({ name, size = "h-9 w-9" }) {
  return (
    <div
      className={`${size} ${avatarColor(name)} grid shrink-0 place-items-center rounded-full text-xs font-semibold text-white`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
