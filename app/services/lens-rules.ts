import type { Prescription } from "./prescription";

export type Selection = {
    lensTypeCode: string;
    lensIndexCode?: string;
    optionCodes: string[]
    frameHeightMm?: number;
    prescription?: Prescription;
}

export type Rule = {
    code: string,
    kind: string,
    lensType: { code: string } | null;
    lensIndex: { code: string } | null;
    lensOption: { code: string } | null;
    relatedOptionCode: string | null;
    limitValue: { toString(): string } | null; // Prisma Decimal or number
    minimumFrameHeightMm: number | null;
    message: string;
}

const ruleApplies = (rule: Rule, sel: Selection) => {
    if (rule.lensType && rule.lensType.code !== sel.lensTypeCode) return false;
    if (rule.lensIndex && rule.lensIndex.code !== sel.lensIndexCode) return false;
    if (rule.lensOption && !sel.optionCodes.includes(rule.lensOption.code)) return false;

    return true;
}

const eyeValues = (sel: Selection, field: "sph" | "cyl" | "add") => {
    const rx = sel.prescription
    if (!rx) return []

    return [rx.right[field], rx.left[field]].filter(
        (val): val is number => val !== undefined,
    );
}


const breaksRule = (rule: Rule, sel: Selection) => {
    const limit = rule.limitValue === null ? null : Number(rule.limitValue.toString())

    switch (rule.kind) {
        case "requires_option":
            return !sel.optionCodes.includes(rule.relatedOptionCode ?? "")

        case "incompatible_option":
            return sel.optionCodes.includes(rule.relatedOptionCode ?? "")

        case "minimum_frame_height":
            if (rule.minimumFrameHeightMm === null) return false
            return (
                sel.frameHeightMm === undefined ||
                sel.frameHeightMm < rule.minimumFrameHeightMm
            )

        case "minimum_sph":
            return limit !== null && eyeValues(sel, "sph").some((val) => val < limit)
        case "maximum_sph":
            return limit !== null && eyeValues(sel, "sph").some((val) => val > limit)
        case "minimum_cyl":
            return limit !== null && eyeValues(sel, "cyl").some((val) => val < limit)
        case "maximum_cyl":
            return limit !== null && eyeValues(sel, "cyl").some((val) => val > limit)
        case "minimum_add":
            return limit !== null && eyeValues(sel, "add").some((val) => val < limit)
        case "maximum_add":
            return limit !== null && eyeValues(sel, "sph").some((val) => val > limit)

        default: return false
    }
}

export const checkRules = (rules: Rule[], sel: Selection) => {
    const errors = rules
        .filter((rule) => ruleApplies(rule, sel) && breaksRule(rule, sel))
        .map((rule) => rule.message)

    return { valid: errors.length === 0, errors }
}