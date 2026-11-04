import type { ActionFunctionArgs } from "react-router";
import { validatePrescription } from "app/services/prescription";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)

    const rx = body?.prescription

    if (!rx.right || !rx?.left || !rx?.pd) {
        return Response.json(
            { error: "prescription needs right, left and pd" },
            { status: 400 },
        );
    }

    return Response.json(validatePrescription(rx, Boolean(body.needsAdd)))
}