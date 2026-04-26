import { useEffect, useState } from "react";

const getInitials = (name = "", email = "") => {
  const source = name.trim() || email.trim();

  if (!source) {
    return "SC";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

export default function UserAvatar({ user, size = "md", className = "" }) {
  const image = user?.profileImage;
  const [imageFailed, setImageFailed] = useState(false);
  const label = user?.name || user?.email || "User";
  const classes = ["user-avatar", `user-avatar-${size}`, className].filter(Boolean).join(" ");
  const showImage = image && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  return (
    <span className={classes} aria-label={label} title={label}>
      {showImage ? (
        <img src={image} alt="" onError={() => setImageFailed(true)} />
      ) : (
        <span>{getInitials(user?.name, user?.email)}</span>
      )}
    </span>
  );
}
