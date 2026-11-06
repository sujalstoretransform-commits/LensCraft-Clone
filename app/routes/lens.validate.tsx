import type { ActionFunctionArgs } from "react-router";
import { validatePrescription } from "app/services/prescription";
import type { EyeRx, Prescription } from "app/services/prescription";

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyOptionalNumbers = (
    value: JsonRecord,
    keys: string[],
) =>
    keys.every(
        (key) =>
            value[key] === undefined ||
            (typeof value[key] === "number" && Number.isFinite(value[key])),
    );

const isEyeRx = (value: unknown): value is EyeRx =>
    isJsonRecord(value) && hasOnlyOptionalNumbers(value, ["sph", "cyl", "axis", "add"]);

const isPrescription = (value: unknown): value is Prescription =>
    isJsonRecord(value) &&
    isEyeRx(value.right) &&
    isEyeRx(value.left) &&
    isJsonRecord(value.pd) &&
    hasOnlyOptionalNumbers(value.pd, ["single", "right", "left"]);

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const prescription = isJsonRecord(body) ? body.prescription : undefined;

    if (!isPrescription(prescription)) {
        return Response.json(
            { error: "prescription needs right, left and pd" },
            { status: 400 },
        );
    }

    return Response.json(
        validatePrescription(
            prescription,
            isJsonRecord(body) && Boolean(body.needsAdd),
        ),
    );
}