import { icon } from "./icons";
import { escapeHtml } from "./helpers";

type ToastStatus = "success" | "error";

const TONE = { success: "success", error: "destructive" } as const;

export function showToast(
  title: string,
  meta: string,
  status: ToastStatus,
  duration = 5000,
) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.tone = TONE[status];
  toast.innerHTML = `
    <div class="toast-icon">${icon(status === "success" ? "check" : "close", { size: 14, stroke: 2.5 })}</div>
    <div class="toast-body">
      <div class="toast-title truncate">${escapeHtml(title)}</div>
      <div class="toast-meta">${escapeHtml(meta)}</div>
    </div>
    <button class="btn btn-ghost btn-icon btn-sm toast-close" title="Dismiss">${icon("close", { size: 12, stroke: 2.5 })}</button>
    <div class="toast-progress" style="width: 100%;"></div>
  `;
  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add("is-exiting");
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector(".toast-close")!.addEventListener("click", dismiss);

  const bar = toast.querySelector<HTMLElement>(".toast-progress")!;
  requestAnimationFrame(() => {
    bar.style.transitionDuration = `${duration}ms`;
    bar.style.width = "0%";
  });
  setTimeout(dismiss, duration);
}
