export const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

export function setDisplay(id: string, display: "none" | "flex" | "block") {
  $(id).style.display = display;
}

/** Marks `active` as the only `.active` element among those matching `selector`. */
export function setActive(selector: string, active: Element) {
  document
    .querySelectorAll(selector)
    .forEach((el) => el.classList.toggle("active", el === active));
}

export function onClick(
  selector: string,
  handler: (el: HTMLElement) => void,
) {
  document
    .querySelectorAll<HTMLElement>(selector)
    .forEach((el) => el.addEventListener("click", () => handler(el)));
}
