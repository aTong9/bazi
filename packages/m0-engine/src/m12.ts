import type { FiveElement } from "./m02.js";
import type { M08Result } from "./m08.js";
import { FIVE_ELEMENTS, outputOf } from "./element-cycle.js";

export interface ElementPath {
  readonly source: FiveElement; readonly bridge: FiveElement; readonly end: FiveElement;
  readonly status: "open" | "blocked" | "weak"; readonly blockPoint: "bridge" | "end" | null;
  readonly conditions: readonly string[];
}
export interface M12Result { readonly moduleId: "M0.M12"; readonly status: "complete" | "limited"; readonly paths: readonly ElementPath[]; readonly bridgeCandidates: readonly FiveElement[]; readonly matchedRuleIds: readonly string[]; readonly usefulGodDeclared: false }

export function analyzeM12(m08: M08Result): M12Result {
  const paths = FIVE_ELEMENTS.map((source): ElementPath => {
    const bridge = outputOf(source); const end = outputOf(bridge);
    const bridgeState = m08.elements[bridge].effectiveStrengthCandidate; const endState = m08.elements[end].effectiveStrengthCandidate;
    const blockPoint = bridgeState === "weak_candidate" ? "bridge" : endState === "weak_candidate" ? "end" : null;
    return { source, bridge, end, status: blockPoint === "bridge" ? "blocked" : blockPoint === "end" ? "weak" : "open", blockPoint, conditions: Object.freeze(blockPoint ? [`${blockPoint.toUpperCase()}_EVIDENCE_WEAK`] : ["EFFECTIVE_PATH_AVAILABLE"]) };
  });
  const bridges = [...new Set(paths.filter((path) => path.blockPoint === "bridge").map((path) => path.bridge))];
  const matched = ["M12-GEN-0001-V1.0", "M12-AGG-0083-V1.0", "M12-BOUND-0087-V1.0", "M12-BOUND-0088-V1.0", ...(bridges.length ? ["M12-BRIDGE-0019-V1.0", "M12-BLOCK-0039-V1.0"] : [])];
  return { moduleId: "M0.M12", status: m08.status, paths: Object.freeze(paths), bridgeCandidates: Object.freeze(bridges), matchedRuleIds: Object.freeze([...new Set(matched)].sort()), usefulGodDeclared: false };
}
