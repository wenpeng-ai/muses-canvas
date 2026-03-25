"use client";

import Image from "next/image";
import { useMessages } from "next-intl";
import {
  Check,
  ChevronDown,
  Folders,
  FolderOpen,
  Hand,
  ImageIcon,
  Minus,
  History,
  Loader2,
  MoonStar,
  MousePointer2,
  Plus,
  Scan,
  Settings,
  SunMedium,
  Trash2,
  Type,
  Video,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  ProjectHistoryItem,
  ProjectSwitcherItem,
} from "@/lib/canvas/workspace/projects";
import {
  TEXT_FONT_FAMILY_OPTIONS,
  type CanvasPrimaryToolMode,
  type CanvasTextAnnotation,
  type CanvasTextStyleDefaults,
} from "@/components/canvas/workspace/shared";
import { getCanvasPageCopy } from "@/lib/canvas/copy";
import { LOCALE_OPTIONS, type AppLocale } from "@/lib/locale-config";
import type { AppMessages } from "@/i18n/messages";
import type { CanvasNodeKind } from "@/lib/supabase/types";

function MapOverviewIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.75 7.1 9.2 5.1l5.6 2.2 4.45-2V17.2l-4.45 2-5.6-2.2-4.45 2z" />
      <path d="M9.2 5.1v11.9" />
      <path d="M14.8 7.3v11.9" />
    </svg>
  );
}

function CanvasToolbarDropdown({
  value,
  options,
  onSelect,
  triggerClassName,
  contentClassName,
}: {
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  onSelect: (value: string) => void;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-9 justify-between rounded-[8px] bg-[#f3f4f6] px-3 text-sm font-medium text-foreground hover:bg-[#eceef1] data-[state=open]:bg-[#eceef1] dark:bg-[#181d25] dark:text-slate-100 dark:hover:bg-[#212734] dark:data-[state=open]:bg-[#212734]",
            triggerClassName,
          )}
        >
          <span className="truncate">{activeOption?.label ?? value}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground/70 dark:text-slate-300/70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          "flex flex-col gap-1 rounded-[14px] border border-black/5 bg-white/98 p-1 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.26)] dark:border-white/10 dark:bg-[#11161d]/98 dark:shadow-[0_20px_44px_-28px_rgba(0,0,0,0.72)]",
          contentClassName,
        )}
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onSelect(option.value)}
            className={cn(
              "rounded-[8px] px-3 py-2.5 text-sm font-medium dark:text-slate-100 dark:hover:bg-white/8 dark:focus:bg-white/8",
              option.value === value && "bg-[#f1f2f4] dark:bg-white/10",
            )}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getPrimaryToolMenuItems(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    {
      mode: "select" as const,
      label: copy.selectTool,
      shortcut: "V",
      icon: MousePointer2,
    },
    {
      mode: "hand" as const,
      label: copy.handTool,
      shortcut: "H",
      icon: Hand,
    },
  ];
}

function getTextFontWeightOptions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { value: "400", label: "Regular" },
    { value: "500", label: "Medium" },
    { value: "600", label: "Semibold" },
    { value: "700", label: copy.bold },
  ];
}

function getTextAlignOptions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    { value: "left", label: copy.alignLeft },
    { value: "center", label: copy.alignCenter },
    { value: "right", label: copy.alignRight },
  ];
}

