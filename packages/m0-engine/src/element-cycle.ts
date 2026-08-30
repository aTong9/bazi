import type { FiveElement } from "./m02.js";

export const FIVE_ELEMENTS: readonly FiveElement[] = ["木", "火", "土", "金", "水"];
const PRODUCES: Record<FiveElement, FiveElement> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<FiveElement, FiveElement> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };

export function produces(source: FiveElement, target: FiveElement): boolean { return PRODUCES[source] === target; }
export function controls(source: FiveElement, target: FiveElement): boolean { return CONTROLS[source] === target; }
export function producerOf(target: FiveElement): FiveElement { return FIVE_ELEMENTS.find((element) => produces(element, target))!; }
export function controllerOf(target: FiveElement): FiveElement { return FIVE_ELEMENTS.find((element) => controls(element, target))!; }
export function outputOf(source: FiveElement): FiveElement { return PRODUCES[source]; }
export function wealthOf(source: FiveElement): FiveElement { return CONTROLS[source]; }
