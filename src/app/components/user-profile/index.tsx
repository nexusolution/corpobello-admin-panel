"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";

import CardBox from "../shared/CardBox";
import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";
import { useTranslation } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { useCurrentUser, type UserRole } from "@/lib/auth/useCurrentUser";
import { fileToAvatarDataUrl, setOwnAvatar } from "@/lib/auth/avatar";

// My Profile: the real signed-in user from Supabase Auth + app_users. Name/role
// are admin-managed (Usuarios), but every user can set their OWN avatar here
// (persisted via the set_own_avatar RPC, migration 0010).

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const ROLE_LABEL_KEY: Record<UserRole, TranslationKey> = {
  admin: "users.role.admin",
  operador: "users.role.operador",
  profesional: "users.role.profesional",
};

const ROLE_BADGE: Record<UserRole, string> = {
  admin: "bg-lightprimary text-primary",
  operador: "bg-lightsuccess text-success",
  profesional: "bg-lightwarning text-warning",
};

const UserProfile = () => {
  const { t } = useTranslation();
  const { name, email, role, avatar, loading } = useCurrentUser();

  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync local avatar once the hook resolves.
  useEffect(() => {
    setCurrentAvatar(avatar);
  }, [avatar]);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const err = await setOwnAvatar(dataUrl);
      if (!err) setCurrentAvatar(dataUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const BCrumb = [
    { to: "/", title: t("sidebar.home") },
    { title: t("profile.heading") },
  ];

  const displayName = name || email.split("@")[0] || t("profile.heading");
  const roleLabel = t(ROLE_LABEL_KEY[role]);

  return (
    <>
      <BreadcrumbComp title={t("profile.heading")} items={BCrumb} />

      {loading ? (
        <CardBox className="p-10 flex items-center justify-center">
          <Icon icon="tabler:loader-2" height={32} width={32} className="text-primary animate-spin" />
        </CardBox>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Header card */}
          <CardBox className="p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center gap-6 w-full break-words">
              <div className="relative shrink-0">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-lightprimary text-primary flex items-center justify-center text-2xl font-bold ring-4 ring-lightprimary/40">
                  {currentAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentAvatar} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    initials(displayName)
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t("profile.avatar.change")}
                  className="absolute -bottom-1 -right-1 h-8 w-8 inline-flex items-center justify-center rounded-full bg-primary text-white ring-2 ring-card hover:bg-primaryemphasis disabled:opacity-60 transition-colors">
                  <Icon icon={uploading ? "tabler:loader-2" : "solar:camera-line-duotone"} height={16} width={16} className={uploading ? "animate-spin" : ""} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
              </div>
              <div className="flex flex-col sm:text-left text-center gap-1.5">
                <h5 className="card-title text-lg">{displayName}</h5>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[role]}`}>
                    {roleLabel}
                  </span>
                  {email && (
                    <span className="text-sm text-link dark:text-darklink">{email}</span>
                  )}
                </div>
              </div>
            </div>
          </CardBox>

          {/* Account info */}
          <div className="rounded-xl border border-border dark:border-darkborder md:p-6 p-4 w-full break-words">
            <h5 className="card-title mb-5">{t("profile.account")}</h5>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-link dark:text-darklink">{t("profile.field.name")}</p>
                <p className="text-dark dark:text-white mt-0.5">{displayName}</p>
              </div>
              <div>
                <p className="text-xs text-link dark:text-darklink">{t("profile.field.email")}</p>
                <p className="text-dark dark:text-white mt-0.5">{email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-link dark:text-darklink">{t("profile.field.role")}</p>
                <p className="text-dark dark:text-white mt-0.5">{roleLabel}</p>
              </div>
            </div>
            <p className="text-xs text-link dark:text-darklink mt-6 flex items-start gap-1.5">
              <Icon icon="solar:info-circle-line-duotone" height={15} width={15} className="mt-0.5 shrink-0" />
              {t("profile.note")}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default UserProfile;