export function CanvasWorkspaceProjectHeader({
  titleInputRef,
  isEditingProjectTitle,
  projectTitleDraft,
  projectTitle,
  savingProjectTitle,
  projectListLabel,
  projectListEmptyLabel,
  projectListLoadingLabel,
  newProjectLabel,
  creatingProjectLabel,
  historyLabel,
  historyEmptyLabel,
  projectSwitcherItems,
  projectHistoryItems,
  projectListLoading,
  creatingProject,
  deletingProjectId,
  onProjectTitleDraftChange,
  onCommitProjectTitle,
  onCancelProjectTitleEditing,
  onStartProjectTitleEditing,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onSelectHistoryItem,
}: {
  titleInputRef: RefObject<HTMLInputElement | null>;
  isEditingProjectTitle: boolean;
  projectTitleDraft: string;
  projectTitle: string;
  savingProjectTitle: boolean;
  projectListLabel: string;
  projectListEmptyLabel: string;
  projectListLoadingLabel: string;
  newProjectLabel: string;
  creatingProjectLabel: string;
  historyLabel: string;
  historyEmptyLabel: string;
  projectSwitcherItems: ProjectSwitcherItem[];
  projectHistoryItems: ProjectHistoryItem[];
  projectListLoading: boolean;
  creatingProject: boolean;
  deletingProjectId: string | null;
  onProjectTitleDraftChange: (value: string) => void;
  onCommitProjectTitle: () => void;
  onCancelProjectTitleEditing: () => void;
  onStartProjectTitleEditing: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onSelectHistoryItem: (operationId: string) => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);

  return (
    <div
      data-canvas-zoom-relay=""
      className="absolute left-2 top-2 z-40 h-[46px] max-w-[calc(100vw-96px)] rounded-[999px] border border-black/8 bg-white/96 p-1 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-[#0f1318]/92 dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)]"
    >
      <div className="flex h-full items-center">
        <div className="flex h-[38px] w-[54px] shrink-0 items-center justify-center rounded-full bg-white dark:bg-[#0f1318]">
          <Image
            src="/logo.svg"
            alt="Muses AI"
            width={36}
            height={36}
            className="object-contain dark:invert"
            priority
            unoptimized
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-[38px] w-[56px] shrink-0 rounded-full bg-white text-[#4d5561] hover:bg-black/[0.03] dark:bg-[#0f1318] dark:text-slate-100 dark:hover:bg-white/[0.05]"
              aria-label={projectListLabel}
              title={projectListLabel}
            >
              <Folders className="h-[18.5px] w-[18.5px]" strokeWidth={1.85} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={10}
            className="w-[320px] rounded-[18px] border border-black/6 bg-white/98 p-1.5 shadow-[0_26px_54px_-34px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#10161d]/98"
          >
            <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {projectListLabel}
            </DropdownMenuLabel>
            <div className="max-h-[320px] overflow-y-auto">
              {projectListLoading ? (
                <div className="flex items-center gap-2 rounded-[12px] px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {projectListLoadingLabel}
                </div>
              ) : projectSwitcherItems.length > 0 ? (
                projectSwitcherItems.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      "flex items-center gap-2 rounded-[12px] p-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                      project.isCurrent && "bg-[#f3f4f6] dark:bg-white/8",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="min-w-0 flex-1 rounded-[10px] px-3 py-2 text-left"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                          {project.title}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {project.meta}
                        </span>
                      </div>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onDeleteProject(project.id)}
                      disabled={deletingProjectId === project.id}
                      className="h-8 w-8 shrink-0 rounded-full border-[#efd0cc] bg-white text-[#a14b43] shadow-none hover:bg-[#fff7f6] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#5b2822] dark:bg-[#181412] dark:text-[#ff9b92] dark:hover:bg-[#231816]"
                      aria-label={`${copy.deleteProjectAction}: ${project.title}`}
                      title={copy.deleteProjectAction}
                    >
                      {deletingProjectId === project.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded-[12px] px-3 py-3 text-sm text-muted-foreground">
                  {projectListEmptyLabel}
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onCreateProject}
              disabled={creatingProject}
              className="rounded-[12px] px-3 py-3 text-sm font-medium"
            >
              {creatingProject ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {creatingProject ? creatingProjectLabel : newProjectLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-black/7 dark:bg-white/10" />

        {isEditingProjectTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={projectTitleDraft}
            maxLength={120}
            disabled={savingProjectTitle}
            onChange={(event) => onProjectTitleDraftChange(event.target.value)}
            onBlur={onCommitProjectTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onCancelProjectTitleEditing();
              }
            }}
            className="h-[38px] w-[188px] max-w-[28vw] min-w-0 rounded-full bg-white px-5 text-[14px] font-semibold tracking-[-0.02em] text-foreground outline-none ring-0 focus:bg-[#fafafa] dark:bg-[#0f1318] dark:text-slate-100 dark:focus:bg-[#121823]"
            aria-label={copy.projectTitleAria}
          />
        ) : (
          <button
            type="button"
            onClick={onStartProjectTitleEditing}
            className="flex h-[38px] min-w-0 max-w-[28vw] items-center rounded-full bg-white px-5 text-left transition-colors hover:bg-[#fafafa] dark:bg-[#0f1318] dark:hover:bg-[#121823]"
            title={copy.renameProject}
          >
            <span className="truncate text-[14px] font-semibold tracking-[-0.02em] text-foreground dark:text-slate-100">
              {projectTitle}
            </span>
          </button>
        )}

        {projectHistoryItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="ml-1 h-[38px] shrink-0 gap-2.5 rounded-full bg-white px-5 text-[#5e6570] hover:bg-[#fafafa] dark:bg-[#0f1318] dark:text-slate-200 dark:hover:bg-[#121823]"
                aria-label={historyLabel}
                title={historyLabel}
              >
                <History className="h-[18px] w-[18px]" strokeWidth={1.9} />
                <span className="text-[15px] font-medium tracking-[-0.02em]">
                  {historyLabel}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={10}
              className="w-[360px] rounded-[18px] border border-black/6 bg-white/98 p-1.5 shadow-[0_26px_54px_-34px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#10161d]/98"
            >
              <DropdownMenuLabel className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {historyLabel}
              </DropdownMenuLabel>
              <div className="max-h-[320px] overflow-y-auto">
                {projectHistoryItems.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => onSelectHistoryItem(item.id)}
                    className="items-start rounded-[12px] px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                            item.status === "completed" &&
                              "bg-[#e8f4ea] text-[#3d7a42] dark:bg-[#17271b] dark:text-[#8acb6c]",
                            (item.status === "pending" ||
                              item.status === "processing") &&
                              "bg-[#e7efff] text-[#4061df] dark:bg-[#16253d] dark:text-[#8da7ff]",
                            item.status === "failed" &&
                              "bg-[#fde9e8] text-[#b04b43] dark:bg-[#3b1a1a] dark:text-[#ff9b92]",
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {item.prompt}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {item.timestamp}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function CanvasWorkspaceAccountMenu({
  accountMenuRef,
  accountMenuOpen,
  activeLanguage,
  themeMode,
  leadingAction,
  panelContent,
  onAccountMenuOpenChange,
  onSelectLanguage,
  onToggleTheme,
}: {
  accountMenuRef: RefObject<HTMLDivElement | null>;
  accountMenuOpen: boolean;
  activeLanguage: AppLocale;
  themeMode: "light" | "dark";
  leadingAction?: ReactNode;
  panelContent?: ReactNode;
  onAccountMenuOpenChange: (open: boolean) => void;
  onSelectLanguage: (language: AppLocale) => void;
  onToggleTheme: () => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const activeLocaleOption =
    LOCALE_OPTIONS.find((option) => option.code === activeLanguage) ??
    LOCALE_OPTIONS[0];
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [expandedMenuWidth, setExpandedMenuWidth] = useState(178);

  useLayoutEffect(() => {
    const controlsElement = controlsRef.current;
    if (!controlsElement) {
      return;
    }

    const updateExpandedMenuWidth = () => {
      setExpandedMenuWidth(Math.max(46, Math.ceil(controlsElement.scrollWidth + 8)));
    };

    updateExpandedMenuWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateExpandedMenuWidth();
    });
    observer.observe(controlsElement);

    return () => {
      observer.disconnect();
    };
  }, [activeLocaleOption.shortLabel, leadingAction]);

  return (
    <div
      ref={accountMenuRef}
      className="pointer-events-none absolute right-2 top-2 z-40"
    >
      <div data-canvas-zoom-relay="" className="pointer-events-auto relative">
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] origin-top-right transition-all duration-300",
            accountMenuOpen
              ? "translate-x-0 scale-100 opacity-100"
              : "pointer-events-none translate-x-8 scale-95 opacity-0",
          )}
        >
          <section
            aria-label={copy.workspacePanelAria}
            data-canvas-zoom-relay=""
            className="h-[min(520px,calc(100vh-132px))] w-[min(840px,calc(100vw-24px))] overflow-hidden rounded-[20px] border border-black/8 bg-white/98 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.34)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10161d]/98 dark:shadow-[0_26px_62px_-32px_rgba(0,0,0,0.8)]"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {panelContent ?? (
              <div className="sr-only">{copy.workspacePanelCleared}</div>
            )}
          </section>
        </div>

        <div
          data-canvas-zoom-relay=""
          className={cn(
            "h-[46px] overflow-hidden rounded-full border border-black/6 bg-white/94 p-1 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.24)] backdrop-blur transition-[width] duration-300 dark:border-white/10 dark:bg-[#10161d]/92 dark:shadow-[0_18px_38px_-26px_rgba(0,0,0,0.72)]",
          )}
          style={{ width: accountMenuOpen ? expandedMenuWidth : 46 }}
        >
          <div
            ref={controlsRef}
            className={cn(
              "absolute left-1 top-1 flex h-[38px] items-center gap-1 overflow-hidden pr-[56px] transition-opacity duration-200",
              accountMenuOpen
                ? "opacity-100"
                : "pointer-events-none opacity-0",
            )}
          >
            {leadingAction}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 text-sm text-foreground/72 transition-colors hover:bg-black/[0.03] hover:text-foreground dark:text-slate-300/72 dark:hover:bg-white/[0.05] dark:hover:text-slate-100"
                  title={copy.language}
                >
                  <span className="whitespace-nowrap leading-none">
                    {activeLocaleOption.shortLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                data-account-menu-keep-open
                className="flex min-w-[148px] flex-col gap-1 rounded-[16px] border border-black/6 bg-white/98 p-1 shadow-[0_22px_44px_-30px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#10161d]/98"
              >
                {LOCALE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.code}
                    onSelect={() => onSelectLanguage(option.code)}
                    className={cn(
                      "flex items-center justify-between rounded-[10px] px-3 py-2 text-sm",
                      activeLanguage === option.code && "bg-[#f3f4f6] dark:bg-white/8",
                    )}
                  >
                    <span>{option.label}</span>
                    <Check
                      className={cn(
                        "h-4 w-4 transition-opacity",
                        activeLanguage === option.code
                          ? "opacity-100 text-foreground/78 dark:text-slate-100"
                          : "opacity-0",
                      )}
                    />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-foreground/72 transition-colors hover:bg-black/[0.03] hover:text-foreground dark:text-slate-300/72 dark:hover:bg-white/[0.05] dark:hover:text-slate-100"
              title={copy.toggleTheme}
            >
              <span className="relative h-4 w-4">
                <SunMedium
                  className={cn(
                    "absolute inset-0 h-4 w-4 transition-all duration-300",
                    themeMode === "light"
                      ? "scale-100 rotate-0 opacity-100"
                      : "scale-50 -rotate-90 opacity-0",
                  )}
                />
                <MoonStar
                  className={cn(
                    "absolute inset-0 h-4 w-4 transition-all duration-300",
                    themeMode === "dark"
                      ? "scale-100 rotate-0 opacity-100"
                      : "scale-50 rotate-90 opacity-0",
                  )}
                />
              </span>
            </button>
            <div
              aria-hidden="true"
              className="mx-1 h-5 w-px shrink-0 bg-black/8 dark:bg-white/10"
            />
          </div>
        </div>

        <button
          type="button"
          data-canvas-zoom-relay=""
          aria-label={
            accountMenuOpen
              ? copy.closeWorkspaceControls
              : copy.openWorkspaceControls
          }
          aria-expanded={accountMenuOpen}
          onClick={() => onAccountMenuOpenChange(!accountMenuOpen)}
          className={cn(
            "pointer-events-auto absolute right-1 top-1 flex h-[38px] w-[38px] items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-300 ease-out",
            accountMenuOpen
              ? "bg-[#2c2c2c] text-white shadow-[0_14px_28px_-20px_rgba(0,0,0,0.35)]"
              : "w-[38px] text-foreground hover:bg-black/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.05]",
          )}
          title={accountMenuOpen ? copy.closeAction : copy.workspaceLabel}
        >
          <span className="relative flex h-4.5 w-4.5 shrink-0 items-center justify-center">
            <Settings
              className={cn(
                "absolute inset-0 h-4.5 w-4.5 transition-all duration-300",
                accountMenuOpen
                  ? "scale-50 rotate-90 opacity-0"
                  : "scale-100 rotate-0 opacity-100",
              )}
            />
            <X
              className={cn(
                "absolute inset-0 h-4.5 w-4.5 transition-all duration-300",
                accountMenuOpen
                  ? "scale-100 rotate-0 opacity-100"
                  : "scale-50 -rotate-90 opacity-0",
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

export function CanvasWorkspaceSideToolbar({
  primaryToolMode,
  primaryMenuOpen,
  importAssetsLabel,
  onSetPrimaryToolMode,
  onPrimaryMenuOpenChange,
  onCreateTextNode,
  onCreateImageNode,
  onCreateVideoNode,
  onStartDragNode,
  onOpenImportAssets,
}: {
  primaryToolMode: CanvasPrimaryToolMode;
  primaryMenuOpen: boolean;
  importAssetsLabel: string;
  onSetPrimaryToolMode: (mode: CanvasPrimaryToolMode) => void;
  onPrimaryMenuOpenChange: (open: boolean) => void;
  onCreateTextNode: () => void;
  onCreateImageNode: () => void;
  onCreateVideoNode: () => void;
  onStartDragNode: (
    kind: CanvasNodeKind,
    event: DragEvent<HTMLButtonElement>,
  ) => void;
  onOpenImportAssets: () => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const primaryToolMenuItems = getPrimaryToolMenuItems(copy);
  const activePrimaryTool =
    primaryToolMenuItems.find((item) => item.mode === primaryToolMode) ??
    primaryToolMenuItems[0];
  const ActivePrimaryToolIcon = activePrimaryTool.icon;
  const primaryMenuCloseTimeoutRef = useRef<number | null>(null);

  const clearPrimaryMenuCloseTimeout = () => {
    if (primaryMenuCloseTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(primaryMenuCloseTimeoutRef.current);
    primaryMenuCloseTimeoutRef.current = null;
  };

  const openPrimaryMenu = () => {
    clearPrimaryMenuCloseTimeout();
    onPrimaryMenuOpenChange(true);
  };

  const closePrimaryMenuSoon = () => {
    clearPrimaryMenuCloseTimeout();
    primaryMenuCloseTimeoutRef.current = window.setTimeout(() => {
      onPrimaryMenuOpenChange(false);
      primaryMenuCloseTimeoutRef.current = null;
    }, 140);
  };

  useEffect(() => {
    return () => {
      clearPrimaryMenuCloseTimeout();
    };
  }, []);

  return (
    <div
      data-canvas-zoom-relay=""
      className="absolute left-5 top-1/2 z-40 -translate-y-1/2"
    >
      <div className="relative">
        <div className="flex flex-col gap-1.5 rounded-[14px] border border-border/70 bg-white/96 p-1.5 shadow-[0_22px_44px_-36px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#0f141c]/94 dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.72)]">
          <div
            className="relative"
            onMouseEnter={openPrimaryMenu}
            onMouseLeave={closePrimaryMenuSoon}
            onFocusCapture={openPrimaryMenu}
            onBlurCapture={(event) => {
              clearPrimaryMenuCloseTimeout();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                onPrimaryMenuOpenChange(false);
              }
            }}
          >
            <Button
              variant="secondary"
              size="icon"
              className="relative h-10 w-10 rounded-[8px] bg-[#2c2c2c] text-white hover:bg-[#252525] hover:text-white dark:bg-[#2c2c2c] dark:text-white dark:hover:bg-[#252525] dark:hover:text-white"
              title={activePrimaryTool.label}
              aria-label={`${activePrimaryTool.label} tools`}
              aria-expanded={primaryMenuOpen}
              onClick={() => {
                clearPrimaryMenuCloseTimeout();
                onPrimaryMenuOpenChange(!primaryMenuOpen);
              }}
            >
              <ActivePrimaryToolIcon className="h-4.5 w-4.5" />
            </Button>

            {primaryMenuOpen ? (
              <div
                data-canvas-zoom-relay=""
                className="absolute left-[calc(100%+12px)] top-0 z-20 flex w-[180px] flex-col gap-1 rounded-[14px] border border-black/5 bg-white/98 p-1 shadow-[0_22px_44px_-28px_rgba(15,23,42,0.26)] dark:border-white/10 dark:bg-[#121822]/98 dark:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.74)]"
              >
                {primaryToolMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => onSetPrimaryToolMode(item.mode)}
                      className={cn(
                        "grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_18px] items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-[#f1f2f4] dark:text-slate-100 dark:hover:bg-white/8",
                        primaryToolMode === item.mode && "bg-[#f1f2f4] dark:bg-white/10",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-left">{item.label}</span>
                      <span className="text-right text-[12px] text-muted-foreground">
                        {item.shortcut}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mx-1.5 my-0.5 h-px bg-border/70" />

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 cursor-grab rounded-[8px] active:cursor-grabbing"
            onClick={onCreateTextNode}
            draggable
            onDragStart={(event) => onStartDragNode("text", event)}
            title={copy.addTextNode}
          >
            <Type className="h-4.5 w-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 cursor-grab rounded-[8px] active:cursor-grabbing"
            onClick={onCreateImageNode}
            draggable
            onDragStart={(event) => onStartDragNode("image", event)}
            title={copy.addImageNode}
          >
            <ImageIcon className="h-4.5 w-4.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 cursor-grab rounded-[8px] active:cursor-grabbing"
            onClick={onCreateVideoNode}
            draggable
            onDragStart={(event) => onStartDragNode("video", event)}
            title={copy.addVideoNode}
          >
            <Video className="h-4.5 w-4.5" />
          </Button>

          <div className="mx-1.5 my-0.5 h-px bg-border/70" />

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[8px]"
            onClick={onOpenImportAssets}
            title={importAssetsLabel}
          >
            <FolderOpen className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CanvasWorkspaceTextToolbar({
  textToolbarRef,
  activeTextAnnotation,
  position,
  maxWidth,
  visible,
  textDefaults,
  onUpsertActiveTextPatch,
}: {
  textToolbarRef: RefObject<HTMLDivElement | null>;
  activeTextAnnotation: CanvasTextAnnotation | null;
  position: {
    left: number;
    top: number;
    centered: boolean;
  } | null;
  maxWidth: number;
  visible: boolean;
  textDefaults: CanvasTextStyleDefaults;
  onUpsertActiveTextPatch: (patch: Partial<CanvasTextAnnotation>) => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const textFontWeightOptions = getTextFontWeightOptions(copy);
  const textAlignOptions = getTextAlignOptions(copy);

  if (!activeTextAnnotation || !position) {
    return null;
  }

  return (
    <div
      ref={textToolbarRef}
      data-canvas-zoom-relay=""
      className="absolute z-40 flex max-w-[calc(100%-32px)] flex-wrap items-center gap-1.5 rounded-[14px] border border-black/5 bg-white/98 p-1.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#121822]/98 dark:shadow-[0_22px_42px_-28px_rgba(0,0,0,0.74)]"
      style={{
        left: position.left,
        top: position.top,
        transform: position.centered ? "translateX(-50%)" : undefined,
        visibility: visible ? "visible" : "hidden",
        maxWidth,
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] bg-[#f3f4f6] dark:bg-[#1a212c]">
        <input
          type="color"
          value={activeTextAnnotation.color ?? textDefaults.color}
          className="sr-only"
          onChange={(event) =>
            onUpsertActiveTextPatch({
              color: event.target.value,
            })
          }
        />
        <span
          className="h-5 w-5 rounded-full border border-black/10"
          style={{
            backgroundColor: activeTextAnnotation.color ?? textDefaults.color,
          }}
        />
      </label>
      <CanvasToolbarDropdown
        value={activeTextAnnotation.fontFamily ?? textDefaults.fontFamily}
        options={TEXT_FONT_FAMILY_OPTIONS}
        onSelect={(value) =>
          onUpsertActiveTextPatch({
            fontFamily: value,
          })
        }
        triggerClassName="w-[132px]"
        contentClassName="w-[160px]"
      />
      <CanvasToolbarDropdown
        value={String(activeTextAnnotation.fontWeight ?? textDefaults.fontWeight)}
        options={textFontWeightOptions}
        onSelect={(value) =>
          onUpsertActiveTextPatch({
            fontWeight: Number(value),
          })
        }
        triggerClassName="w-[124px]"
        contentClassName="w-[148px]"
      />
      <div className="flex h-9 items-center gap-1 rounded-[8px] bg-[#f3f4f6] px-3 dark:bg-[#1a212c]">
        <input
          type="text"
          inputMode="numeric"
          value={String(activeTextAnnotation.fontSize ?? textDefaults.fontSize)}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10);
            onUpsertActiveTextPatch({
              fontSize:
                Number.isFinite(nextValue) && nextValue > 0
                  ? Math.min(200, nextValue)
                  : textDefaults.fontSize,
            });
          }}
          className="h-full w-12 border-none bg-transparent text-center text-sm outline-none"
        />
        <span className="text-xs text-muted-foreground">Px</span>
      </div>
      <CanvasToolbarDropdown
        value={activeTextAnnotation.align ?? textDefaults.align}
        options={textAlignOptions}
        onSelect={(value) =>
          onUpsertActiveTextPatch({
            align: value as CanvasTextAnnotation["align"],
          })
        }
        triggerClassName="w-[108px]"
        contentClassName="w-[124px]"
      />
    </div>
  );
}

export function CanvasWorkspaceSyncIndicator({
  isVisible,
}: {
  isVisible: boolean;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-5 z-40 -translate-x-1/2 rounded-full bg-white/96 px-4 py-2 text-sm text-muted-foreground backdrop-blur dark:border dark:border-white/10 dark:bg-[#10161d]/94 dark:text-slate-300 dark:shadow-[0_20px_40px_-28px_rgba(0,0,0,0.72)]">
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {copy.syncingCanvas}
      </span>
    </div>
  );
}

export function CanvasWorkspaceZoomControls({
  zoom,
  mapOpen,
  onFitView,
  onToggleMap,
  onZoomOut,
  onZoomIn,
}: {
  zoom: number;
  mapOpen: boolean;
  onFitView: () => void;
  onToggleMap: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const controlButtonClassName =
    "h-10 w-10 rounded-full bg-[#f5f5f5] text-foreground/68 shadow-[0_10px_26px_-20px_rgba(15,23,42,0.16)] transition-[background-color,color,box-shadow,transform] duration-200 hover:bg-white hover:text-foreground/78 dark:bg-[#10161d] dark:text-slate-300/82 dark:shadow-[0_14px_28px_-22px_rgba(0,0,0,0.62)] dark:hover:bg-[#151b24] dark:hover:text-slate-100";

  return (
    <div className="absolute bottom-2.5 right-2.5 z-40 flex items-center gap-1 text-sm text-muted-foreground dark:text-slate-300">
      <Button
        variant="ghost"
        size="icon"
        className={controlButtonClassName}
        onClick={onFitView}
        title={copy.fitView}
      >
        <Scan className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          controlButtonClassName,
          mapOpen &&
            "bg-white text-foreground/78 shadow-[0_14px_30px_-22px_rgba(15,23,42,0.22)] dark:bg-[#171e28] dark:text-slate-100",
        )}
        onClick={onToggleMap}
        title={mapOpen ? copy.hideMap : copy.showMap}
      >
        <MapOverviewIcon className="h-[18px] w-[18px]" />
      </Button>
      <div className="mx-0.5 h-5 w-px bg-black/8 dark:bg-white/10" />
      <Button
        variant="ghost"
        size="icon"
        className={controlButtonClassName}
        onClick={onZoomOut}
        title={copy.zoomOut}
      >
        <Minus className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </Button>
      <span className="w-[44px] text-center text-[13px] font-medium text-foreground/78 dark:text-slate-100/88">
        {Math.min(Math.max(Math.round(zoom * 100), 10), 500)}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={controlButtonClassName}
        onClick={onZoomIn}
        title={copy.zoomIn}
      >
        <Plus className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </Button>
    </div>
  );
}
